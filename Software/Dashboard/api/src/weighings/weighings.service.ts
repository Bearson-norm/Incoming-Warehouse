import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WeighReading, WeighSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OdooWeighingService } from '../odoo/odoo-weighing.service';
import { ConfirmWeighingDto } from './dto/confirm-weighing.dto';
import {
  WeightSnapshot,
  WeightSnapshotStore,
} from '../websocket/weight-snapshot.store';
import { CloudSyncService } from '../cloud/cloud-sync.service';
import {
  IncomingOdooMeta,
  readIncomingOdooMeta,
} from '../odoo/incoming-odoo-process';
import { OdooWeightSuccess } from '../odoo/odoo-weighing.service';
import {
  BatchAdvance,
  QUEUE_DONE,
  QUEUE_PENDING,
  SessionsService,
} from '../sessions/sessions.service';
import { roundGrams } from '../common/weight-unit';

type SessionWithPackaging = WeighSession & {
  packaging: { id: number; tareWeight: number | null } | null;
};

@Injectable()
export class WeighingsService {
  private readonly logger = new Logger(WeighingsService.name);

  constructor(
    private prisma: PrismaService,
    private odooWeighing: OdooWeighingService,
    private snapshots: WeightSnapshotStore,
    private cloudSync: CloudSyncService,
    private sessions: SessionsService,
  ) {}

  async confirm(userId: number, dto: ConfirmWeighingDto) {
    const session = await this.prisma.weighSession.findUnique({
      where: { id: dto.sessionId },
      include: { packaging: true },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${dto.sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    const existing = await this.prisma.weighReading.findFirst({
      where: {
        sessionId: dto.sessionId,
        savedAt: { not: null },
      },
      orderBy: { savedAt: 'desc' },
    });

    if (existing) {
      const advance = await this.advanceForSession(session);
      return this.toConfirmResult(session, existing, advance);
    }

    if (session.endedAt) {
      throw new BadRequestException('Session has already ended');
    }

    if (!session.weighingStarted) {
      throw new BadRequestException('Weighing has not been started');
    }

    const snapshot = this.snapshots.getUsable(session.gatewayId);
    if (!snapshot) {
      throw new BadRequestException(
        'No recent stable scale reading. Wait for a live stable weight, then confirm again.',
      );
    }

    const method = session.weighingMethod === 'internal' ? 'internal' : 'odoo';
    if (dto.saveLocally) {
      return this.confirmInternal(session, snapshot, method === 'odoo');
    }
    if (method === 'internal') {
      return this.confirmInternal(session, snapshot);
    }
    return this.confirmOdoo(session, snapshot);
  }

  async sendToOdoo(userId: number, readingId: number) {
    const reading = await this.prisma.weighReading.findUnique({
      where: { id: readingId },
      include: { session: true },
    });

    if (!reading) {
      throw new NotFoundException(`Reading with ID ${readingId} not found`);
    }

    if (reading.session.userId !== userId) {
      throw new NotFoundException('Reading not found');
    }

    if (reading.odooLogId) {
      return this.toConfirmResult(reading.session, reading);
    }

    if (reading.weightStatus?.toLowerCase() !== 'local') {
      throw new BadRequestException(
        'Only locally saved weighings can be sent to Odoo from this action',
      );
    }

    const packageUid = (
      reading.packageUid ||
      reading.session.packageUid ||
      ''
    ).trim();
    const unit = reading.unit || 'g';
    const grossSource = reading.grossWeight ?? reading.weight;
    const grossWeightG = this.odooWeighing.toGrossWeightG(grossSource, unit);
    const submitted = await this.submitOdooWeight(
      reading.session,
      packageUid,
      grossWeightG,
    );

    const updated = await this.prisma.weighReading.update({
      where: { id: reading.id },
      data: {
        weight: grossWeightG,
        unit: 'g',
        packageUid: submitted.packageUid,
        odooLogId: submitted.result.log_id ?? null,
        odooPackageId: submitted.result.package_id ?? null,
        grossWeight: submitted.result.gross_weight,
        tareWeight: submitted.result.tare_weight,
        netWeight: submitted.result.net_weight,
        weightStatus: submitted.weightStatus,
        odooMessage: submitted.result.message,
        odooError: null,
      },
    });

    await this.triggerCloudSync(updated, reading.session, userId);
    return this.toConfirmResult(reading.session, updated);
  }

  private async confirmOdoo(
    session: SessionWithPackaging,
    snapshot: WeightSnapshot,
  ) {
    const unit = snapshot.unit || 'g';
    const grossWeightG = this.odooWeighing.toGrossWeightG(
      snapshot.weight,
      unit,
    );
    const submitted = await this.submitOdooWeight(
      session,
      session.packageUid?.trim() || '',
      grossWeightG,
    );
    const odooResult = submitted.result;

    const readingData: Prisma.WeighReadingUncheckedCreateInput = {
      sessionId: session.id,
      weight: grossWeightG,
      unit: 'g',
      stable: true,
      rawLine: snapshot.rawLine ?? null,
      capturedAt: snapshot.capturedAt
        ? new Date(snapshot.capturedAt)
        : new Date(),
      savedAt: new Date(),
      packageUid: submitted.packageUid,
      odooLogId: odooResult.log_id ?? null,
      odooPackageId: odooResult.package_id ?? null,
      grossWeight: odooResult.gross_weight,
      tareWeight: odooResult.tare_weight,
      netWeight: odooResult.net_weight,
      weightStatus: submitted.weightStatus,
      odooMessage: odooResult.message,
    };

    let lastDbError: Error | null = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const saved = await this.persistReading(session.id, readingData);
        if (saved) {
          await this.triggerCloudSync(saved.reading, session, session.userId);
          return this.toConfirmResult(session, saved.reading, saved);
        }
        const winner = await this.prisma.weighReading.findFirst({
          where: { sessionId: session.id, savedAt: { not: null } },
          orderBy: { savedAt: 'desc' },
        });
        if (winner) {
          const advance = await this.advanceForSession(session);
          return this.toConfirmResult(session, winner, advance);
        }
        throw new BadRequestException('Session has already ended');
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        lastDbError = error as Error;
        this.logger.error(
          `Local persist attempt ${attempt}/5 failed after Odoo success (log_id=${odooResult.log_id}): ${lastDbError.message}`,
        );
        await new Promise((r) => setTimeout(r, 150 * attempt));
      }
    }

    throw new InternalServerErrorException(
      `Odoo accepted the weight (log_id=${odooResult.log_id}) but local save failed. Do not confirm again. Contact admin. ${lastDbError?.message ?? ''}`.trim(),
    );
  }

  private async confirmInternal(
    session: SessionWithPackaging,
    snapshot: WeightSnapshot,
    fallbackFromOdoo = false,
  ) {
    const unit = snapshot.unit || 'g';
    const grossWeightG = this.odooWeighing.toGrossWeightG(
      snapshot.weight,
      unit,
    );
    const packageUid = session.packageUid?.trim() || null;
    const flowType = session.flowType === 'intrans' ? 'intrans' : 'incoming';

    let tareWeight: number | null = null;
    let netWeight: number | null = null;
    if (flowType === 'incoming') {
      const tare = session.packaging?.tareWeight;
      if (tare == null) {
        if (!fallbackFromOdoo) {
          throw new BadRequestException(
            'Internal incoming weighing requires packaging tare weight',
          );
        }
      } else {
        tareWeight = tare;
        netWeight = roundGrams(grossWeightG - tare);
      }
    }

    const readingData: Prisma.WeighReadingUncheckedCreateInput = {
      sessionId: session.id,
      weight: grossWeightG,
      unit: 'g',
      stable: true,
      rawLine: snapshot.rawLine ?? null,
      capturedAt: snapshot.capturedAt
        ? new Date(snapshot.capturedAt)
        : new Date(),
      savedAt: new Date(),
      packageUid,
      grossWeight: grossWeightG,
      tareWeight,
      netWeight,
      weightStatus: 'local',
      odooMessage: fallbackFromOdoo
        ? 'Saved locally after Odoo submission failed'
        : 'Saved locally (internal)',
    };

    const saved = await this.persistReading(session.id, readingData);
    if (!saved) {
      const winner = await this.prisma.weighReading.findFirst({
        where: { sessionId: session.id, savedAt: { not: null } },
        orderBy: { savedAt: 'desc' },
      });
      if (winner) {
        const advance = await this.advanceForSession(session);
        return this.toConfirmResult(session, winner, advance);
      }
      throw new BadRequestException('Session has already ended');
    }

    await this.triggerCloudSync(saved.reading, session, session.userId);
    return this.toConfirmResult(session, saved.reading, saved);
  }

  private async submitOdooWeight(
    session: Pick<
      WeighSession,
      'flowType' | 'weighingMethod' | 'labelMetadata' | 'scaleName'
    >,
    packageUid: string,
    grossWeightG: number,
  ): Promise<{
    result: OdooWeightSuccess;
    packageUid: string | null;
    weightStatus: string | null;
  }> {
    const uid = packageUid.trim();
    const incomingOdoo =
      session.flowType === 'incoming' && session.weighingMethod === 'odoo';
    if (!incomingOdoo) {
      if (!uid) {
        throw new BadRequestException('LPN is required before sending to Odoo');
      }
      const result = await this.odooWeighing.submitWeight(uid, grossWeightG);
      return {
        result,
        packageUid: uid,
        weightStatus: result.weight_status ?? null,
      };
    }

    const meta = readIncomingOdooMeta(session.labelMetadata);
    this.assertIncomingOdooReady(meta, uid, grossWeightG);
    const deviceUid = session.scaleName?.trim();
    if (!deviceUid) {
      throw new BadRequestException('device_uid is required');
    }
    const result = await this.odooWeighing.submitWeight(uid, grossWeightG, {
      weighingType: meta.weighingType,
      deviceUid,
      qcRecord: meta.qcRecord,
      tareWeightG: meta.sampleTareG,
    });
    return {
      result,
      packageUid: uid || null,
      weightStatus:
        result.weight_status ||
        (meta.weighingType === 'inbound' ? null : 'pending'),
    };
  }

  private assertIncomingOdooReady(
    meta: IncomingOdooMeta,
    packageUid: string,
    grossWeightG: number,
  ) {
    if (meta.weighingType === 'qc_sample') {
      if (!meta.qcRecord) {
        throw new BadRequestException('qc_reference is required');
      }
      if (meta.sampleTareG == null || meta.sampleTareG < 0) {
        throw new BadRequestException('tare_weight must be >= 0');
      }
      if (!(grossWeightG > meta.sampleTareG)) {
        throw new BadRequestException(
          'tare_weight must be less than gross_weight',
        );
      }
      return;
    }
    if (!packageUid) {
      throw new BadRequestException('Session has no LPN (packageUid)');
    }
  }

  private async triggerCloudSync(
    reading: WeighReading,
    session: WeighSession,
    userId: number,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    this.cloudSync.scheduleSyncReading(
      reading,
      session,
      user?.username || 'unknown',
    );
  }

  private async advanceForSession(session: {
    id: number;
    batchGroupId: string | null;
  }): Promise<BatchAdvance> {
    if (!session.batchGroupId) {
      return { nextSession: null, batchQueue: [] };
    }
    return this.sessions.describeBatchQueue(session.batchGroupId, session.id);
  }

  private async persistReading(
    sessionId: number,
    readingData: Prisma.WeighReadingUncheckedCreateInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.weighSession.findUnique({
        where: { id: sessionId },
      });
      if (!current || current.endedAt) return null;
      if (current.queueStatus === QUEUE_PENDING) {
        throw new BadRequestException('This batch item is still waiting');
      }

      const ended = await tx.weighSession.updateMany({
        where: { id: sessionId, endedAt: null },
        data: {
          endedAt: new Date(),
          ...(current.batchGroupId ? { queueStatus: QUEUE_DONE } : {}),
        },
      });

      if (ended.count === 0) {
        return null;
      }

      const reading = await tx.weighReading.create({ data: readingData });
      const advance = await this.sessions.promoteNextBatchItem(tx, current);
      return { reading, ...advance };
    });
  }

  private toConfirmResult(
    session: Pick<WeighSession, 'packageUid' | 'weighingMethod' | 'flowType'>,
    reading: WeighReading,
    advance?: BatchAdvance,
  ) {
    return {
      success: true,
      readingId: reading.id,
      packageUid: reading.packageUid || session.packageUid || '',
      grossWeight: reading.grossWeight,
      tareWeight: reading.tareWeight,
      netWeight: reading.netWeight,
      weightStatus: reading.weightStatus,
      message: reading.odooMessage,
      logId: reading.odooLogId,
      packageId: reading.odooPackageId,
      weighingMethod: session.weighingMethod,
      flowType: session.flowType,
      syncedToOdoo: reading.odooLogId != null,
      nextSession: advance?.nextSession ?? null,
      batchQueue: advance?.batchQueue ?? [],
    };
  }
}

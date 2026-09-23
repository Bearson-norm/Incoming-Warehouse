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
      return this.toConfirmResult(session, existing);
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

    if (reading.session.weighingMethod !== 'internal') {
      throw new BadRequestException(
        'Only internal weighings can be sent to Odoo from this action',
      );
    }

    if (reading.odooLogId) {
      return this.toConfirmResult(reading.session, reading);
    }

    const packageUid = (
      reading.packageUid ||
      reading.session.packageUid ||
      ''
    ).trim();
    if (!packageUid) {
      throw new BadRequestException('LPN is required before sending to Odoo');
    }

    const unit = reading.unit || 'kg';
    const grossSource = reading.grossWeight ?? reading.weight;
    const grossWeightKg = this.odooWeighing.toGrossWeightKg(grossSource, unit);
    const odooResult = await this.odooWeighing.submitWeight(
      packageUid,
      grossWeightKg,
    );

    const updated = await this.prisma.weighReading.update({
      where: { id: reading.id },
      data: {
        packageUid,
        odooLogId: odooResult.log_id,
        odooPackageId: odooResult.package_id,
        grossWeight: odooResult.gross_weight,
        tareWeight: odooResult.tare_weight,
        netWeight: odooResult.net_weight,
        weightStatus: odooResult.weight_status,
        odooMessage: odooResult.message,
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
    const packageUid = session.packageUid?.trim();
    if (!packageUid) {
      throw new BadRequestException('Session has no LPN (packageUid)');
    }

    const unit = snapshot.unit || 'kg';
    const grossWeightKg = this.odooWeighing.toGrossWeightKg(
      snapshot.weight,
      unit,
    );
    const odooResult = await this.odooWeighing.submitWeight(
      packageUid,
      grossWeightKg,
    );

    const readingData: Prisma.WeighReadingUncheckedCreateInput = {
      sessionId: session.id,
      weight: snapshot.weight,
      unit,
      stable: true,
      rawLine: snapshot.rawLine ?? null,
      capturedAt: snapshot.capturedAt
        ? new Date(snapshot.capturedAt)
        : new Date(),
      savedAt: new Date(),
      packageUid,
      odooLogId: odooResult.log_id,
      odooPackageId: odooResult.package_id,
      grossWeight: odooResult.gross_weight,
      tareWeight: odooResult.tare_weight,
      netWeight: odooResult.net_weight,
      weightStatus: odooResult.weight_status,
      odooMessage: odooResult.message,
    };

    let lastDbError: Error | null = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const reading = await this.persistReading(session.id, readingData);
        if (reading) {
          await this.triggerCloudSync(reading, session, session.userId);
          return this.toConfirmResult(session, reading);
        }
        const winner = await this.prisma.weighReading.findFirst({
          where: { sessionId: session.id, savedAt: { not: null } },
          orderBy: { savedAt: 'desc' },
        });
        if (winner) {
          return this.toConfirmResult(session, winner);
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
  ) {
    const unit = snapshot.unit || 'kg';
    const grossWeightKg = this.odooWeighing.toGrossWeightKg(
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
        throw new BadRequestException(
          'Internal incoming weighing requires packaging tare weight',
        );
      }
      tareWeight = tare;
      netWeight = Math.round((grossWeightKg - tare) * 1000) / 1000;
    }

    const readingData: Prisma.WeighReadingUncheckedCreateInput = {
      sessionId: session.id,
      weight: snapshot.weight,
      unit,
      stable: true,
      rawLine: snapshot.rawLine ?? null,
      capturedAt: snapshot.capturedAt
        ? new Date(snapshot.capturedAt)
        : new Date(),
      savedAt: new Date(),
      packageUid,
      grossWeight: grossWeightKg,
      tareWeight,
      netWeight,
      weightStatus: 'local',
      odooMessage: 'Saved locally (internal)',
    };

    const reading = await this.persistReading(session.id, readingData);
    if (!reading) {
      const winner = await this.prisma.weighReading.findFirst({
        where: { sessionId: session.id, savedAt: { not: null } },
        orderBy: { savedAt: 'desc' },
      });
      if (winner) {
        return this.toConfirmResult(session, winner);
      }
      throw new BadRequestException('Session has already ended');
    }

    await this.triggerCloudSync(reading, session, session.userId);
    return this.toConfirmResult(session, reading);
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

  private async persistReading(
    sessionId: number,
    readingData: Prisma.WeighReadingUncheckedCreateInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ended = await tx.weighSession.updateMany({
        where: { id: sessionId, endedAt: null },
        data: { endedAt: new Date() },
      });

      if (ended.count === 0) {
        return null;
      }

      return tx.weighReading.create({ data: readingData });
    });
  }

  private toConfirmResult(
    session: Pick<WeighSession, 'packageUid' | 'weighingMethod' | 'flowType'>,
    reading: WeighReading,
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
    };
  }
}

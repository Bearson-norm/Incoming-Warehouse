import { randomUUID } from 'crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, WeighSession } from '@prisma/client';
import { CreateSessionDto } from './dto/create-session.dto';
import { WeightSnapshotStore } from '../websocket/weight-snapshot.store';
import { CloudSyncService } from '../cloud/cloud-sync.service';
import {
  appendIncomingLpnSequence,
  buildIncomingLpnFromInputs,
  incomingLpnSequenceSuffixLength,
} from '../lpn/incoming-lpn';
import { parsePackageUidInput } from '../lpn/parse-package-uid';
import { readIncomingOdooMeta } from '../odoo/incoming-odoo-process';

const LPN_REGEX = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;
const BATCH_QUANTITY_MIN = 2;
const BATCH_QUANTITY_MAX = 30;
export const QUEUE_ACTIVE = 'active';
export const QUEUE_PENDING = 'pending';
export const QUEUE_DONE = 'done';

export type BatchQueueItem = {
  id: number;
  packageUid: string | null;
  batchSequence: number | null;
  queueStatus: string | null;
};

export type BatchAdvance = {
  nextSession: (WeighSession & { batchQueue: BatchQueueItem[] }) | null;
  batchQueue: BatchQueueItem[];
};

type SessionDraft = {
  packageUid: string | null;
  vendorId: number | null;
  packagingId: number | null;
  rmCodeId: number | null;
  scaleId: number;
  scaleName: string;
  weighingMethod: string;
  flowType: string;
  userId: number;
  autosaveEnabled: boolean;
  batchGroupId: string | null;
  batchSequence: number | null;
  batchSize: number | null;
  queueStatus: string | null;
  labelMetadata?: string;
};

const queueSelect = {
  id: true,
  packageUid: true,
  batchSequence: true,
  queueStatus: true,
} as const;

const sessionInclude = {
  vendor: true,
  packaging: true,
  rmCode: true,
  user: {
    select: {
      id: true,
      username: true,
    },
  },
} as const;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private prisma: PrismaService,
    private snapshots: WeightSnapshotStore,
    private cloudSync: CloudSyncService,
  ) {}

  private assertLpn(
    packageUid: string | undefined,
    required: boolean,
  ): string | null {
    const parsed = parsePackageUidInput(packageUid);
    if (parsed.kind === 'empty') {
      if (required) {
        throw new BadRequestException('LPN (packageUid) is required');
      }
      return null;
    }
    if (parsed.kind === 'reject') {
      throw new BadRequestException(parsed.message);
    }
    if (parsed.uid.length > 64 || !LPN_REGEX.test(parsed.uid)) {
      throw new BadRequestException(
        'packageUid must start with a letter or digit and may contain letters, digits, /, _, or -',
      );
    }
    return parsed.uid;
  }

  private async assertIncomingLpnUnique(packageUid: string | null) {
    if (!packageUid) return;
    const existing = await this.prisma.weighSession.findMany({
      where: { flowType: 'incoming', packageUid: { not: null } },
      select: { id: true, packageUid: true },
    });
    if (
      existing.some(
        (row) => row.packageUid?.trim().toUpperCase() === packageUid,
      )
    ) {
      throw new ConflictException(`LPN ${packageUid} sudah pernah digunakan`);
    }
  }

  private assertInternalLabelMetadata(meta: Record<string, unknown> | undefined) {
    const reference = String(meta?.referenceOdoo ?? '').trim();
    const batch = String(meta?.batch ?? '').trim();
    const arrivalAt = String(meta?.arrivalAt ?? '').trim();
    const expiredDate = String(meta?.expiredDate ?? '').trim();
    const poNumber = String(
      meta?.poNumber ?? meta?.poAdj ?? '',
    ).trim();
    if (!reference) {
      throw new BadRequestException(
        'Internal incoming requires reference (referenceOdoo)',
      );
    }
    if (!poNumber) {
      throw new BadRequestException('Internal incoming requires PO number');
    }
    if (!batch) {
      throw new BadRequestException('Internal incoming requires batch');
    }
    if (!arrivalAt || Number.isNaN(new Date(arrivalAt).getTime())) {
      throw new BadRequestException(
        'Internal incoming requires a valid arrival date',
      );
    }
    if (!expiredDate || Number.isNaN(new Date(expiredDate).getTime())) {
      throw new BadRequestException(
        'Internal incoming requires a valid expired date',
      );
    }
    return { reference, batch, arrivalAt, expiredDate, poNumber };
  }

  /** Allocate internal incoming LPN (used by session create and label repair). */
  async allocateInternalIncomingLpn(
    reference: string,
    batch: string,
    rmCode: string,
  ): Promise<{ lpn: string }> {
    return this.generateInternalIncomingLpn(reference, batch, rmCode);
  }

  private async generateInternalIncomingLpn(
    reference: string,
    batch: string,
    rmCode: string,
    reservedSuffixLength = 0,
  ): Promise<{ lpn: string }> {
    const { lpn } = buildIncomingLpnFromInputs({
      reference,
      batch,
      rmCode,
      reservedSuffixLength,
    });
    await this.assertIncomingLpnUnique(lpn);
    return { lpn };
  }

  private async allocateBatchIncomingLpns(
    reference: string,
    batch: string,
    rmCode: string,
    batchQuantity: number,
  ): Promise<string[]> {
    const reservedSuffixLength = incomingLpnSequenceSuffixLength(batchQuantity);
    const { lpn: base } = buildIncomingLpnFromInputs({
      reference,
      batch,
      rmCode,
      reservedSuffixLength,
    });
    const allocated: string[] = [];
    for (let index = 1; index <= batchQuantity; index++) {
      const lpn = appendIncomingLpnSequence(base, index);
      await this.assertIncomingLpnUnique(lpn);
      if (allocated.some((existing) => existing === lpn)) {
        throw new ConflictException(`LPN ${lpn} sudah pernah digunakan`);
      }
      allocated.push(lpn);
    }
    return allocated;
  }

  private resolveBatchQuantity(
    batchQuantity: number | undefined,
    weighingMethod: string,
    flowType: string,
  ): number {
    if (batchQuantity == null) return 1;
    if (weighingMethod !== 'internal' || flowType !== 'incoming') {
      throw new BadRequestException(
        'Batch weighing is only available for internal incoming',
      );
    }
    if (
      !Number.isInteger(batchQuantity) ||
      batchQuantity < BATCH_QUANTITY_MIN ||
      batchQuantity > BATCH_QUANTITY_MAX
    ) {
      throw new BadRequestException(
        'Batch quantity must be an integer from 2 to 30',
      );
    }
    return batchQuantity;
  }

  private async listBatchQueue(
    db: Prisma.TransactionClient | PrismaService,
    groupId: string,
  ): Promise<BatchQueueItem[]> {
    const rows = await db.weighSession.findMany({
      where: { batchGroupId: groupId },
      orderBy: { batchSequence: 'asc' },
      select: queueSelect,
    });
    return rows.map((row) => ({
      id: row.id,
      packageUid: row.packageUid,
      batchSequence: row.batchSequence,
      queueStatus: row.queueStatus,
    }));
  }

  /** After the current batch item is saved, activate the next pending item. */
  async promoteNextBatchItem(
    tx: Prisma.TransactionClient,
    session: { id: number; batchGroupId: string | null },
  ): Promise<BatchAdvance> {
    if (!session.batchGroupId) {
      return { nextSession: null, batchQueue: [] };
    }

    const pending = await tx.weighSession.findFirst({
      where: {
        batchGroupId: session.batchGroupId,
        queueStatus: QUEUE_PENDING,
        endedAt: null,
      },
      orderBy: { batchSequence: 'asc' },
    });

    let promoted: WeighSession | null = null;
    if (pending) {
      promoted = await tx.weighSession.update({
        where: { id: pending.id },
        data: { queueStatus: QUEUE_ACTIVE },
        include: {
          vendor: true,
          packaging: true,
          rmCode: true,
        },
      });
    }

    const batchQueue = await this.listBatchQueue(tx, session.batchGroupId);
    return {
      nextSession: promoted ? { ...promoted, batchQueue } : null,
      batchQueue,
    };
  }

  /** Read the queue after a save that already promoted the next item. */
  async describeBatchQueue(
    groupId: string,
    currentSessionId: number,
  ): Promise<BatchAdvance> {
    const batchQueue = await this.listBatchQueue(this.prisma, groupId);
    const active = batchQueue.find(
      (item) =>
        item.queueStatus === QUEUE_ACTIVE && item.id !== currentSessionId,
    );
    if (!active) {
      return { nextSession: null, batchQueue };
    }
    const next = await this.prisma.weighSession.findUnique({
      where: { id: active.id },
      include: {
        vendor: true,
        packaging: true,
        rmCode: true,
      },
    });
    if (!next || next.endedAt) {
      return { nextSession: null, batchQueue };
    }
    return { nextSession: { ...next, batchQueue }, batchQueue };
  }

  async create(userId: number, dto: CreateSessionDto) {
    const weighingMethod =
      dto.weighingMethod === 'internal' ? 'internal' : 'odoo';
    const flowType = dto.flowType === 'intrans' ? 'intrans' : 'incoming';
    const batchQuantity = this.resolveBatchQuantity(
      dto.batchQuantity,
      weighingMethod,
      flowType,
    );

    let vendorId: number | null = dto.vendorId ?? null;
    let packagingId: number | null = dto.packagingId ?? null;
    let rmCodeId: number | null = dto.rmCodeId ?? null;

    const scaleId = dto.scaleId;
    const scaleName = dto.scaleName?.trim();
    if (!scaleId || !scaleName) {
      throw new BadRequestException(
        'Scale selection is required before starting a session',
      );
    }

    let incomingOdooType: 'inbound' | 'qc_sample' | 'production' | null = null;
    const drafts: SessionDraft[] = [];

    const sharedDraft = {
      vendorId,
      packagingId,
      rmCodeId,
      scaleId,
      scaleName,
      weighingMethod,
      flowType,
      userId,
      autosaveEnabled: dto.autosaveEnabled ?? false,
      batchGroupId: null as string | null,
      batchSequence: null as number | null,
      batchSize: null as number | null,
      queueStatus: null as string | null,
    };

    if (flowType === 'intrans') {
      drafts.push({
        ...sharedDraft,
        packageUid: this.assertLpn(dto.packageUid, true),
        vendorId: null,
        packagingId: null,
        rmCodeId: null,
      });
    } else if (weighingMethod === 'odoo') {
      const odooMeta = readIncomingOdooMeta(dto.labelMetadata);
      incomingOdooType = odooMeta.weighingType;
      let packageUid: string | null;
      if (odooMeta.weighingType === 'qc_sample') {
        if (!odooMeta.qcRecord) {
          throw new BadRequestException('qc_reference is required');
        }
        if (odooMeta.sampleTareG == null || odooMeta.sampleTareG < 0) {
          throw new BadRequestException('tare_weight must be >= 0');
        }
        packageUid = this.assertLpn(dto.packageUid, false);
      } else {
        packageUid = this.assertLpn(dto.packageUid, true);
      }
      const nextMetadata: Record<string, unknown> = {
        ...(dto.labelMetadata ?? {}),
        odooWeighingType: odooMeta.weighingType,
      };
      delete nextMetadata.sampleTareKg;
      if (odooMeta.weighingType === 'qc_sample') {
        nextMetadata.qcRecord = odooMeta.qcRecord;
        nextMetadata.sampleTareG = odooMeta.sampleTareG;
      }
      dto.labelMetadata = nextMetadata;
      drafts.push({
        ...sharedDraft,
        packageUid,
        ...(dto.labelMetadata != null
          ? { labelMetadata: JSON.stringify(dto.labelMetadata) }
          : {}),
      });
    } else {
      if (!vendorId || !packagingId || !rmCodeId) {
        throw new BadRequestException(
          'Internal incoming weighing requires vendor, packaging, and RM code',
        );
      }
      const labelFields = this.assertInternalLabelMetadata(dto.labelMetadata);
      const packaging = await this.prisma.packaging.findUnique({
        where: { id: packagingId },
      });
      if (!packaging) {
        throw new BadRequestException('Packaging not found');
      }
      if (packaging.tareWeight == null) {
        throw new BadRequestException('Selected packaging has no tare weight');
      }
      const rm = await this.prisma.rmCode.findUnique({
        where: { id: rmCodeId },
      });
      if (!rm) {
        throw new BadRequestException('RM code not found');
      }
      if (rm.vendorId != null && rm.vendorId !== vendorId) {
        throw new BadRequestException(
          'RM code does not belong to the selected vendor',
        );
      }
      const batchGroupId = batchQuantity > 1 ? randomUUID() : null;
      const lpns =
        batchQuantity > 1
          ? await this.allocateBatchIncomingLpns(
              labelFields.reference,
              labelFields.batch,
              rm.code,
              batchQuantity,
            )
          : [
              (
                await this.generateInternalIncomingLpn(
                  labelFields.reference,
                  labelFields.batch,
                  rm.code,
                )
              ).lpn,
            ];
      const baseMeta = {
        ...(dto.labelMetadata ?? {}),
        referenceOdoo: labelFields.reference,
        poNumber: labelFields.poNumber,
        batch: labelFields.batch,
        arrivalAt: labelFields.arrivalAt,
        expiredDate: labelFields.expiredDate,
      };
      lpns.forEach((lpn, index) => {
        drafts.push({
          ...sharedDraft,
          packageUid: lpn,
          batchGroupId,
          batchSequence: batchGroupId ? index + 1 : null,
          batchSize: batchGroupId ? batchQuantity : null,
          queueStatus: batchGroupId
            ? index === 0
              ? QUEUE_ACTIVE
              : QUEUE_PENDING
            : null,
          labelMetadata: JSON.stringify({
            ...baseMeta,
            labelProductNumber: lpn,
          }),
        });
      });
    }

    if (
      flowType === 'incoming' &&
      weighingMethod === 'odoo' &&
      incomingOdooType === 'inbound'
    ) {
      await this.assertIncomingLpnUnique(drafts[0]?.packageUid ?? null);
    }

    const createdSessions = await this.prisma.$transaction(async (tx) => {
      await tx.weighSession.updateMany({
        where: {
          userId,
          endedAt: null,
        },
        data: {
          endedAt: new Date(),
        },
      });

      const rows = [];
      for (const draft of drafts) {
        try {
          rows.push(
            await tx.weighSession.create({
              data: draft,
              include: sessionInclude,
            }),
          );
        } catch (error) {
          if (
            draft.packageUid &&
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new ConflictException(
              `LPN ${draft.packageUid} sudah pernah digunakan`,
            );
          }
          throw error;
        }
      }
      return rows;
    });

    for (const created of createdSessions) {
      this.cloudSync.scheduleTraceEvent(
        created,
        created.user.username,
        'SESSION_CREATED',
        `session-${created.id}-created`,
        {
          flowType: created.flowType,
          weighingMethod: created.weighingMethod,
          vendorCloudId: created.vendor?.cloudId,
          vendorSnapshot: created.vendor?.name,
          packagingCloudId: created.packaging?.cloudId,
          packagingSnapshot: created.packaging?.name,
          rmCodeCloudId: created.rmCode?.cloudId,
          rmCodeSnapshot: created.rmCode?.code,
        },
      );
    }

    const active = createdSessions[0];
    if (!active.batchGroupId) return active;
    return {
      ...active,
      batchQueue: createdSessions.map((row) => ({
        id: row.id,
        packageUid: row.packageUid,
        batchSequence: row.batchSequence,
        queueStatus: row.queueStatus,
      })),
    };
  }

  async findActive(userId: number, flowType?: string) {
    try {
      const session = await this.prisma.weighSession.findFirst({
        where: {
          userId,
          endedAt: null,
          OR: [{ queueStatus: null }, { queueStatus: QUEUE_ACTIVE }],
          ...(flowType === 'incoming' || flowType === 'intrans'
            ? { flowType }
            : {}),
        },
        orderBy: { id: 'asc' },
        include: {
          vendor: true,
          packaging: true,
          rmCode: true,
        },
      });
      if (!session?.batchGroupId) return session;
      const batchQueue = await this.listBatchQueue(
        this.prisma,
        session.batchGroupId,
      );
      return { ...session, batchQueue };
    } catch (error) {
      this.logger.warn(
        `Active session lookup skipped (database unavailable): ${(error as Error).message}`,
      );
      return null;
    }
  }

  async findAll(userId?: number) {
    const where = userId ? { userId } : {};
    return this.prisma.weighSession.findMany({
      where,
      include: {
        ...sessionInclude,
        _count: {
          select: {
            readings: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
  }

  async findOne(id: number, requester: { userId: number; role: string }) {
    const session = await this.prisma.weighSession.findUnique({
      where: { id },
      include: {
        ...sessionInclude,
        readings: {
          orderBy: {
            capturedAt: 'desc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (requester.role !== 'admin' && session.userId !== requester.userId) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async startWeighing(id: number, userId: number) {
    const session = await this.prisma.weighSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    if (session.endedAt) {
      throw new BadRequestException('Session has already ended');
    }

    if (session.queueStatus === QUEUE_PENDING) {
      throw new BadRequestException('This batch item is still waiting');
    }

    const snapshot = this.snapshots.getFreshStable(session.gatewayId);
    if (!snapshot) {
      throw new BadRequestException(
        'No stable scale reading. Wait for a live stable weight before starting.',
      );
    }

    const updated = await this.prisma.weighSession.update({
      where: { id },
      data: {
        weighingStarted: true,
        gatewayId: snapshot.gatewayId,
      },
      include: {
        vendor: true,
        packaging: true,
        rmCode: true,
        user: { select: { username: true } },
      },
    });
    this.cloudSync.scheduleTraceEvent(
      updated,
      updated.user.username,
      'RECORDING_STARTED',
      `session-${updated.id}-recording-started`,
      { gatewayId: updated.gatewayId },
    );
    return updated;
  }

  async end(id: number, userId: number) {
    const session = await this.prisma.weighSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    if (session.batchGroupId) {
      await this.prisma.weighSession.updateMany({
        where: {
          batchGroupId: session.batchGroupId,
          userId,
          endedAt: null,
          queueStatus: { in: [QUEUE_ACTIVE, QUEUE_PENDING] },
        },
        data: { endedAt: new Date() },
      });
      return this.prisma.weighSession.findUnique({
        where: { id },
        include: {
          vendor: true,
          packaging: true,
          rmCode: true,
        },
      });
    }

    return this.prisma.weighSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
      },
      include: {
        vendor: true,
        packaging: true,
        rmCode: true,
      },
    });
  }
}

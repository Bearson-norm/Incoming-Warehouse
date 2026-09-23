import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudClientService } from './cloud-client.service';
import { CloudSettingsService } from './cloud-settings.service';
import {
  CreateCloudMasterDataDto,
  MasterEntityType,
  UpdateCloudMasterDataDto,
} from './dto/cloud-master-data.dto';

export type AuditActor = {
  userId?: number;
  username: string;
  stationId?: string;
  deviceId?: string;
  requestId?: string;
};

type AuditDb = {
  masterDataAuditEvent: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
  };
};

type SyncDb = {
  masterDataSyncState: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown | null>;
  };
};

type MasterSnapshot = {
  vendors: Array<Record<string, any>>;
  packagings: Array<Record<string, any>>;
  rmCodes: Array<Record<string, any>>;
  cursor: string;
  generatedAt: string;
};

@Injectable()
export class CloudMasterDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CloudMasterDataService.name);
  private syncTimer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private settings: CloudSettingsService,
    private client: CloudClientService,
  ) {}

  onModuleInit() {
    if (!this.settings.isRemoteMode()) return;
    setTimeout(() => void this.syncCache(), 2_000).unref();
    this.syncTimer = setInterval(() => void this.syncCache(), 5 * 60_000);
    this.syncTimer.unref();
  }

  onModuleDestroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  async listSnapshot(since?: string): Promise<MasterSnapshot> {
    const watermark = new Date();
    const sinceDate = since ? new Date(since) : undefined;
    if (sinceDate && Number.isNaN(sinceDate.getTime())) {
      throw new BadRequestException('Invalid master-data cursor');
    }
    const updatedAt = sinceDate
      ? { gt: sinceDate, lte: watermark }
      : { lte: watermark };

    const [vendors, packagings, rmCodes] = await Promise.all([
      this.prisma.vendor.findMany({ where: { updatedAt } }),
      this.prisma.packaging.findMany({
        where: { updatedAt },
        include: { vendor: { select: { cloudId: true } } },
      }),
      this.prisma.rmCode.findMany({ where: { updatedAt } }),
    ]);
    return {
      vendors,
      packagings: packagings.map(({ vendor, ...packaging }) => ({
        ...packaging,
        vendorCloudId: vendor.cloudId,
      })),
      rmCodes,
      cursor: watermark.toISOString(),
      generatedAt: watermark.toISOString(),
    };
  }

  async getHistory(entityType: MasterEntityType, cloudId: string) {
    return (this.prisma as unknown as AuditDb).masterDataAuditEvent.findMany({
      where: { entityType, entityCloudId: cloudId },
      orderBy: { revision: 'desc' },
    });
  }

  async create(dto: CreateCloudMasterDataDto, actor: AuditActor) {
    this.assertReason(dto.reason);
    return this.prisma.$transaction(async (tx) => {
      let created: Record<string, any>;
      if (dto.entityType === 'vendor') {
        created = await tx.vendor.create({
          data: { name: this.required(dto.name, 'Vendor name') },
        });
      } else if (dto.entityType === 'packaging') {
        const vendor = await tx.vendor.findFirst({
          where: {
            cloudId: this.required(dto.vendorCloudId, 'Vendor'),
            deletedAt: null,
          },
        });
        if (!vendor)
          throw new BadRequestException('Vendor not found or inactive');
        created = await tx.packaging.create({
          data: {
            vendorId: vendor.id,
            name: this.required(dto.name, 'Packaging name'),
            tareWeight: dto.tareWeight ?? null,
            metadata: this.serializeMetadata(dto.metadata),
          },
        });
      } else {
        created = await tx.rmCode.create({
          data: {
            code: this.required(dto.code, 'RM code'),
            name: dto.name?.trim() || null,
            issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : new Date(),
          },
        });
      }
      await this.appendAudit(
        tx,
        dto.entityType,
        created,
        'create',
        null,
        dto.reason,
        actor,
      );
      return created;
    });
  }

  async update(
    entityType: MasterEntityType,
    cloudId: string,
    dto: UpdateCloudMasterDataDto,
    actor: AuditActor,
  ) {
    this.assertReason(dto.reason);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findEntity(tx, entityType, cloudId);
      if (!before) throw new NotFoundException(`${entityType} not found`);
      if (before.revision !== dto.expectedRevision) {
        throw new ConflictException({
          message: 'Master data was changed by another administrator',
          current: before,
        });
      }

      const data = await this.buildUpdateData(tx, entityType, dto);
      const delegate = this.delegate(tx, entityType);
      const changed = await delegate.updateMany({
        where: { cloudId, revision: dto.expectedRevision },
        data: { ...data, revision: { increment: 1 } },
      });
      if (changed.count !== 1) {
        const current = await this.findEntity(tx, entityType, cloudId);
        throw new ConflictException({
          message: 'Master data was changed by another administrator',
          current,
        });
      }
      const after = await this.findEntity(tx, entityType, cloudId);
      await this.appendAudit(
        tx,
        entityType,
        after!,
        'update',
        before,
        dto.reason,
        actor,
      );
      return after;
    });
  }

  async remove(
    entityType: MasterEntityType,
    cloudId: string,
    expectedRevision: number,
    reason: string,
    actor: AuditActor,
  ) {
    this.assertReason(reason);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findEntity(tx, entityType, cloudId);
      if (!before) throw new NotFoundException(`${entityType} not found`);
      if (before.revision !== expectedRevision) {
        throw new ConflictException({
          message: 'Revision conflict',
          current: before,
        });
      }
      if (entityType === 'vendor') {
        const activePackagings = await tx.packaging.count({
          where: { vendorId: before.id, deletedAt: null },
        });
        if (activePackagings > 0) {
          throw new BadRequestException(
            'Deactivate all packaging for this vendor before deactivating the vendor',
          );
        }
      }
      const delegate = this.delegate(tx, entityType);
      const changed = await delegate.updateMany({
        where: { cloudId, revision: expectedRevision },
        data: { deletedAt: new Date(), revision: { increment: 1 } },
      });
      if (changed.count !== 1) {
        throw new ConflictException('Revision conflict');
      }
      const after = await this.findEntity(tx, entityType, cloudId);
      await this.appendAudit(
        tx,
        entityType,
        after!,
        'delete',
        before,
        reason,
        actor,
      );
      return after;
    });
  }

  async syncCache() {
    if (!this.settings.isRemoteMode()) {
      return { synced: false, reason: 'not-remote' };
    }
    const syncDb = this.prisma as unknown as SyncDb;
    const state = (await syncDb.masterDataSyncState.findUnique({
      where: { id: 1 },
    })) as { cursor?: string | null } | null;
    try {
      const snapshot = await this.client.fetchMasterData(
        state?.cursor || undefined,
      );
      await this.applySnapshot(snapshot);
      await syncDb.masterDataSyncState.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          cursor: snapshot.cursor,
          lastSyncedAt: new Date(),
          lastError: null,
        },
        update: {
          cursor: snapshot.cursor,
          lastSyncedAt: new Date(),
          lastError: null,
        },
      });
      return { synced: true, cursor: snapshot.cursor };
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      await syncDb.masterDataSyncState.upsert({
        where: { id: 1 },
        create: { id: 1, lastError: message },
        update: { lastError: message },
      });
      this.logger.warn(`Master-data sync failed: ${message}`);
      throw error;
    }
  }

  async getSyncStatus() {
    if (!this.settings.isRemoteMode()) {
      return { source: 'cloud', stale: false };
    }
    const row = (await (
      this.prisma as unknown as SyncDb
    ).masterDataSyncState.findUnique({
      where: { id: 1 },
    })) as Record<string, unknown> | null;
    return { source: 'cache', stale: !row?.lastSyncedAt, ...row };
  }

  private async applySnapshot(snapshot: MasterSnapshot) {
    await this.prisma.$transaction(async (tx) => {
      for (const vendor of snapshot.vendors) {
        await tx.vendor.upsert({
          where: { cloudId: vendor.cloudId },
          create: {
            cloudId: vendor.cloudId,
            name: vendor.name,
            revision: vendor.revision,
            deletedAt: vendor.deletedAt ? new Date(vendor.deletedAt) : null,
            createdAt: new Date(vendor.createdAt),
            updatedAt: new Date(vendor.updatedAt),
          },
          update: {
            name: vendor.name,
            revision: vendor.revision,
            deletedAt: vendor.deletedAt ? new Date(vendor.deletedAt) : null,
            updatedAt: new Date(vendor.updatedAt),
          },
        });
      }
      for (const packaging of snapshot.packagings) {
        const vendor = await tx.vendor.findUnique({
          where: {
            cloudId:
              packaging.vendorCloudId ||
              this.vendorCloudId(snapshot, packaging.vendorId),
          },
        });
        if (!vendor) continue;
        await tx.packaging.upsert({
          where: { cloudId: packaging.cloudId },
          create: {
            cloudId: packaging.cloudId,
            vendorId: vendor.id,
            name: packaging.name,
            tareWeight: packaging.tareWeight,
            metadata: packaging.metadata,
            revision: packaging.revision,
            deletedAt: packaging.deletedAt
              ? new Date(packaging.deletedAt)
              : null,
            createdAt: new Date(packaging.createdAt),
            updatedAt: new Date(packaging.updatedAt),
          },
          update: {
            vendorId: vendor.id,
            name: packaging.name,
            tareWeight: packaging.tareWeight,
            metadata: packaging.metadata,
            revision: packaging.revision,
            deletedAt: packaging.deletedAt
              ? new Date(packaging.deletedAt)
              : null,
            updatedAt: new Date(packaging.updatedAt),
          },
        });
      }
      for (const rm of snapshot.rmCodes) {
        await tx.rmCode.upsert({
          where: { cloudId: rm.cloudId },
          create: {
            cloudId: rm.cloudId,
            code: rm.code,
            name: rm.name,
            issuedAt: new Date(rm.issuedAt),
            revision: rm.revision,
            deletedAt: rm.deletedAt ? new Date(rm.deletedAt) : null,
            createdAt: new Date(rm.createdAt),
            updatedAt: new Date(rm.updatedAt),
          },
          update: {
            code: rm.code,
            name: rm.name,
            issuedAt: new Date(rm.issuedAt),
            revision: rm.revision,
            deletedAt: rm.deletedAt ? new Date(rm.deletedAt) : null,
            updatedAt: new Date(rm.updatedAt),
          },
        });
      }
    });
  }

  private vendorCloudId(snapshot: MasterSnapshot, vendorId: number) {
    return (
      snapshot.vendors.find((vendor) => vendor.id === vendorId)?.cloudId || ''
    );
  }

  private delegate(
    tx: Prisma.TransactionClient,
    entityType: MasterEntityType,
  ): any {
    if (entityType === 'vendor') return tx.vendor;
    if (entityType === 'packaging') return tx.packaging;
    return tx.rmCode;
  }

  private findEntity(
    tx: Prisma.TransactionClient,
    entityType: MasterEntityType,
    cloudId: string,
  ): Promise<Record<string, any> | null> {
    return this.delegate(tx, entityType).findUnique({ where: { cloudId } });
  }

  private async buildUpdateData(
    tx: Prisma.TransactionClient,
    entityType: MasterEntityType,
    dto: UpdateCloudMasterDataDto,
  ) {
    if (entityType === 'vendor') {
      return dto.name !== undefined
        ? { name: this.required(dto.name, 'Vendor name') }
        : {};
    }
    if (entityType === 'packaging') {
      const data: Record<string, unknown> = {};
      if (dto.name !== undefined)
        data.name = this.required(dto.name, 'Packaging name');
      if (dto.tareWeight !== undefined) data.tareWeight = dto.tareWeight;
      if (dto.metadata !== undefined)
        data.metadata = this.serializeMetadata(dto.metadata);
      if (dto.vendorCloudId) {
        const vendor = await tx.vendor.findFirst({
          where: { cloudId: dto.vendorCloudId, deletedAt: null },
        });
        if (!vendor)
          throw new BadRequestException('Vendor not found or inactive');
        data.vendorId = vendor.id;
      }
      return data;
    }
    return {
      ...(dto.code !== undefined
        ? { code: this.required(dto.code, 'RM code') }
        : {}),
      ...(dto.name !== undefined ? { name: dto.name?.trim() || null } : {}),
      ...(dto.issuedAt !== undefined
        ? { issuedAt: new Date(dto.issuedAt) }
        : {}),
    };
  }

  private async appendAudit(
    tx: Prisma.TransactionClient,
    entityType: MasterEntityType,
    after: Record<string, any>,
    action: string,
    before: Record<string, any> | null,
    reason: string,
    actor: AuditActor,
  ) {
    await (tx as unknown as AuditDb).masterDataAuditEvent.create({
      data: {
        entityType,
        entityCloudId: after.cloudId,
        action,
        revision: after.revision,
        beforeJson: before ? JSON.parse(JSON.stringify(before)) : null,
        afterJson: JSON.parse(JSON.stringify(after)),
        reason: reason.trim(),
        actorUserId: actor.userId,
        actorUsername: actor.username,
        stationId: actor.stationId,
        deviceId: actor.deviceId,
        requestId: actor.requestId,
      },
    });
  }

  private serializeMetadata(value: unknown) {
    if (value === undefined || value === null) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  private required(value: string | undefined, label: string) {
    const normalized = value?.trim();
    if (!normalized) throw new BadRequestException(`${label} is required`);
    return normalized;
  }

  private assertReason(reason: string) {
    if (reason.trim().length < 3) {
      throw new BadRequestException(
        'Change reason must contain at least 3 characters',
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { WeighReading, WeighSession, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudSettingsService } from './cloud-settings.service';
import { CloudStorageService } from './cloud-storage.service';
import { CloudClientService } from './cloud-client.service';
import { IngestCloudReadingDto } from './dto/ingest-cloud-reading.dto';
import { IngestLpnTraceDto } from './dto/ingest-lpn-trace.dto';

type SessionWithUser = WeighSession & {
  user?: Pick<User, 'username'>;
};

type TraceOutboxDb = {
  lpnTraceOutbox: {
    upsert: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<Array<Record<string, any>>>;
    update: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
};

@Injectable()
export class CloudSyncService {
  private readonly logger = new Logger(CloudSyncService.name);

  constructor(
    private prisma: PrismaService,
    private cloudSettings: CloudSettingsService,
    private cloudStorage: CloudStorageService,
    private cloudClient: CloudClientService,
  ) {}

  async syncReadingAfterConfirm(
    reading: WeighReading,
    session: SessionWithUser,
    username: string,
  ): Promise<void> {
    if (!session.scaleId || !session.scaleName) {
      return;
    }

    const fullSession = await this.prisma.weighSession.findUnique({
      where: { id: session.id },
      include: { vendor: true, packaging: true, rmCode: true },
    });
    if (!fullSession) return;
    const stationId = this.cloudSettings.getEffective().stationId;
    const eventType = reading.odooLogId
      ? 'ODOO_SUBMITTED'
      : 'WEIGHING_CONFIRMED';
    const localEventId = `reading-${reading.id}-${eventType.toLowerCase()}`;

    const payload: IngestCloudReadingDto = {
      eventId: `${stationId}:${localEventId}`,
      scaleId: session.scaleId,
      scaleName: session.scaleName,
      username,
      stationId,
      deviceId: stationId,
      gatewayId: fullSession.gatewayId || undefined,
      localReadingId: reading.id,
      localSessionId: fullSession.id,
      packageUid: reading.packageUid || session.packageUid || undefined,
      vendorCloudId: fullSession.vendor?.cloudId,
      vendorSnapshot: fullSession.vendor?.name,
      packagingCloudId: fullSession.packaging?.cloudId,
      packagingSnapshot: fullSession.packaging?.name,
      rmCodeCloudId: fullSession.rmCode?.cloudId,
      rmCodeSnapshot: fullSession.rmCode
        ? `${fullSession.rmCode.code}${fullSession.rmCode.name ? ` - ${fullSession.rmCode.name}` : ''}`
        : undefined,
      labelMetadata: fullSession.labelMetadata || undefined,
      odooLogId: reading.odooLogId ?? undefined,
      odooPackageId: reading.odooPackageId ?? undefined,
      flowType: session.flowType === 'intrans' ? 'intrans' : 'incoming',
      weighingMethod:
        session.weighingMethod === 'internal' ? 'internal' : 'odoo',
      weight: reading.weight,
      grossWeight: reading.grossWeight ?? undefined,
      tareWeight: reading.tareWeight ?? undefined,
      netWeight: reading.netWeight ?? undefined,
      unit: reading.unit,
      weightStatus: reading.weightStatus ?? undefined,
      capturedAt: reading.capturedAt.toISOString(),
    };

    try {
      if (this.cloudSettings.isRemoteMode()) {
        await this.cloudClient.ingestReading(payload);
        if (payload.packageUid) {
          await this.cloudClient.ingestTraceEvent({
            stationId,
            localEventId,
            packageUid: payload.packageUid,
            eventType,
            username,
            deviceId: stationId,
            gatewayId: payload.gatewayId,
            scaleId: payload.scaleId,
            scaleName: payload.scaleName,
            sourceAt: payload.capturedAt,
            payload: payload as unknown as Record<string, unknown>,
          });
        }
      } else if (this.cloudSettings.isStorageMode()) {
        await this.cloudStorage.ingestReading(payload);
        if (payload.packageUid) {
          await this.cloudStorage.ingestTraceEvent({
            stationId,
            localEventId,
            packageUid: payload.packageUid,
            eventType,
            username,
            deviceId: stationId,
            gatewayId: payload.gatewayId,
            scaleId: payload.scaleId,
            scaleName: payload.scaleName,
            sourceAt: payload.capturedAt,
            payload: payload as unknown as Record<string, unknown>,
          });
        }
      } else {
        this.logger.warn('Cloud sync skipped: not configured');
        return;
      }

      await this.prisma.weighReading.update({
        where: { id: reading.id },
        data: {
          cloudSyncedAt: new Date(),
          cloudSyncError: null,
        },
      });
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(
        `Cloud sync failed for reading ${reading.id}: ${message}`,
      );
      await this.prisma.weighReading.update({
        where: { id: reading.id },
        data: { cloudSyncError: message.slice(0, 500) },
      });
    }
  }

  scheduleSyncReading(
    reading: WeighReading,
    session: SessionWithUser,
    username: string,
  ): void {
    void this.syncReadingAfterConfirm(reading, session, username);
  }

  async getSyncHealth() {
    const unsyncedReadings = await this.prisma.weighReading.count({
      where: { savedAt: { not: null }, cloudSyncedAt: null },
    });
    const unsyncedTraceEvents = this.cloudSettings.isRemoteMode()
      ? await (this.prisma as unknown as TraceOutboxDb).lpnTraceOutbox.count({
          where: { syncedAt: null },
        })
      : 0;
    return { unsyncedReadings, unsyncedTraceEvents };
  }

  scheduleTraceEvent(
    session: Pick<
      WeighSession,
      'id' | 'packageUid' | 'gatewayId' | 'scaleId' | 'scaleName'
    >,
    username: string,
    eventType: string,
    localEventId: string,
    payload?: Record<string, unknown>,
  ): void {
    const packageUid = session.packageUid?.trim();
    if (!packageUid) return;
    void this.syncTraceEvent({
      stationId: this.cloudSettings.getEffective().stationId,
      localEventId,
      packageUid,
      eventType,
      username,
      deviceId: this.cloudSettings.getEffective().stationId,
      gatewayId: session.gatewayId || undefined,
      scaleId: session.scaleId || undefined,
      scaleName: session.scaleName || undefined,
      sourceAt: new Date().toISOString(),
      payload,
    });
  }

  private async syncTraceEvent(dto: IngestLpnTraceDto, outboxId?: number) {
    try {
      if (this.cloudSettings.isRemoteMode()) {
        await this.cloudClient.ingestTraceEvent(dto);
      } else if (this.cloudSettings.isStorageMode()) {
        await this.cloudStorage.ingestTraceEvent(dto);
      } else {
        return;
      }
      if (outboxId) {
        await (this.prisma as unknown as TraceOutboxDb).lpnTraceOutbox.update({
          where: { id: outboxId },
          data: { syncedAt: new Date(), syncError: null },
        });
      }
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      if (this.cloudSettings.isRemoteMode()) {
        const outbox = (this.prisma as unknown as TraceOutboxDb).lpnTraceOutbox;
        if (outboxId) {
          await outbox.update({
            where: { id: outboxId },
            data: { syncError: message },
          });
        } else {
          await outbox.upsert({
            where: { localEventId: dto.localEventId },
            create: {
              localEventId: dto.localEventId,
              packageUid: dto.packageUid,
              eventType: dto.eventType,
              payload: JSON.stringify(dto),
              sourceAt: new Date(dto.sourceAt),
              syncError: message,
            },
            update: { syncError: message, payload: JSON.stringify(dto) },
          });
        }
      }
      this.logger.warn(`Trace sync failed for ${dto.localEventId}: ${message}`);
    }
  }

  async retryUnsyncedReadings(): Promise<{
    retried: number;
    synced: number;
    failed: number;
  }> {
    const unsynced = await this.prisma.weighReading.findMany({
      where: {
        cloudSyncedAt: null,
        savedAt: { not: null },
      },
      include: {
        session: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
      take: 100,
    });

    let synced = 0;
    let failed = 0;

    for (const reading of unsynced) {
      const before = reading.cloudSyncedAt;
      await this.syncReadingAfterConfirm(
        reading,
        reading.session,
        reading.session.user?.username || 'unknown',
      );
      const updated = await this.prisma.weighReading.findUnique({
        where: { id: reading.id },
      });
      if (updated?.cloudSyncedAt && !before) {
        synced += 1;
      } else {
        failed += 1;
      }
    }

    if (this.cloudSettings.isRemoteMode()) {
      const outbox = (this.prisma as unknown as TraceOutboxDb).lpnTraceOutbox;
      const traceEvents = await outbox.findMany({
        where: { syncedAt: null },
        orderBy: { id: 'asc' },
        take: 100,
      });
      for (const event of traceEvents) {
        try {
          const dto = JSON.parse(event.payload as string) as IngestLpnTraceDto;
          await this.syncTraceEvent(dto, event.id as number);
        } catch (error) {
          await outbox.update({
            where: { id: event.id },
            data: { syncError: (error as Error).message.slice(0, 500) },
          });
        }
      }
    }

    return { retried: unsynced.length, synced, failed };
  }
}

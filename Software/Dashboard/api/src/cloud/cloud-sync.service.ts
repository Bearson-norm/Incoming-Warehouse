import { Injectable, Logger } from '@nestjs/common';
import { WeighReading, WeighSession, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudSettingsService } from './cloud-settings.service';
import { CloudStorageService } from './cloud-storage.service';
import { CloudClientService } from './cloud-client.service';
import { IngestCloudReadingDto } from './dto/ingest-cloud-reading.dto';

type SessionWithUser = WeighSession & {
  user?: Pick<User, 'username'>;
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

    const payload: IngestCloudReadingDto = {
      scaleId: session.scaleId,
      scaleName: session.scaleName,
      username,
      stationId: this.cloudSettings.getEffective().stationId,
      localReadingId: reading.id,
      packageUid: reading.packageUid || session.packageUid || undefined,
      flowType: session.flowType === 'intrans' ? 'intrans' : 'incoming',
      weighingMethod: session.weighingMethod === 'internal' ? 'internal' : 'odoo',
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
      } else if (this.cloudSettings.isStorageMode()) {
        await this.cloudStorage.ingestReading(payload);
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
      this.logger.error(`Cloud sync failed for reading ${reading.id}: ${message}`);
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

  async retryUnsyncedReadings(): Promise<{ retried: number; synced: number; failed: number }> {
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

    return { retried: unsynced.length, synced, failed };
  }
}

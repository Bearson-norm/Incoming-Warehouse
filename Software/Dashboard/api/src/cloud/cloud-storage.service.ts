import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCloudScaleDto } from './dto/create-cloud-scale.dto';
import { UpdateCloudScaleDto } from './dto/update-cloud-scale.dto';
import { IngestCloudReadingDto } from './dto/ingest-cloud-reading.dto';
import { QueryCloudReadingsDto } from './dto/query-cloud-readings.dto';
import { IngestLpnTraceDto } from './dto/ingest-lpn-trace.dto';

/** PostgreSQL-only cloud tables; cast keeps SQLite-packaged API builds compiling. */
type CloudPrisma = {
  cloudScale: {
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown | null>;
    findUnique: (args: unknown) => Promise<unknown | null>;
    count: (args?: unknown) => Promise<number>;
  };
  cloudWeighReading: {
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown | null>;
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args?: unknown) => Promise<number>;
  };
  lpnTraceEvent: {
    create: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown | null>;
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args?: unknown) => Promise<number>;
  };
};

@Injectable()
export class CloudStorageService {
  constructor(private prisma: PrismaService) {}

  private get cloudDb(): CloudPrisma {
    return this.prisma as unknown as CloudPrisma;
  }

  async findAllScales(includeInactive = false) {
    return this.cloudDb.cloudScale.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createScale(dto: CreateCloudScaleDto) {
    const name = dto.name.trim();
    try {
      return await this.cloudDb.cloudScale.create({
        data: { name },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException(`Scale name "${name}" already exists`);
      }
      throw error;
    }
  }

  async updateScale(id: number, dto: UpdateCloudScaleDto) {
    await this.ensureScaleExists(id);
    try {
      return await this.cloudDb.cloudScale.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          isActive: dto.isActive,
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Scale name already exists');
      }
      throw error;
    }
  }

  async deactivateScale(id: number) {
    await this.ensureScaleExists(id);
    return this.cloudDb.cloudScale.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async ingestReading(dto: IngestCloudReadingDto) {
    const scale = await this.cloudDb.cloudScale.findFirst({
      where: { id: dto.scaleId, isActive: true },
    });
    if (!scale) {
      throw new BadRequestException(
        `Scale ${dto.scaleId} not found or inactive`,
      );
    }

    try {
      return await this.cloudDb.cloudWeighReading.create({
        data: {
          eventId: dto.eventId?.trim() || null,
          scaleId: dto.scaleId,
          scaleName: dto.scaleName.trim(),
          username: dto.username.trim(),
          stationId: dto.stationId?.trim() || null,
          deviceId: dto.deviceId?.trim() || null,
          gatewayId: dto.gatewayId?.trim() || null,
          localReadingId: dto.localReadingId ?? null,
          localSessionId: dto.localSessionId ?? null,
          packageUid: dto.packageUid?.trim().toUpperCase() || null,
          vendorCloudId: dto.vendorCloudId || null,
          vendorSnapshot: dto.vendorSnapshot?.trim() || null,
          packagingCloudId: dto.packagingCloudId || null,
          packagingSnapshot: dto.packagingSnapshot?.trim() || null,
          rmCodeCloudId: dto.rmCodeCloudId || null,
          rmCodeSnapshot: dto.rmCodeSnapshot?.trim() || null,
          labelMetadata: dto.labelMetadata || null,
          odooLogId: dto.odooLogId ?? null,
          odooPackageId: dto.odooPackageId ?? null,
          flowType: dto.flowType,
          weighingMethod: dto.weighingMethod,
          weight: dto.weight,
          grossWeight: dto.grossWeight ?? null,
          tareWeight: dto.tareWeight ?? null,
          netWeight: dto.netWeight ?? null,
          unit: dto.unit?.trim() || 'kg',
          weightStatus: dto.weightStatus ?? null,
          capturedAt: new Date(dto.capturedAt),
        },
        include: { scale: true },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        const existing = await this.cloudDb.cloudWeighReading.findFirst({
          where: {
            stationId: dto.stationId?.trim() || null,
            localReadingId: dto.localReadingId ?? null,
          },
        });
        if (existing) {
          return this.cloudDb.cloudWeighReading.update({
            where: { id: (existing as { id: number }).id },
            data: {
              eventId: dto.eventId?.trim() || undefined,
              odooLogId: dto.odooLogId ?? null,
              odooPackageId: dto.odooPackageId ?? null,
              grossWeight: dto.grossWeight ?? null,
              tareWeight: dto.tareWeight ?? null,
              netWeight: dto.netWeight ?? null,
              weightStatus: dto.weightStatus ?? null,
              labelMetadata: dto.labelMetadata || null,
            },
          });
        }
      }
      throw error;
    }
  }

  async queryReadings(query: QueryCloudReadingsDto, defaultUsername?: string) {
    const where: Record<string, unknown> = {};

    if (query.username) {
      where.username = query.username;
    } else if (defaultUsername) {
      where.username = defaultUsername;
    }

    if (query.scaleId) {
      where.scaleId = query.scaleId;
    }
    if (query.stationId) {
      where.stationId = query.stationId;
    }
    if (query.packageUid) {
      where.packageUid = query.packageUid.trim().toUpperCase();
    }
    if (query.deviceId) {
      where.deviceId = query.deviceId;
    }
    if (query.flowType) {
      where.flowType = query.flowType;
    }
    if (query.from || query.to) {
      const capturedAt: { gte?: Date; lte?: Date } = {};
      if (query.from) {
        capturedAt.gte = new Date(query.from);
      }
      if (query.to) {
        capturedAt.lte = new Date(query.to);
      }
      where.capturedAt = capturedAt;
    }

    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const offset = Math.max(query.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      this.cloudDb.cloudWeighReading.findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        take: limit,
        skip: offset,
        include: { scale: true },
      }),
      this.cloudDb.cloudWeighReading.count({ where }),
    ]);

    const vendorIds = items
      .map((item) => (item as Record<string, any>).vendorCloudId)
      .filter(Boolean);
    const packagingIds = items
      .map((item) => (item as Record<string, any>).packagingCloudId)
      .filter(Boolean);
    const rmIds = items
      .map((item) => (item as Record<string, any>).rmCodeCloudId)
      .filter(Boolean);
    const [vendors, packagings, rmCodes] = await Promise.all([
      vendorIds.length
        ? this.prisma.vendor.findMany({ where: { cloudId: { in: vendorIds } } })
        : [],
      packagingIds.length
        ? this.prisma.packaging.findMany({
            where: { cloudId: { in: packagingIds } },
          })
        : [],
      rmIds.length
        ? this.prisma.rmCode.findMany({ where: { cloudId: { in: rmIds } } })
        : [],
    ]);
    const vendorNames = new Map(
      vendors.map((row) => [row.cloudId, row.name] as [string, string]),
    );
    const packagingNames = new Map(
      packagings.map((row) => [row.cloudId, row.name] as [string, string]),
    );
    const rmNames = new Map(
      rmCodes.map(
        (row) => [row.cloudId, row.name || row.code] as [string, string],
      ),
    );
    return {
      items: items.map((item) => {
        const row = item as Record<string, any>;
        return {
          ...row,
          currentVendorName: vendorNames.get(row.vendorCloudId) || null,
          currentPackagingName:
            packagingNames.get(row.packagingCloudId) || null,
          currentRmName: rmNames.get(row.rmCodeCloudId) || null,
        };
      }),
      total,
      limit,
      offset,
    };
  }

  async ingestTraceEvent(dto: IngestLpnTraceDto) {
    try {
      return await this.cloudDb.lpnTraceEvent.create({
        data: {
          stationId: dto.stationId.trim(),
          localEventId: dto.localEventId.trim(),
          packageUid: dto.packageUid.trim().toUpperCase(),
          eventType: dto.eventType.trim(),
          username: dto.username.trim(),
          deviceId: dto.deviceId?.trim() || null,
          gatewayId: dto.gatewayId?.trim() || null,
          scaleId: dto.scaleId ?? null,
          scaleName: dto.scaleName?.trim() || null,
          sourceAt: new Date(dto.sourceAt),
          payload: dto.payload ?? undefined,
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        const existing = await this.cloudDb.lpnTraceEvent.findFirst({
          where: {
            stationId: dto.stationId.trim(),
            localEventId: dto.localEventId.trim(),
          },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async queryTrace(
    packageUid: string,
    options: {
      username?: string;
      stationId?: string;
      eventType?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Record<string, unknown> = {
      packageUid: packageUid.trim().toUpperCase(),
    };
    if (options.username) where.username = options.username;
    if (options.stationId) where.stationId = options.stationId;
    if (options.eventType) where.eventType = options.eventType;
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);
    const [items, total] = await Promise.all([
      this.cloudDb.lpnTraceEvent.findMany({
        where,
        orderBy: { sourceAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.cloudDb.lpnTraceEvent.count({ where }),
    ]);
    return {
      packageUid: packageUid.trim().toUpperCase(),
      items,
      total,
      limit,
      offset,
    };
  }

  async getStatus() {
    const [scaleCount, readingCount] = await Promise.all([
      this.cloudDb.cloudScale.count({ where: { isActive: true } }),
      this.cloudDb.cloudWeighReading.count(),
    ]);
    return {
      online: true,
      mode: 'storage' as const,
      activeScales: scaleCount,
      totalReadings: readingCount,
    };
  }

  private async ensureScaleExists(id: number) {
    const scale = await this.cloudDb.cloudScale.findUnique({ where: { id } });
    if (!scale) {
      throw new NotFoundException(`Scale with ID ${id} not found`);
    }
    return scale;
  }
}

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
      throw new BadRequestException(`Scale ${dto.scaleId} not found or inactive`);
    }

    try {
      return await this.cloudDb.cloudWeighReading.create({
        data: {
          scaleId: dto.scaleId,
          scaleName: dto.scaleName.trim(),
          username: dto.username.trim(),
          stationId: dto.stationId?.trim() || null,
          localReadingId: dto.localReadingId ?? null,
          packageUid: dto.packageUid?.trim() || null,
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
          return existing;
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

    return { items, total, limit, offset };
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

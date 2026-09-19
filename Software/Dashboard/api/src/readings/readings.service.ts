import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryReadingsDto } from './dto/query-readings.dto';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingLabelDto } from './dto/update-reading-label.dto';

type Requester = { userId: number; role: string };

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
export class ReadingsService {
  constructor(private prisma: PrismaService) {}

  private scopedUserId(query: QueryReadingsDto, requester: Requester): number | undefined {
    if (requester.role === 'admin') {
      return query.userId;
    }
    return requester.userId;
  }

  private buildWhere(query: QueryReadingsDto, requester: Requester): Prisma.WeighReadingWhereInput {
    const {
      sessionId,
      vendorId,
      packagingId,
      startDate,
      endDate,
      gatewayId,
      packageUid,
      flowType,
      weighingMethod,
    } = query;

    const userId = this.scopedUserId(query, requester);
    const where: Prisma.WeighReadingWhereInput = {};
    const and: Prisma.WeighReadingWhereInput[] = [];

    if (sessionId) {
      where.sessionId = sessionId;
    }

    const sessionFilter: Prisma.WeighSessionWhereInput = {};
    if (vendorId) {
      sessionFilter.vendorId = vendorId;
    }
    if (packagingId) {
      sessionFilter.packagingId = packagingId;
    }
    if (userId) {
      sessionFilter.userId = userId;
    }
    if (gatewayId) {
      sessionFilter.gatewayId = gatewayId;
    }
    if (flowType === 'incoming' || flowType === 'intrans') {
      sessionFilter.flowType = flowType;
    }
    if (weighingMethod === 'odoo' || weighingMethod === 'internal') {
      sessionFilter.weighingMethod = weighingMethod;
    }
    if (Object.keys(sessionFilter).length > 0) {
      and.push({ session: sessionFilter });
    }

    if (startDate || endDate) {
      where.capturedAt = {};
      if (startDate) {
        where.capturedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.capturedAt.lte = new Date(endDate);
      }
    }

    if (packageUid?.trim()) {
      const term = packageUid.trim();
      and.push({
        OR: [
          { packageUid: { contains: term, mode: 'insensitive' } },
          { session: { packageUid: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    return where;
  }

  async findAll(query: QueryReadingsDto, requester: Requester) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
    const where = this.buildWhere(query, requester);
    const skip = (page - 1) * limit;

    const [readings, total] = await Promise.all([
      this.prisma.weighReading.findMany({
        where,
        include: {
          session: { include: sessionInclude },
        },
        orderBy: {
          capturedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.weighReading.count({ where }),
    ]);

    return {
      data: readings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async stats(query: QueryReadingsDto, requester: Requester) {
    const where = this.buildWhere(query, requester);

    const readings = await this.prisma.weighReading.findMany({
      where,
      select: {
        sessionId: true,
        netWeight: true,
        packageUid: true,
        session: {
          select: {
            packageUid: true,
            vendor: { select: { name: true } },
            rmCode: { select: { code: true } },
          },
        },
      },
    });

    const bySession = new Map<
      number,
      { netWeight: number; label: string }
    >();
    for (const reading of readings) {
      if (bySession.has(reading.sessionId)) {
        continue;
      }
      const label =
        reading.session.vendor?.name ||
        reading.session.rmCode?.code ||
        reading.packageUid ||
        reading.session.packageUid ||
        'LPN';
      bySession.set(reading.sessionId, {
        netWeight: reading.netWeight && reading.netWeight > 0 ? reading.netWeight : 0,
        label,
      });
    }

    const byLabel: Record<string, { count: number; weight: number }> = {};
    let totalWeight = 0;
    for (const row of bySession.values()) {
      totalWeight += row.netWeight;
      if (!byLabel[row.label]) {
        byLabel[row.label] = { count: 0, weight: 0 };
      }
      byLabel[row.label].count += 1;
      byLabel[row.label].weight += row.netWeight;
    }

    return {
      sessionCount: bySession.size,
      totalNetWeight: totalWeight,
      byLabel,
    };
  }

  async findByLpn(packageUid: string, requester: Requester) {
    const lpn = packageUid?.trim();
    if (!lpn) {
      throw new BadRequestException('packageUid is required');
    }

    const userFilter =
      requester.role === 'admin' ? {} : { userId: requester.userId };

    const readings = await this.prisma.weighReading.findMany({
      where: {
        savedAt: { not: null },
        AND: [
          {
            OR: [
              { packageUid: { equals: lpn, mode: 'insensitive' } },
              { session: { packageUid: { equals: lpn, mode: 'insensitive' } } },
            ],
          },
          ...(Object.keys(userFilter).length ? [{ session: userFilter }] : []),
        ],
      },
      include: {
        session: { include: sessionInclude },
      },
      orderBy: {
        capturedAt: 'asc',
      },
    });

    const incoming = readings.find((r) => r.session.flowType === 'incoming');
    const latest = readings[readings.length - 1];

    return {
      packageUid: lpn,
      summary: {
        count: readings.length,
        rmCode: incoming?.session.rmCode || null,
        vendor: incoming?.session.vendor || null,
        packaging: incoming?.session.packaging || null,
        latestGross: latest?.grossWeight ?? latest?.weight ?? null,
        latestTare: latest?.tareWeight ?? null,
        latestNet: latest?.netWeight ?? null,
        latestStatus: latest?.weightStatus ?? null,
        syncedToOdoo: readings.some((r) => r.odooLogId != null),
      },
      readings,
    };
  }

  async findOne(id: number, requester: Requester) {
    const reading = await this.prisma.weighReading.findUnique({
      where: { id },
      include: {
        session: { include: sessionInclude },
      },
    });

    if (!reading) {
      throw new NotFoundException(`Reading with ID ${id} not found`);
    }

    if (requester.role !== 'admin' && reading.session.userId !== requester.userId) {
      throw new NotFoundException('Reading not found');
    }

    return reading;
  }

  async updateLabel(id: number, dto: UpdateReadingLabelDto, requester: Requester) {
    const reading = await this.findOne(id, requester);

    const nextLpn = dto.packageUid?.trim();
    let nextMetadata: Record<string, unknown> = {};
    if (reading.session.labelMetadata) {
      try {
        nextMetadata = JSON.parse(reading.session.labelMetadata) as Record<string, unknown>;
      } catch {
        nextMetadata = {};
      }
    }
    if (dto.dateIncoming !== undefined) {
      nextMetadata.dateIncoming = dto.dateIncoming;
    }
    if (nextLpn) {
      nextMetadata.packageUid = nextLpn;
      nextMetadata.labelProductNumber = nextLpn;
    }

    await this.prisma.$transaction([
      this.prisma.weighReading.update({
        where: { id },
        data: {
          ...(nextLpn ? { packageUid: nextLpn } : {}),
        },
      }),
      this.prisma.weighSession.update({
        where: { id: reading.sessionId },
        data: {
          ...(nextLpn ? { packageUid: nextLpn } : {}),
          labelMetadata: JSON.stringify(nextMetadata),
        },
      }),
    ]);

    return this.findOne(id, requester);
  }

  async create(createReadingDto: CreateReadingDto, userId: number) {
    const session = await this.prisma.weighSession.findUnique({
      where: { id: createReadingDto.sessionId },
      include: {
        vendor: true,
        packaging: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${createReadingDto.sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    if (session.endedAt) {
      throw new NotFoundException('Session has already ended');
    }

    return this.prisma.weighReading.create({
      data: {
        sessionId: createReadingDto.sessionId,
        weight: createReadingDto.weight,
        unit: createReadingDto.unit || 'kg',
        stable: createReadingDto.stable ?? true,
        rawLine: createReadingDto.rawLine,
        capturedAt: createReadingDto.capturedAt
          ? new Date(createReadingDto.capturedAt)
          : new Date(),
        savedAt: new Date(),
      },
      include: {
        session: { include: sessionInclude },
      },
    });
  }
}

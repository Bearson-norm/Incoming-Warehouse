import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { WeightSnapshotStore } from '../websocket/weight-snapshot.store';

const LPN_REGEX = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;

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
  ) {}

  private assertLpn(packageUid: string | undefined, required: boolean): string | null {
    const lpn = packageUid?.trim() || '';
    if (!lpn) {
      if (required) {
        throw new BadRequestException('LPN (packageUid) is required');
      }
      return null;
    }
    if (lpn.length > 64 || !LPN_REGEX.test(lpn)) {
      throw new BadRequestException(
        'packageUid must start with a letter or digit and may contain letters, digits, /, _, or -',
      );
    }
    return lpn;
  }

  async create(userId: number, dto: CreateSessionDto) {
    const weighingMethod = dto.weighingMethod === 'internal' ? 'internal' : 'odoo';
    const flowType = dto.flowType === 'intrans' ? 'intrans' : 'incoming';

    let packageUid: string | null;
    let vendorId: number | null = dto.vendorId ?? null;
    let packagingId: number | null = dto.packagingId ?? null;
    let rmCodeId: number | null = dto.rmCodeId ?? null;

    const scaleId = dto.scaleId;
    const scaleName = dto.scaleName?.trim();
    if (!scaleId || !scaleName) {
      throw new BadRequestException('Scale selection is required before starting a session');
    }

    if (flowType === 'intrans') {
      packageUid = this.assertLpn(dto.packageUid, true);
      vendorId = null;
      packagingId = null;
      rmCodeId = null;
    } else if (weighingMethod === 'odoo') {
      packageUid = this.assertLpn(dto.packageUid, true);
    } else {
      packageUid = this.assertLpn(dto.packageUid, false);
      if (!vendorId || !packagingId || !rmCodeId) {
        throw new BadRequestException(
          'Internal incoming weighing requires vendor, packaging, and RM code',
        );
      }
      const packaging = await this.prisma.packaging.findUnique({
        where: { id: packagingId },
      });
      if (!packaging) {
        throw new BadRequestException('Packaging not found');
      }
      if (packaging.vendorId !== vendorId) {
        throw new BadRequestException('Packaging does not belong to the selected vendor');
      }
      if (packaging.tareWeight == null) {
        throw new BadRequestException('Selected packaging has no tare weight');
      }
      const rm = await this.prisma.rmCode.findUnique({ where: { id: rmCodeId } });
      if (!rm) {
        throw new BadRequestException('RM code not found');
      }
    }

    await this.prisma.weighSession.updateMany({
      where: {
        userId,
        endedAt: null,
      },
      data: {
        endedAt: new Date(),
      },
    });

    return this.prisma.weighSession.create({
      data: {
        packageUid,
        vendorId,
        packagingId,
        rmCodeId,
        scaleId,
        scaleName,
        weighingMethod,
        flowType,
        userId,
        autosaveEnabled: dto.autosaveEnabled ?? false,
        ...(dto.labelMetadata != null
          ? { labelMetadata: JSON.stringify(dto.labelMetadata) }
          : {}),
      },
      include: sessionInclude,
    });
  }

  async findActive(userId: number, flowType?: string) {
    try {
      return await this.prisma.weighSession.findFirst({
        where: {
          userId,
          endedAt: null,
          ...(flowType === 'incoming' || flowType === 'intrans'
            ? { flowType }
            : {}),
        },
        include: {
          vendor: true,
          packaging: true,
          rmCode: true,
        },
      });
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

    const snapshot = this.snapshots.getUsable(session.gatewayId);
    if (!snapshot) {
      throw new BadRequestException(
        'No stable scale reading. Wait for a live stable weight before starting.',
      );
    }

    return this.prisma.weighSession.update({
      where: { id },
      data: {
        weighingStarted: true,
        gatewayId: snapshot.gatewayId,
      },
      include: {
        vendor: true,
        packaging: true,
        rmCode: true,
      },
    });
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

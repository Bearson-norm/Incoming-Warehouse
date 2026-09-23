import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRmCodeDto } from './dto/create-rm-code.dto';
import { UpdateRmCodeDto } from './dto/update-rm-code.dto';
import { CloudSettingsService } from '../cloud/cloud-settings.service';

@Injectable()
export class RmCodesService {
  constructor(
    private prisma: PrismaService,
    private cloudSettings: CloudSettingsService,
  ) {}

  create(dto: CreateRmCodeDto) {
    this.assertLocalMutationAllowed();
    return this.prisma.rmCode.create({
      data: {
        code: dto.code.trim(),
        name: dto.name?.trim() || null,
      },
    });
  }

  findAll() {
    return this.prisma.rmCode.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: number) {
    const row = await this.prisma.rmCode.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`RM code with ID ${id} not found`);
    }
    return row;
  }

  async update(id: number, dto: UpdateRmCodeDto) {
    this.assertLocalMutationAllowed();
    await this.findOne(id);
    return this.prisma.rmCode.update({
      where: { id },
      data: {
        ...(dto.code != null ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name?.trim() || null } : {}),
      },
    });
  }

  async remove(id: number) {
    this.assertLocalMutationAllowed();
    await this.findOne(id);
    return this.prisma.rmCode.delete({ where: { id } });
  }

  private assertLocalMutationAllowed() {
    if (this.cloudSettings.isRemoteMode()) {
      throw new ForbiddenException(
        'Master data is managed from Cloud Server. Local database is a read-only cache.',
      );
    }
  }
}

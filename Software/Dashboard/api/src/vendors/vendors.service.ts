import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { CloudSettingsService } from '../cloud/cloud-settings.service';

@Injectable()
export class VendorsService {
  constructor(
    private prisma: PrismaService,
    private cloudSettings: CloudSettingsService,
  ) {}

  create(createVendorDto: CreateVendorDto) {
    this.assertLocalMutationAllowed();
    return this.prisma.vendor.create({
      data: createVendorDto,
    });
  }

  findAll() {
    return this.prisma.vendor.findMany({
      where: { deletedAt: null },
      include: {
        packagings: { where: { deletedAt: null } },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.vendor.findUnique({
      where: { id },
      include: {
        packagings: { where: { deletedAt: null } },
      },
    });
  }

  update(id: number, updateVendorDto: UpdateVendorDto) {
    this.assertLocalMutationAllowed();
    return this.prisma.vendor.update({
      where: { id },
      data: updateVendorDto,
    });
  }

  remove(id: number) {
    this.assertLocalMutationAllowed();
    return this.prisma.vendor.delete({
      where: { id },
    });
  }

  private assertLocalMutationAllowed() {
    if (this.cloudSettings.isRemoteMode()) {
      throw new ForbiddenException(
        'Master data is managed from Cloud Server. Local database is a read-only cache.',
      );
    }
  }
}

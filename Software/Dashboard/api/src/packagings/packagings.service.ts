import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackagingDto } from './dto/create-packaging.dto';
import { UpdatePackagingDto } from './dto/update-packaging.dto';
import { CloudSettingsService } from '../cloud/cloud-settings.service';

function normalizeMetadata(
  metadata: CreatePackagingDto['metadata'],
): string | null | undefined {
  if (metadata === undefined) {
    return undefined;
  }
  if (metadata === null) {
    return null;
  }
  return typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
}

@Injectable()
export class PackagingsService {
  constructor(
    private prisma: PrismaService,
    private cloudSettings: CloudSettingsService,
  ) {}

  create(createPackagingDto: CreatePackagingDto) {
    this.assertLocalMutationAllowed();
    const { metadata, ...rest } = createPackagingDto;
    return this.prisma.packaging.create({
      data: {
        ...rest,
        ...(metadata !== undefined
          ? { metadata: normalizeMetadata(metadata) }
          : {}),
      },
    });
  }

  findAll() {
    return this.prisma.packaging.findMany({
      where: { deletedAt: null },
      include: {
        vendor: true,
      },
    });
  }

  findByVendor(vendorId: number) {
    return this.prisma.packaging.findMany({
      where: { vendorId, deletedAt: null },
      include: {
        vendor: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.packaging.findUnique({
      where: { id },
      include: {
        vendor: true,
      },
    });
  }

  update(id: number, updatePackagingDto: UpdatePackagingDto) {
    this.assertLocalMutationAllowed();
    const { metadata, ...rest } = updatePackagingDto;
    return this.prisma.packaging.update({
      where: { id },
      data: {
        ...rest,
        ...(metadata !== undefined
          ? { metadata: normalizeMetadata(metadata) }
          : {}),
      },
    });
  }

  remove(id: number) {
    this.assertLocalMutationAllowed();
    return this.prisma.packaging.delete({
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

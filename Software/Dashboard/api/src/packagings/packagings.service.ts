import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackagingDto } from './dto/create-packaging.dto';
import { UpdatePackagingDto } from './dto/update-packaging.dto';

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
  constructor(private prisma: PrismaService) {}

  create(createPackagingDto: CreatePackagingDto) {
    const { metadata, ...rest } = createPackagingDto;
    return this.prisma.packaging.create({
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata: normalizeMetadata(metadata) } : {}),
      },
    });
  }

  findAll() {
    return this.prisma.packaging.findMany({
      include: {
        vendor: true,
      },
    });
  }

  findByVendor(vendorId: number) {
    return this.prisma.packaging.findMany({
      where: { vendorId },
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
    const { metadata, ...rest } = updatePackagingDto;
    return this.prisma.packaging.update({
      where: { id },
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata: normalizeMetadata(metadata) } : {}),
      },
    });
  }

  remove(id: number) {
    return this.prisma.packaging.delete({
      where: { id },
    });
  }
}

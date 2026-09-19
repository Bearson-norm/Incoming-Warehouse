import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  create(createVendorDto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: createVendorDto,
    });
  }

  findAll() {
    return this.prisma.vendor.findMany({
      include: {
        packagings: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.vendor.findUnique({
      where: { id },
      include: {
        packagings: true,
      },
    });
  }

  update(id: number, updateVendorDto: UpdateVendorDto) {
    return this.prisma.vendor.update({
      where: { id },
      data: updateVendorDto,
    });
  }

  remove(id: number) {
    return this.prisma.vendor.delete({
      where: { id },
    });
  }
}

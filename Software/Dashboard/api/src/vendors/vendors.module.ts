import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [VendorsController],
  providers: [VendorsService],
  imports: [PrismaModule],
  exports: [VendorsService],
})
export class VendorsModule {}

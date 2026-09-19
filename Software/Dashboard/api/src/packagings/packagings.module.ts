import { Module } from '@nestjs/common';
import { PackagingsService } from './packagings.service';
import { PackagingsController } from './packagings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [PackagingsController],
  providers: [PackagingsService],
  imports: [PrismaModule],
  exports: [PackagingsService],
})
export class PackagingsModule {}

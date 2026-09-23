import { Module } from '@nestjs/common';
import { PackagingsService } from './packagings.service';
import { PackagingsController } from './packagings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudModule } from '../cloud/cloud.module';

@Module({
  controllers: [PackagingsController],
  providers: [PackagingsService],
  imports: [PrismaModule, CloudModule],
  exports: [PackagingsService],
})
export class PackagingsModule {}

import { Module } from '@nestjs/common';
import { RmCodesService } from './rm-codes.service';
import { RmCodesController } from './rm-codes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudModule } from '../cloud/cloud.module';

@Module({
  controllers: [RmCodesController],
  providers: [RmCodesService],
  imports: [PrismaModule, CloudModule],
  exports: [RmCodesService],
})
export class RmCodesModule {}

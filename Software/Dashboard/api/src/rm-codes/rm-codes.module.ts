import { Module } from '@nestjs/common';
import { RmCodesService } from './rm-codes.service';
import { RmCodesController } from './rm-codes.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [RmCodesController],
  providers: [RmCodesService],
  imports: [PrismaModule],
  exports: [RmCodesService],
})
export class RmCodesModule {}

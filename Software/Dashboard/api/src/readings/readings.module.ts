import { Module } from '@nestjs/common';
import { ReadingsService } from './readings.service';
import { ReadingsController } from './readings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [ReadingsController],
  providers: [ReadingsService],
  imports: [PrismaModule],
  exports: [ReadingsService],
})
export class ReadingsModule {}

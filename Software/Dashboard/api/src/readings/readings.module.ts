import { Module } from '@nestjs/common';
import { ReadingsService } from './readings.service';
import { ReadingsController } from './readings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudModule } from '../cloud/cloud.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  controllers: [ReadingsController],
  providers: [ReadingsService],
  imports: [PrismaModule, CloudModule, SessionsModule],
  exports: [ReadingsService],
})
export class ReadingsModule {}

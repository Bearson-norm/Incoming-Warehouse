import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WeightSnapshotModule } from '../websocket/weight-snapshot.module';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService],
  imports: [PrismaModule, WeightSnapshotModule],
  exports: [SessionsService],
})
export class SessionsModule {}

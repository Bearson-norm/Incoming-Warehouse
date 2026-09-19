import { Module } from '@nestjs/common';
import { WeighingGateway } from './websocket.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WeightSnapshotModule } from './weight-snapshot.module';

@Module({
  imports: [PrismaModule, AuthModule, WeightSnapshotModule],
  providers: [WeighingGateway],
  exports: [WeighingGateway],
})
export class WebSocketModule {}

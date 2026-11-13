import { Module } from '@nestjs/common';
import { WeighingsService } from './weighings.service';
import { WeighingsController } from './weighings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OdooModule } from '../odoo/odoo.module';
import { WeightSnapshotModule } from '../websocket/weight-snapshot.module';
import { CloudModule } from '../cloud/cloud.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [PrismaModule, OdooModule, WeightSnapshotModule, CloudModule, SessionsModule],
  controllers: [WeighingsController],
  providers: [WeighingsService],
})
export class WeighingsModule {}

import { Module } from '@nestjs/common';
import { OdooWeighingService } from './odoo-weighing.service';
import { OdooSettingsService } from './odoo-settings.service';

@Module({
  providers: [OdooSettingsService, OdooWeighingService],
  exports: [OdooSettingsService, OdooWeighingService],
})
export class OdooModule {}

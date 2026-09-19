import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { OdooModule } from '../odoo/odoo.module';
import { CloudModule } from '../cloud/cloud.module';

@Module({
  imports: [OdooModule, CloudModule],
  controllers: [SettingsController],
})
export class SettingsModule {}

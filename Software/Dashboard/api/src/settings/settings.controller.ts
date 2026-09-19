import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OdooSettingsService } from '../odoo/odoo-settings.service';
import { CloudSettingsService } from '../cloud/cloud-settings.service';
import { UpdateOdooSettingsDto } from './dto/update-odoo-settings.dto';
import { UpdateCloudSettingsDto } from '../cloud/dto/update-cloud-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly odooSettings: OdooSettingsService,
    private readonly cloudSettings: CloudSettingsService,
  ) {}

  @Get('odoo')
  @UseGuards(JwtAuthGuard)
  getOdoo() {
    return this.odooSettings.getPublicSettings();
  }

  @Patch('odoo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateOdoo(@Body() dto: UpdateOdooSettingsDto) {
    return this.odooSettings.update({
      baseUrl: dto.baseUrl,
      iotApiKey: dto.iotApiKey,
    });
  }

  @Get('cloud')
  @UseGuards(JwtAuthGuard)
  getCloud() {
    return this.cloudSettings.getPublicSettings();
  }

  @Patch('cloud')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateCloud(@Body() dto: UpdateCloudSettingsDto) {
    return this.cloudSettings.update({
      serverUrl: dto.serverUrl,
      syncApiKey: dto.syncApiKey,
    });
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CloudSettingsService } from './cloud-settings.service';
import { CloudStorageService } from './cloud-storage.service';
import { CloudClientService } from './cloud-client.service';
import { CloudSyncService } from './cloud-sync.service';
import { CloudSyncApiKeyGuard } from './guards/cloud-sync-api-key.guard';
import { CloudAccessGuard } from './guards/cloud-access.guard';
import { CreateCloudScaleDto } from './dto/create-cloud-scale.dto';
import { UpdateCloudScaleDto } from './dto/update-cloud-scale.dto';
import { IngestCloudReadingDto } from './dto/ingest-cloud-reading.dto';
import { QueryCloudReadingsDto } from './dto/query-cloud-readings.dto';

@Controller('cloud')
export class CloudController {
  constructor(
    private cloudSettings: CloudSettingsService,
    private cloudStorage: CloudStorageService,
    private cloudClient: CloudClientService,
    private cloudSync: CloudSyncService,
  ) {}

  private extractToken(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice(7);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: Request) {
    const publicSettings = this.cloudSettings.getPublicSettings();
    if (this.cloudSettings.isRemoteMode()) {
      try {
        const remote = await this.cloudClient.getStatus(this.extractToken(req));
        return {
          ...publicSettings,
          ...remote,
          mode: 'remote',
          online: true,
        };
      } catch (error) {
        return {
          ...publicSettings,
          mode: 'remote',
          online: false,
          error: (error as Error).message,
        };
      }
    }

    if (this.cloudSettings.isStorageMode()) {
      const storage = await this.cloudStorage.getStatus();
      return {
        ...publicSettings,
        ...storage,
      };
    }

    return {
      ...publicSettings,
      online: false,
      mode: 'unconfigured',
    };
  }

  @Get('scales')
  @UseGuards(CloudAccessGuard)
  async findScales(@Req() req: Request, @Query('includeInactive') includeInactive?: string) {
    const inactive = includeInactive === 'true';
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.fetchScales(this.extractToken(req), inactive);
    }
    if (this.cloudSettings.isStorageMode()) {
      return this.cloudStorage.findAllScales(inactive);
    }
    return [];
  }

  @Post('scales')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createScale(@Req() req: Request, @Body() dto: CreateCloudScaleDto) {
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.createScale(dto, this.extractToken(req)!);
    }
    return this.cloudStorage.createScale(dto);
  }

  @Patch('scales/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateScale(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCloudScaleDto,
  ) {
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.updateScale(+id, dto, this.extractToken(req)!);
    }
    return this.cloudStorage.updateScale(+id, dto);
  }

  @Delete('scales/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deactivateScale(@Req() req: Request, @Param('id') id: string) {
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.deactivateScale(+id, this.extractToken(req)!);
    }
    return this.cloudStorage.deactivateScale(+id);
  }

  @Post('readings')
  @UseGuards(CloudSyncApiKeyGuard)
  ingestReading(@Body() dto: IngestCloudReadingDto) {
    return this.cloudStorage.ingestReading(dto);
  }

  @Get('readings')
  @UseGuards(JwtAuthGuard)
  async queryReadings(@Req() req: Request & { user?: { username: string; role: string } }, @Query() query: QueryCloudReadingsDto) {
    const isAdmin = req.user?.role === 'admin';
    const defaultUsername = isAdmin ? undefined : req.user?.username;

    if (this.cloudSettings.isRemoteMode()) {
      const remoteQuery = { ...query };
      if (!isAdmin && req.user?.username) {
        remoteQuery.username = req.user.username;
      }
      return this.cloudClient.queryReadings(remoteQuery, this.extractToken(req));
    }

    if (this.cloudSettings.isStorageMode()) {
      return this.cloudStorage.queryReadings(query, defaultUsername);
    }

    return { items: [], total: 0, limit: query.limit ?? 100, offset: query.offset ?? 0 };
  }

  @Post('sync/retry')
  @UseGuards(JwtAuthGuard)
  retrySync() {
    return this.cloudSync.retryUnsyncedReadings();
  }
}

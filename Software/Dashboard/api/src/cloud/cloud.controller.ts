import {
  BadRequestException,
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
import { CloudMasterDataService } from './cloud-master-data.service';
import {
  CreateCloudMasterDataDto,
  DeleteCloudMasterDataDto,
  MASTER_ENTITY_TYPES,
  MasterEntityType,
  UpdateCloudMasterDataDto,
} from './dto/cloud-master-data.dto';
import { IngestLpnTraceDto } from './dto/ingest-lpn-trace.dto';

@Controller('cloud')
export class CloudController {
  constructor(
    private cloudSettings: CloudSettingsService,
    private cloudStorage: CloudStorageService,
    private cloudClient: CloudClientService,
    private cloudSync: CloudSyncService,
    private cloudMasterData: CloudMasterDataService,
  ) {}

  private extractToken(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice(7);
  }

  @Get('status')
  @UseGuards(CloudAccessGuard)
  async getStatus(@Req() req: Request) {
    const publicSettings = this.cloudSettings.getPublicSettings();
    if (this.cloudSettings.isRemoteMode()) {
      try {
        const [remote, localSync] = await Promise.all([
          this.cloudClient.getStatus(this.extractToken(req)),
          this.cloudSync.getSyncHealth(),
        ]);
        return {
          ...publicSettings,
          ...remote,
          ...localSync,
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
  async findScales(
    @Req() req: Request,
    @Query('includeInactive') includeInactive?: string,
  ) {
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

  @Post('trace-events')
  @UseGuards(CloudSyncApiKeyGuard)
  ingestTraceEvent(@Body() dto: IngestLpnTraceDto) {
    return this.cloudStorage.ingestTraceEvent(dto);
  }

  @Get('trace')
  @UseGuards(JwtAuthGuard)
  queryTrace(
    @Req() req: Request & { user?: { username: string; role: string } },
    @Query('packageUid') packageUid: string,
    @Query('stationId') stationId?: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!packageUid?.trim()) {
      return { packageUid: '', items: [], total: 0, limit: 0, offset: 0 };
    }
    const username =
      req.user?.role === 'admin' ? undefined : req.user?.username;
    const query = {
      username,
      stationId,
      eventType,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    };
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.queryTrace(
        packageUid,
        query,
        this.extractToken(req),
      );
    }
    return this.cloudStorage.queryTrace(packageUid, query);
  }

  @Get('master-data')
  @UseGuards(CloudAccessGuard)
  getMasterData(@Req() req: Request, @Query('since') since?: string) {
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.fetchMasterData(since);
    }
    return this.cloudMasterData.listSnapshot(since);
  }

  @Post('master-data/sync')
  @UseGuards(JwtAuthGuard)
  syncMasterDataCache() {
    return this.cloudMasterData.syncCache();
  }

  @Get('master-data/sync/status')
  @UseGuards(JwtAuthGuard)
  masterDataSyncStatus() {
    return this.cloudMasterData.getSyncStatus();
  }

  @Post('master-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createMasterData(
    @Req() req: Request & { user?: { userId?: number; username: string } },
    @Body() dto: CreateCloudMasterDataDto,
  ) {
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.createMasterData(dto, this.extractToken(req)!);
    }
    return this.cloudMasterData.create(dto, this.auditActor(req));
  }

  @Patch('master-data/:entityType/:cloudId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateMasterData(
    @Req() req: Request & { user?: { userId?: number; username: string } },
    @Param('entityType') rawEntityType: string,
    @Param('cloudId') cloudId: string,
    @Body() dto: UpdateCloudMasterDataDto,
  ) {
    const entityType = this.entityType(rawEntityType);
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.updateMasterData(
        entityType,
        cloudId,
        dto,
        this.extractToken(req)!,
      );
    }
    return this.cloudMasterData.update(
      entityType,
      cloudId,
      dto,
      this.auditActor(req),
    );
  }

  @Delete('master-data/:entityType/:cloudId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteMasterData(
    @Req() req: Request & { user?: { userId?: number; username: string } },
    @Param('entityType') rawEntityType: string,
    @Param('cloudId') cloudId: string,
    @Body() dto: DeleteCloudMasterDataDto,
  ) {
    const entityType = this.entityType(rawEntityType);
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.deleteMasterData(
        entityType,
        cloudId,
        dto,
        this.extractToken(req)!,
      );
    }
    return this.cloudMasterData.remove(
      entityType,
      cloudId,
      dto.expectedRevision,
      dto.reason,
      this.auditActor(req),
    );
  }

  @Get('master-data/:entityType/:cloudId/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getMasterDataHistory(
    @Req() req: Request,
    @Param('entityType') rawEntityType: string,
    @Param('cloudId') cloudId: string,
  ) {
    const entityType = this.entityType(rawEntityType);
    if (this.cloudSettings.isRemoteMode()) {
      return this.cloudClient.getMasterDataHistory(
        entityType,
        cloudId,
        this.extractToken(req)!,
      );
    }
    return this.cloudMasterData.getHistory(entityType, cloudId);
  }

  @Get('readings')
  @UseGuards(JwtAuthGuard)
  async queryReadings(
    @Req() req: Request & { user?: { username: string; role: string } },
    @Query() query: QueryCloudReadingsDto,
  ) {
    const isAdmin = req.user?.role === 'admin';
    const defaultUsername = isAdmin ? undefined : req.user?.username;

    if (this.cloudSettings.isRemoteMode()) {
      const remoteQuery = { ...query };
      if (!isAdmin && req.user?.username) {
        remoteQuery.username = req.user.username;
      }
      return this.cloudClient.queryReadings(
        remoteQuery,
        this.extractToken(req),
      );
    }

    if (this.cloudSettings.isStorageMode()) {
      return this.cloudStorage.queryReadings(query, defaultUsername);
    }

    return {
      items: [],
      total: 0,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    };
  }

  @Post('sync/retry')
  @UseGuards(JwtAuthGuard)
  retrySync() {
    return this.cloudSync.retryUnsyncedReadings();
  }

  private entityType(value: string): MasterEntityType {
    if (!MASTER_ENTITY_TYPES.includes(value as MasterEntityType)) {
      throw new BadRequestException(`Unsupported master-data entity: ${value}`);
    }
    return value as MasterEntityType;
  }

  private auditActor(
    req: Request & { user?: { userId?: number; username: string } },
  ) {
    return {
      userId: req.user?.userId,
      username: req.user?.username || 'unknown',
      stationId: this.cloudSettings.getEffective().stationId,
      deviceId: req.headers['x-device-id'] as string | undefined,
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }
}

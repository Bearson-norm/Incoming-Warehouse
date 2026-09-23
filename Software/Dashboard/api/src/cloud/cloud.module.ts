import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CloudController } from './cloud.controller';
import { CloudSettingsService } from './cloud-settings.service';
import { CloudStorageService } from './cloud-storage.service';
import { CloudClientService } from './cloud-client.service';
import { CloudSyncService } from './cloud-sync.service';
import { CloudSyncApiKeyGuard } from './guards/cloud-sync-api-key.guard';
import { CloudAccessGuard } from './guards/cloud-access.guard';
import { CloudMasterDataService } from './cloud-master-data.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CloudController],
  providers: [
    CloudSettingsService,
    CloudStorageService,
    CloudClientService,
    CloudSyncService,
    CloudSyncApiKeyGuard,
    CloudAccessGuard,
    CloudMasterDataService,
  ],
  exports: [
    CloudSettingsService,
    CloudSyncService,
    CloudClientService,
    CloudStorageService,
    CloudMasterDataService,
  ],
})
export class CloudModule {}

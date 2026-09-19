import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { isSqliteDatabaseUrl } from '../common/runtime-secrets';

export interface CloudSettingsStored {
  serverUrl: string;
  syncApiKey: string;
  stationId: string;
}

export interface CloudSettingsPublic {
  serverUrl: string;
  hasSyncApiKey: boolean;
  stationId: string;
  configured: boolean;
  source: 'override' | 'env' | 'none';
  settingsFile?: string;
}

@Injectable()
export class CloudSettingsService implements OnModuleInit {
  private override: Partial<CloudSettingsStored> | null = null;
  private readonly settingsFilePath: string;

  constructor(private configService: ConfigService) {
    const custom = this.configService.get<string>('CLOUD_SETTINGS_FILE')?.trim();
    this.settingsFilePath =
      custom || path.join(process.cwd(), 'data', 'cloud-settings.json');
  }

  onModuleInit() {
    this.loadFromFile();
    this.ensureStationId();
  }

  private loadFromFile(): void {
    try {
      if (!fs.existsSync(this.settingsFilePath)) {
        return;
      }
      const raw = fs.readFileSync(this.settingsFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<CloudSettingsStored>;
      this.override = {
        serverUrl: parsed.serverUrl?.trim() || undefined,
        syncApiKey: parsed.syncApiKey?.trim() || undefined,
        stationId: parsed.stationId?.trim() || undefined,
      };
    } catch {
      this.override = null;
    }
  }

  private saveToFile(): void {
    const dir = path.dirname(this.settingsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const effective = this.getEffectiveStored();
    fs.writeFileSync(
      this.settingsFilePath,
      JSON.stringify(
        {
          serverUrl: effective.serverUrl,
          syncApiKey: effective.syncApiKey,
          stationId: effective.stationId,
        },
        null,
        2,
      ),
      'utf-8',
    );
  }

  private envDefaults(): CloudSettingsStored {
    return {
      serverUrl: this.configService.get<string>('CLOUD_SERVER_URL')?.trim() || '',
      syncApiKey: this.configService.get<string>('CLOUD_SYNC_API_KEY')?.trim() || '',
      stationId: this.configService.get<string>('STATION_ID')?.trim() || '',
    };
  }

  private getEffectiveStored(): CloudSettingsStored {
    const env = this.envDefaults();
    const o = this.override || {};
    return {
      serverUrl: (o.serverUrl ?? env.serverUrl).replace(/\/$/, ''),
      syncApiKey: o.syncApiKey ?? env.syncApiKey,
      stationId: o.stationId ?? env.stationId,
    };
  }

  private ensureStationId(): void {
    const effective = this.getEffectiveStored();
    if (effective.stationId) {
      return;
    }
    const generated = crypto.randomUUID();
    this.override = {
      ...(this.override || {}),
      stationId: generated,
    };
    try {
      this.saveToFile();
    } catch {
      // non-fatal
    }
  }

  getEffective(): CloudSettingsStored {
    return this.getEffectiveStored();
  }

  getPublicSettings(): CloudSettingsPublic {
    const effective = this.getEffectiveStored();
    const hasOverride = Boolean(this.override?.serverUrl || this.override?.syncApiKey);
    const hasEnv = Boolean(
      this.configService.get<string>('CLOUD_SERVER_URL')?.trim() ||
        this.configService.get<string>('CLOUD_SYNC_API_KEY')?.trim(),
    );
    return {
      serverUrl: effective.serverUrl,
      hasSyncApiKey: Boolean(effective.syncApiKey),
      stationId: effective.stationId,
      configured: Boolean(effective.serverUrl && effective.syncApiKey),
      source: hasOverride ? 'override' : hasEnv ? 'env' : 'none',
      settingsFile: this.settingsFilePath,
    };
  }

  update(partial: Partial<CloudSettingsStored>): CloudSettingsPublic {
    const current = this.getEffectiveStored();
    this.override = {
      serverUrl:
        partial.serverUrl !== undefined
          ? partial.serverUrl.trim().replace(/\/$/, '')
          : current.serverUrl,
      syncApiKey:
        partial.syncApiKey !== undefined && partial.syncApiKey !== ''
          ? partial.syncApiKey.trim()
          : current.syncApiKey,
      stationId: current.stationId || crypto.randomUUID(),
    };
    this.saveToFile();
    return this.getPublicSettings();
  }

  getSyncApiKeyForValidation(): string {
    return this.getEffectiveStored().syncApiKey;
  }

  isRemoteMode(): boolean {
    const databaseUrl = this.configService.get<string>('DATABASE_URL') || '';
    const isLocalSqlite = isSqliteDatabaseUrl(databaseUrl);
    const serverUrl = this.getEffectiveStored().serverUrl;
    return isLocalSqlite && Boolean(serverUrl);
  }

  isStorageMode(): boolean {
    const databaseUrl = this.configService.get<string>('DATABASE_URL') || '';
    return !isSqliteDatabaseUrl(databaseUrl);
  }

  getSettingsFilePath(): string {
    return this.settingsFilePath;
  }
}

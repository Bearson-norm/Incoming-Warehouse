import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface OdooSettingsStored {
  baseUrl: string;
  iotApiKey: string;
}

export interface OdooSettingsPublic {
  baseUrl: string;
  hasApiKey: boolean;
  source: 'override' | 'env' | 'none';
  settingsFile?: string;
}

@Injectable()
export class OdooSettingsService implements OnModuleInit {
  private override: Partial<OdooSettingsStored> | null = null;
  private readonly settingsFilePath: string;

  constructor(private configService: ConfigService) {
    const custom = this.configService.get<string>('ODOO_SETTINGS_FILE')?.trim();
    this.settingsFilePath =
      custom ||
      path.join(process.cwd(), 'data', 'odoo-settings.json');
  }

  onModuleInit() {
    this.loadFromFile();
  }

  private loadFromFile(): void {
    try {
      if (!fs.existsSync(this.settingsFilePath)) {
        return;
      }
      const raw = fs.readFileSync(this.settingsFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<OdooSettingsStored>;
      this.override = {
        baseUrl: parsed.baseUrl?.trim() || undefined,
        iotApiKey: parsed.iotApiKey?.trim() || undefined,
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
          baseUrl: effective.baseUrl,
          iotApiKey: effective.iotApiKey,
        },
        null,
        2,
      ),
      'utf-8',
    );
  }

  private envDefaults(): OdooSettingsStored {
    return {
      baseUrl: this.configService.get<string>('ODOO_BASE_URL')?.trim() || '',
      iotApiKey:
        this.configService.get<string>('ODOO_IOT_API_KEY')?.trim() || '',
    };
  }

  private getEffectiveStored(): OdooSettingsStored {
    const env = this.envDefaults();
    const o = this.override || {};
    return {
      baseUrl: (o.baseUrl ?? env.baseUrl).replace(/\/$/, ''),
      iotApiKey: o.iotApiKey !== undefined && o.iotApiKey !== '' ? o.iotApiKey : env.iotApiKey,
    };
  }

  getPublicSettings(): OdooSettingsPublic {
    const env = this.envDefaults();
    const effective = this.getEffectiveStored();
    const hasOverrideFile = this.override !== null && fs.existsSync(this.settingsFilePath);

    let source: OdooSettingsPublic['source'] = 'none';
    if (hasOverrideFile && (this.override?.baseUrl || this.override?.iotApiKey)) {
      source = 'override';
    } else if (env.baseUrl || env.iotApiKey) {
      source = 'env';
    }

    return {
      baseUrl: effective.baseUrl,
      hasApiKey: Boolean(effective.iotApiKey),
      source,
      settingsFile: this.settingsFilePath,
    };
  }

  getBaseUrl(): string {
    const base = this.getEffectiveStored().baseUrl;
    if (!base) {
      return '';
    }
    return base.replace(/\/$/, '');
  }

  getApiKey(): string {
    return this.getEffectiveStored().iotApiKey;
  }

  isConfigured(): boolean {
    const s = this.getEffectiveStored();
    return Boolean(s.baseUrl && s.iotApiKey);
  }

  /**
   * Update runtime override (takes effect immediately, no API restart).
   * Empty iotApiKey keeps the current stored/env key.
   */
  update(partial: { baseUrl?: string; iotApiKey?: string }): OdooSettingsPublic {
    const current = this.getEffectiveStored();
    const next: OdooSettingsStored = {
      baseUrl:
        partial.baseUrl !== undefined
          ? partial.baseUrl.trim().replace(/\/$/, '')
          : current.baseUrl,
      iotApiKey:
        partial.iotApiKey !== undefined && partial.iotApiKey.trim() !== ''
          ? partial.iotApiKey.trim()
          : current.iotApiKey,
    };

    this.override = {
      baseUrl: next.baseUrl,
      iotApiKey: next.iotApiKey,
    };
    this.saveToFile();
    return this.getPublicSettings();
  }

  /** Sync from external source (e.g. Electron config.json on API start). */
  applyBootstrap(partial: { baseUrl?: string; iotApiKey?: string }): void {
    if (!partial.baseUrl && !partial.iotApiKey) {
      return;
    }
    if (!fs.existsSync(this.settingsFilePath)) {
      this.override = {
        baseUrl: partial.baseUrl?.trim().replace(/\/$/, ''),
        iotApiKey: partial.iotApiKey?.trim(),
      };
      if (this.override.baseUrl || this.override.iotApiKey) {
        this.saveToFile();
      }
    }
  }
}

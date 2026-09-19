import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { testSqliteDatabase, DbConnectionTestResult } from './db-connection-test';
import {
  buildSqliteDatabaseUrl,
  ensurePortableDataDirectory,
  getPortableDataDirectory,
  getSqliteDatabasePath,
  sqliteDatabaseExists,
} from './sqlite-path';
import { LOCAL_ADMIN_PASSWORD } from './local-credentials';

export interface GatewayConfig {
  enabled: boolean;
  autoStart: boolean;
}

export interface OdooConfig {
  baseUrl: string;
  iotApiKey: string;
}

export interface CloudConfig {
  serverUrl: string;
  syncApiKey: string;
  stationId: string;
}

export interface DatabaseConfig {
  /** Ignored on local devices. Electron always uses SQLite next to the exe. */
  url?: string;
}

export interface ElectronConfig {
  gateway: GatewayConfig;
  odoo: OdooConfig;
  cloud: CloudConfig;
  database: DatabaseConfig;
  jwtSecret: string;
  gatewayApiKey: string;
  adminInitialPassword: string;
}

const DEFAULT_CONFIG: ElectronConfig = {
  gateway: {
    enabled: true,
    autoStart: false,
  },
  odoo: {
    baseUrl: '',
    iotApiKey: '',
  },
  cloud: {
    serverUrl: '',
    syncApiKey: '',
    stationId: '',
  },
  database: {},
  jwtSecret: '',
  gatewayApiKey: '',
  adminInitialPassword: '',
};

function randomSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class ConfigManager {
  private config: ElectronConfig;
  private configFilePath: string;

  constructor() {
    const { config, filePath } = this.loadConfig();
    this.config = config;
    this.configFilePath = filePath;
    ensurePortableDataDirectory();
    this.ensureSecrets();
  }

  private resolveConfigFilePath(): string {
    return path.join(getPortableDataDirectory(), 'config.json');
  }

  private ensureConfigDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadConfig(): { config: ElectronConfig; filePath: string } {
    const filePath = this.resolveConfigFilePath();

    if (fs.existsSync(filePath)) {
      try {
        const loaded = this.parseConfigFile(filePath);
        if (loaded) {
          return { config: loaded, filePath };
        }
      } catch (error) {
        console.error('Error loading config:', error);
      }
    }

    return { config: { ...DEFAULT_CONFIG }, filePath };
  }

  private parseConfigFile(filePath: string): ElectronConfig | null {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const loaded = JSON.parse(fileContent) as Partial<ElectronConfig> & {
      database?: Partial<DatabaseConfig> | unknown;
    };

    return {
      gateway: { ...DEFAULT_CONFIG.gateway, ...loaded.gateway },
      odoo: { ...DEFAULT_CONFIG.odoo, ...loaded.odoo },
      cloud: { ...DEFAULT_CONFIG.cloud, ...(loaded as Partial<ElectronConfig>).cloud },
      database: {},
      jwtSecret: loaded.jwtSecret || '',
      gatewayApiKey: loaded.gatewayApiKey || '',
      adminInitialPassword: loaded.adminInitialPassword || '',
    };
  }

  private ensureSecrets(): void {
    let changed = false;
    if (!this.config.jwtSecret) {
      this.config.jwtSecret = randomSecret();
      changed = true;
    }
    if (!this.config.gatewayApiKey) {
      this.config.gatewayApiKey = randomSecret();
      changed = true;
    }
    if (!this.config.adminInitialPassword) {
      this.config.adminInitialPassword = LOCAL_ADMIN_PASSWORD;
      changed = true;
    }
    if (!this.config.cloud.stationId) {
      this.config.cloud.stationId = crypto.randomUUID();
      changed = true;
    }
    if (changed) {
      try {
        this.saveConfigSync();
      } catch (error) {
        console.error('Error persisting generated secrets:', error);
      }
    }
  }

  getConfig(): ElectronConfig {
    return {
      ...this.config,
      gateway: { ...this.config.gateway },
      odoo: { ...this.config.odoo },
      cloud: { ...this.config.cloud },
      database: { ...this.config.database },
    };
  }

  getDatabaseUrl(): string {
    return buildSqliteDatabaseUrl(getSqliteDatabasePath());
  }

  getDatabaseInfo() {
    const dbPath = getSqliteDatabasePath();
    return {
      configured: true,
      engine: 'sqlite' as const,
      dbPath,
      exists: sqliteDatabaseExists(),
      urlMasked: dbPath,
      configPath: this.configFilePath,
      dataDirectory: getPortableDataDirectory(),
    };
  }

  async setDatabaseUrl(_url: string): Promise<void> {
    // Local devices always use SQLite next to the exe.
  }

  getJwtSecret(): string {
    return this.config.jwtSecret;
  }

  getGatewayApiKey(): string {
    return this.config.gatewayApiKey;
  }

  getAdminInitialPassword(): string {
    return this.config.adminInitialPassword;
  }

  getGatewayConfig(): GatewayConfig {
    return { ...this.config.gateway };
  }

  getOdooConfig(): OdooConfig {
    return { ...this.config.odoo };
  }

  resolveOdooConfig(partial: Partial<OdooConfig>): OdooConfig {
    return {
      baseUrl: (partial.baseUrl ?? this.config.odoo.baseUrl).trim().replace(/\/$/, ''),
      iotApiKey:
        partial.iotApiKey !== undefined && partial.iotApiKey !== ''
          ? partial.iotApiKey.trim()
          : this.config.odoo.iotApiKey,
    };
  }

  async setOdooConfig(odooConfig: Partial<OdooConfig>): Promise<void> {
    this.config.odoo = this.resolveOdooConfig(odooConfig);
    await this.saveConfig();
    this.writeOdooSettingsFile(this.config.odoo);
  }

  writeOdooSettingsFile(odoo: OdooConfig): void {
    try {
      const settingsPath = path.join(getPortableDataDirectory(), 'odoo-settings.json');
      const dir = path.dirname(settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        settingsPath,
        JSON.stringify(
          {
            baseUrl: odoo.baseUrl.replace(/\/$/, ''),
            iotApiKey: odoo.iotApiKey,
          },
          null,
          2,
        ),
        'utf-8',
      );
    } catch (error) {
      console.error('Error writing odoo-settings.json:', error);
    }
  }

  getOdooSettingsFilePath(): string {
    return path.join(getPortableDataDirectory(), 'odoo-settings.json');
  }

  getCloudConfig(): CloudConfig {
    return { ...this.config.cloud };
  }

  resolveCloudConfig(partial: Partial<CloudConfig>): CloudConfig {
    return {
      serverUrl: (partial.serverUrl ?? this.config.cloud.serverUrl).trim().replace(/\/$/, ''),
      syncApiKey:
        partial.syncApiKey !== undefined && partial.syncApiKey !== ''
          ? partial.syncApiKey.trim()
          : this.config.cloud.syncApiKey,
      stationId: this.config.cloud.stationId || crypto.randomUUID(),
    };
  }

  async setCloudConfig(cloudConfig: Partial<CloudConfig>): Promise<void> {
    this.config.cloud = this.resolveCloudConfig(cloudConfig);
    await this.saveConfig();
    this.writeCloudSettingsFile(this.config.cloud);
  }

  writeCloudSettingsFile(cloud: CloudConfig): void {
    try {
      const settingsPath = path.join(getPortableDataDirectory(), 'cloud-settings.json');
      const dir = path.dirname(settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        settingsPath,
        JSON.stringify(
          {
            serverUrl: cloud.serverUrl.replace(/\/$/, ''),
            syncApiKey: cloud.syncApiKey,
            stationId: cloud.stationId,
          },
          null,
          2,
        ),
        'utf-8',
      );
    } catch (error) {
      console.error('Error writing cloud-settings.json:', error);
    }
  }

  getCloudSettingsFilePath(): string {
    return path.join(getPortableDataDirectory(), 'cloud-settings.json');
  }

  async setGatewayConfig(gatewayConfig: Partial<GatewayConfig>): Promise<void> {
    this.config.gateway = {
      ...this.config.gateway,
      ...gatewayConfig,
    };

    await this.saveConfig();
  }

  private saveConfigSync(): void {
    const dir = path.dirname(this.configFilePath);
    if (dir) {
      this.ensureConfigDir(dir);
    }
    fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  private async saveConfig(): Promise<void> {
    try {
      this.saveConfigSync();
      console.log('[Config] Saved to', this.configFilePath);

      const fileContent = fs.readFileSync(this.configFilePath, 'utf-8');
      const parsed = this.parseConfigFile(this.configFilePath);
      if (parsed) {
        this.config = parsed;
      }
      void fileContent;
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  async validateDatabase(): Promise<DbConnectionTestResult> {
    return testSqliteDatabase();
  }

  getConfigFilePath(): string {
    return this.configFilePath;
  }

  getDataDirectory(): string {
    return getPortableDataDirectory();
  }

  isPortableMode(): boolean {
    return app.isPackaged;
  }
}

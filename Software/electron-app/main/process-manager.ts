import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { ConfigManager, ElectronConfig } from './config-manager';

export interface ProcessStatus {
  api: {
    running: boolean;
    pid?: number;
    port?: number;
  };
  gateway: {
    running: boolean;
    pid?: number;
  };
}

export interface GatewayDeviceConfig {
  serial: {
    port: string;
    baudRate: number;
    parity: 'none' | 'even' | 'odd';
    dataBits: 5 | 6 | 7 | 8;
    stopBits: 1 | 1.5 | 2;
    autoDetect: boolean;
  };
  stable: {
    windowMs: number;
    pattern: string;
    unstablePattern: string;
  };
}

export interface GatewaySerialPort {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export class ProcessManager {
  private apiProcess: ChildProcess | null = null;
  private gatewayProcess: ChildProcess | null = null;
  private configManager: ConfigManager;
  private apiPort: number = 4123;
  private lastApiError: string = '';
  private apiErrorLog: string = '';
  private apiRestartAttempts: number = 0;
  private readonly maxApiRestartAttempts = 5;
  private manualRestartInProgress = false;

  /** Extract a short, user-facing message from noisy API stderr (Prisma/Nest). */
  private summarizeApiError(log: string): string {
    if (!log.trim()) {
      return '';
    }

    if (/db-bootstrap|migrate deploy|DATABASE_URL|placeholder/i.test(log)) {
      const hint = log.match(/\[db-bootstrap\][^\n]+/i);
      if (hint) {
        return hint[0].trim();
      }
      return 'Gagal menyiapkan database SQLite. Pastikan folder aplikasi bisa ditulis, atau gunakan win-unpacked (bukan Setup di Program Files).';
    }

    if (/P1001|Can't reach database/i.test(log)) {
      return 'Database SQLite tidak dapat diakses. Periksa folder aplikasi dan file incoming-warehouse.db.';
    }

    if (/EADDRINUSE|port.*4123/i.test(log)) {
      return 'Port 4123 sudah dipakai. Tutup aplikasi/API lain lalu coba lagi.';
    }

    if (/ECONNREFUSED|Connection refused|ETIMEDOUT/i.test(log)) {
      return 'Layanan API tidak merespons. Coba restart aplikasi.';
    }

    const prismaInit = log.match(/PrismaClientInitializationError:\s*([^\n]{1,200})/i);
    if (prismaInit) {
      return prismaInit[1].trim();
    }

    const lines = log.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const useful = lines.find(
      (l) =>
        /Error|ERROR|failed|Prisma|Exception/i.test(l) &&
        l.length >= 10 &&
        l.length <= 300 &&
        !/library\.js:\d+/i.test(l),
    );
    return useful || 'API gagal start. Periksa file SQLite di folder aplikasi.';
  }

  private isRetryableStartupError(message: string): boolean {
    return /P1001|Can't reach database|ECONNREFUSED|ETIMEDOUT|timeout|tidak bisa terhubung/i.test(
      message,
    );
  }

  private appendApiLog(chunk: string): void {
    this.apiErrorLog = (this.apiErrorLog + chunk).slice(-12000);
    this.lastApiError = this.summarizeApiError(this.apiErrorLog);
  }

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  private async requestGatewayConfig<T>(
    endpoint: string,
    init?: { method?: 'GET' | 'POST'; body?: unknown },
  ): Promise<T> {
    const response = await fetch(`http://127.0.0.1:4124${endpoint}`, {
      method: init?.method || 'GET',
      headers: {
        'X-Gateway-Key': this.configManager.getGatewayApiKey(),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        const parsed = JSON.parse(text) as { error?: string };
        message = parsed.error || text;
      } catch {
        // Keep the raw response.
      }
      throw new Error(`Gateway configuration request failed (${response.status}): ${message}`);
    }

    return (text ? JSON.parse(text) : {}) as T;
  }

  private async waitForGatewayConfig(timeoutMs = 8000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: Error | null = null;

    while (Date.now() < deadline) {
      try {
        await this.requestGatewayConfig('/api/config');
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    throw new Error(
      lastError?.message || 'Gateway configuration service did not become ready.',
    );
  }

  private async ensureGatewayConfigReady(): Promise<void> {
    if (!this.isProcessAlive(this.gatewayProcess)) {
      await this.startGateway();
    }
    await this.waitForGatewayConfig();
  }

  async getGatewayDeviceConfig(): Promise<GatewayDeviceConfig> {
    await this.ensureGatewayConfigReady();
    const config = await this.requestGatewayConfig<
      GatewayDeviceConfig & { server?: { url?: string; apiKey?: string } }
    >('/api/config');
    return {
      serial: config.serial,
      stable: config.stable,
    };
  }

  async listGatewaySerialPorts(): Promise<GatewaySerialPort[]> {
    await this.ensureGatewayConfigReady();
    return this.requestGatewayConfig<GatewaySerialPort[]>('/api/serial-ports');
  }

  async saveGatewayDeviceConfig(config: GatewayDeviceConfig): Promise<void> {
    await this.ensureGatewayConfigReady();
    await this.requestGatewayConfig('/api/config', {
      method: 'POST',
      body: {
        serial: config.serial,
        server: {
          url: `http://localhost:${this.apiPort}`,
          apiKey: this.configManager.getGatewayApiKey(),
        },
        stable: config.stable,
      },
    });

    await this.stopGateway();
    await this.startGateway();
    await this.waitForGatewayConfig();
  }

  /**
   * Path to Node.js for spawning API/Gateway.
   * Packaged: optional bundled copy at resources/nodejs/node(.exe) (see docs).
   * Otherwise uses `node` from PATH — install Node on target machines or bundle it for USB/offline use.
   */
  private getNodeExecutable(): string {
    const win = process.platform === 'win32';
    const nodeBin = win ? 'node.exe' : 'node';
    if (app.isPackaged) {
      const bundled = path.join(process.resourcesPath, 'resources', 'nodejs', nodeBin);
      if (fs.existsSync(bundled)) {
        return bundled;
      }
    }
    return 'node';
  }

  private getResourcesPath(): string {
    // In development, use actual paths
    // In production (packaged), use app.getAppPath() or app.getPath('exe')
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    if (isDev) {
      // Development mode - use relative paths
      const appRoot = path.resolve(__dirname, '../../..');
      return path.join(appRoot, 'Dashboard');
    } else {
      // Production mode - use resources path
      // In packaged app, resources are in app.asar or app directory
      const appPath = app.getAppPath();
      // If in asar, get path to unpacked resources
      if (appPath.includes('.asar')) {
        return appPath.replace('.asar', '.asar.unpacked');
      }
      return path.join(path.dirname(appPath), 'resources');
    }
  }

  private getGatewayPath(): string {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
      const appRoot = path.resolve(__dirname, '../../..');
      return path.join(appRoot, 'Gateway', 'app');
    }

    const candidates = [
      path.join(process.resourcesPath, 'resources', 'gateway'),
      path.join(path.dirname(app.getAppPath()), 'resources', 'gateway'),
    ];
    for (const gatewayPath of candidates) {
      if (this.resolveGatewayMainFile(gatewayPath)) {
        return gatewayPath;
      }
    }
    return candidates[0];
  }

  /** Packaged extraResources copy dist/* into resources/gateway (index.js at root, not dist/). */
  private resolveGatewayMainFile(gatewayPath: string): string | undefined {
    const candidates = [
      path.join(gatewayPath, 'dist', 'index.js'),
      path.join(gatewayPath, 'index.js'),
    ];
    return candidates.find((p) => fs.existsSync(p));
  }

  private isProcessAlive(proc: ChildProcess | null): boolean {
    if (!proc || proc.killed || proc.exitCode !== null) {
      return false;
    }
    if (!proc.pid) {
      return false;
    }
    try {
      process.kill(proc.pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private validatePackagedApiDeps(apiPath: string): void {
    if (!app.isPackaged) {
      return;
    }
    const nestCore = path.join(apiPath, 'node_modules', '@nestjs', 'core');
    if (!fs.existsSync(nestCore)) {
      throw new Error(
        'Packaged API is missing dependencies (node_modules/@nestjs/core). ' +
          'Rebuild with: npm run package:electron:win from the project root. ' +
          'Do not copy only the .exe — include the full win-unpacked folder with resources/.'
      );
    }
  }

  private async waitForApiHealth(timeoutMs: number = 90000): Promise<void> {
    const url = `http://127.0.0.1:${this.apiPort}/api/health`;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (!this.isProcessAlive(this.apiProcess)) {
        const hint =
          this.lastApiError ||
          'Proses API berhenti. Periksa file SQLite di folder aplikasi.';
        throw new Error(hint);
      }

      try {
        const res = await fetch(url);
        if (res.ok) {
          return;
        }
      } catch {
        // API still starting
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    const hint =
      this.lastApiError ||
      'Periksa folder aplikasi bisa ditulis dan restart aplikasi.';
    throw new Error(
      `API tidak merespons di http://127.0.0.1:${this.apiPort}/api/health setelah ${timeoutMs / 1000}s. ${hint}`,
    );
  }

  getLastApiError(): string {
    return this.lastApiError;
  }

  private getApiPath(): string {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    if (isDev) {
      const appRoot = path.resolve(__dirname, '../../..');
      return path.join(appRoot, 'Dashboard', 'api');
    } else {
      // extraResources "to": "resources/api" → process.resourcesPath/resources/api
      // Works when app is copied (Downloads, USB, etc.)
      const apiPath = path.join(process.resourcesPath, 'resources', 'api');
      if (fs.existsSync(path.join(apiPath, 'src', 'main.js')) || fs.existsSync(path.join(apiPath, 'dist', 'src', 'main.js'))) {
        return apiPath;
      }
      // Fallback: app.getAppPath() for portable/alternative layouts
      const appPath = app.getAppPath();
      const fallbackPath = path.join(path.dirname(appPath), 'resources', 'api');
      return fallbackPath;
    }
  }

  async startApi(): Promise<void> {
    if (this.apiProcess) {
      console.log('API process already running');
      return;
    }

    const apiPath = this.getApiPath();
    this.validatePackagedApiDeps(apiPath);
    // Resolve main.js - path varies by context:
    // - Dev: Dashboard/api/dist/main.js or dist/src/main.js (NestJS)
    // - Packaged: resources/api/ has dist contents copied directly, so src/main.js (no dist folder)
    const candidates = [
      path.join(apiPath, 'dist', 'main.js'),
      path.join(apiPath, 'dist', 'src', 'main.js'),
      path.join(apiPath, 'src', 'main.js'),
      path.join(apiPath, 'main.js'),
    ];
    const mainFile = candidates.find((p) => fs.existsSync(p));

    if (!mainFile) {
      const resourcesInfo = app.isPackaged ? `\nResources path: ${process.resourcesPath}` : '';
      throw new Error(
        `API build not found at ${apiPath}. Tried: dist/main.js, dist/src/main.js, src/main.js, main.js.` +
        `\n\nEnsure you copied the full app folder (including resources/) when moving the app.${resourcesInfo}`
      );
    }

    const config = this.configManager.getConfig();
    const databaseUrl = this.configManager.getDatabaseUrl();
    const odoo = config.odoo;
    const odooBaseUrl =
      odoo.baseUrl?.trim() ||
      process.env.ODOO_BASE_URL?.trim() ||
      '';
    const odooIotKey =
      odoo.iotApiKey?.trim() ||
      process.env.ODOO_IOT_API_KEY?.trim() ||
      '';
    const cloud = config.cloud;
    const cloudServerUrl =
      cloud.serverUrl?.trim() ||
      process.env.CLOUD_SERVER_URL?.trim() ||
      '';
    const cloudSyncApiKey =
      cloud.syncApiKey?.trim() ||
      process.env.CLOUD_SYNC_API_KEY?.trim() ||
      '';
    const stationId =
      cloud.stationId?.trim() ||
      process.env.STATION_ID?.trim() ||
      '';

    // In dev, Electron loads from Vite (4234); in prod, from file:// (Origin: null)
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const corsOrigin = isDev ? 'http://localhost:4234' : 'null';

    // Set environment variables for API
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: this.apiPort.toString(),
      DATABASE_URL: databaseUrl,
      CORS_ORIGIN: corsOrigin,
      JWT_SECRET: this.configManager.getJwtSecret(),
      GATEWAY_API_KEY: this.configManager.getGatewayApiKey(),
      ADMIN_INITIAL_PASSWORD: this.configManager.getAdminInitialPassword(),
      ODOO_BASE_URL: odooBaseUrl,
      ODOO_IOT_API_KEY: odooIotKey,
      ODOO_SETTINGS_FILE: this.configManager.getOdooSettingsFilePath(),
      CLOUD_SERVER_URL: cloudServerUrl,
      CLOUD_SYNC_API_KEY: cloudSyncApiKey,
      STATION_ID: stationId,
      CLOUD_SETTINGS_FILE: this.configManager.getCloudSettingsFilePath(),
    };

    console.log(`Starting API server on port ${this.apiPort}...`);
    console.log(`SQLite: ${this.configManager.getDatabaseInfo().dbPath}`);

    this.apiProcess = spawn(this.getNodeExecutable(), [mainFile], {
      cwd: apiPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.apiErrorLog = '';
    this.lastApiError = '';

    this.apiProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      this.appendApiLog(text);
      console.error(`[API Error] ${text.trim()}`);
    });

    this.apiProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      console.log(`[API] ${text.trim()}`);
      if (/error|failed|EADDRINUSE|PrismaClientInitializationError/i.test(text)) {
        this.appendApiLog(text);
      }
    });

    this.apiProcess.on('exit', (code, signal) => {
      console.log(`API process exited with code ${code}, signal ${signal}`);
      this.apiProcess = null;

      if (
        !this.manualRestartInProgress &&
        code !== 0 &&
        code !== null &&
        this.apiRestartAttempts < this.maxApiRestartAttempts
      ) {
        this.apiRestartAttempts += 1;
        const delayMs = Math.min(3000 * this.apiRestartAttempts, 15000);
        console.log(`API crashed, restart attempt ${this.apiRestartAttempts}/${this.maxApiRestartAttempts} in ${delayMs}ms...`);
        setTimeout(() => {
          if (!this.apiProcess) {
            this.startApi().catch((err) => {
              console.error('API restart failed:', err);
              this.lastApiError = err instanceof Error ? err.message : String(err);
            });
          }
        }, delayMs);
      } else if (code !== 0 && code !== null) {
        this.lastApiError =
          this.lastApiError ||
          'API stopped after repeated failures. Rebuild the app or check database connection (Settings).';
      }
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('API process failed to spawn within 10 seconds'));
      }, 10000);

      this.apiProcess?.once('spawn', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await this.waitForApiHealth();
    this.apiRestartAttempts = 0;
  }

  async stopApi(): Promise<void> {
    if (this.apiProcess) {
      console.log('Stopping API server...');
      this.apiProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        if (this.apiProcess) {
          this.apiProcess.once('exit', () => resolve());
          setTimeout(() => {
            if (this.apiProcess) {
              this.apiProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        } else {
          resolve();
        }
      });

      this.apiProcess = null;
    }
  }

  async startGateway(): Promise<void> {
    if (this.gatewayProcess) {
      console.log('Gateway process already running');
      return;
    }

    const gatewayPath = this.getGatewayPath();
    const mainFile = this.resolveGatewayMainFile(gatewayPath);

    if (!mainFile) {
      throw new Error(
        `Gateway build not found at ${gatewayPath}. Tried dist/index.js and index.js. Please rebuild the Electron package.`
      );
    }

    const config = this.configManager.getConfig();
    
    if (!config.gateway.enabled) {
      console.log('Gateway is disabled in config');
      return;
    }

    // Gateway connects to local API
    const serverUrl = `http://localhost:${this.apiPort}`;

    console.log(`Starting Gateway, connecting to ${serverUrl}...`);

    // Writable gateway config (never under Program Files / read-only resources)
    const gatewayConfigPath = path.join(os.homedir(), '.incoming-warehouse-gateway', 'config.json');

    // Set environment variables for Gateway
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      SERVER_URL: serverUrl,
      GATEWAY_CONFIG_PATH: gatewayConfigPath,
      GATEWAY_API_KEY: this.configManager.getGatewayApiKey(),
    };

    this.gatewayProcess = spawn(this.getNodeExecutable(), [mainFile], {
      cwd: gatewayPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.gatewayProcess.stdout?.on('data', (data) => {
      console.log(`[Gateway] ${data.toString().trim()}`);
    });

    this.gatewayProcess.stderr?.on('data', (data) => {
      console.error(`[Gateway Error] ${data.toString().trim()}`);
    });

    this.gatewayProcess.on('exit', (code, signal) => {
      console.log(`Gateway process exited with code ${code}, signal ${signal}`);
      this.gatewayProcess = null;
    });
  }

  async stopGateway(): Promise<void> {
    if (this.gatewayProcess) {
      console.log('Stopping Gateway...');
      this.gatewayProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        if (this.gatewayProcess) {
          this.gatewayProcess.once('exit', () => resolve());
          setTimeout(() => {
            if (this.gatewayProcess) {
              this.gatewayProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        } else {
          resolve();
        }
      });

      this.gatewayProcess = null;
    }
  }

  getStatus(): ProcessStatus {
    return {
      api: {
        running: this.isProcessAlive(this.apiProcess),
        pid: this.apiProcess?.pid,
        port: this.apiPort,
      },
      gateway: {
        running: this.isProcessAlive(this.gatewayProcess),
        pid: this.gatewayProcess?.pid,
      },
    };
  }

  async startApiWithRetry(
    maxAttempts: number = 5,
    delayBetweenAttemptsMs: number = 8000,
  ): Promise<void> {
    let lastError: Error | null = null;
    this.manualRestartInProgress = true;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await this.stopApi();
          await this.startApi();
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`API start attempt ${attempt}/${maxAttempts} failed:`, lastError.message);
          await this.stopApi();

          const canRetry =
            attempt < maxAttempts && this.isRetryableStartupError(lastError.message);
          if (!canRetry) {
            break;
          }

          console.log(`Retrying API start in ${delayBetweenAttemptsMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayBetweenAttemptsMs));
        }
      }

      throw lastError ?? new Error('API gagal dijalankan.');
    } finally {
      this.manualRestartInProgress = false;
    }
  }

  async restartApi(): Promise<void> {
    this.apiRestartAttempts = 0;
    this.lastApiError = '';
    this.apiErrorLog = '';
    await this.startApiWithRetry(3, 5000);
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up processes...');
    await Promise.all([
      this.stopApi(),
      this.stopGateway(),
    ]);
  }
}

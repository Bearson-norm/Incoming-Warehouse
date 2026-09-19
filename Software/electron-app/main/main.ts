import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from './config-manager';
import { ProcessManager } from './process-manager';

let mainWindow: BrowserWindow | null = null;
let configManager: ConfigManager;
let processManager: ProcessManager;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function resolvePackagedWebIndex(): string | null {
  const candidates = [
    path.join(process.resourcesPath, 'resources', 'web', 'index.html'),
    path.join(process.resourcesPath, 'web', 'index.html'),
    path.join(path.dirname(app.getAppPath()), 'resources', 'web', 'index.html'),
    path.join(path.dirname(process.execPath), 'resources', 'resources', 'web', 'index.html'),
    path.join(path.dirname(process.execPath), 'resources', 'web', 'index.html'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function getSplashHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Incoming Warehouse</title>
  <style>
    html, body {
      height: 100%;
      margin: 0;
      background: #0f172a;
      color: #e2e8f0;
      font-family: "Segoe UI", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .box { text-align: center; }
    h1 { font-size: 22px; font-weight: 600; margin: 0 0 8px; }
    p { margin: 0; color: #94a3b8; font-size: 14px; }
    .dots { margin-top: 18px; }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin: 0 3px;
      border-radius: 50%;
      background: #38bdf8;
      animation: pulse 0.9s infinite alternate;
    }
    .dot:nth-child(2) { animation-delay: 0.15s; }
    .dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes pulse { from { opacity: 0.25; } to { opacity: 1; } }
  </style>
</head>
<body>
  <div class="box">
    <h1>Incoming Warehouse</h1>
    <p>Menyiapkan sistem...</p>
    <div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
  </div>
</body>
</html>`;
}

function loadMainUi(): void {
  if (!mainWindow) {
    return;
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:4234');
    return;
  }

  const webIndex = resolvePackagedWebIndex();
  if (!webIndex) {
    dialog.showErrorBox(
      'Failed to Load UI',
      'index.html tidak ditemukan di resources/web. Salin seluruh folder win-unpacked (termasuk resources/).',
    );
    return;
  }
  mainWindow.loadFile(webIndex);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Allow file:// to fetch localhost:4123 (packaged app loads from file://)
      webSecurity: !app.isPackaged,
    },
    icon: path.join(__dirname, '../../resources/icon.png'),
    titleBarStyle: 'default',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:4234');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getSplashHtml())}`);
    mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
      console.error('UI failed to load', { code, desc, url });
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeManagers(): void {
  configManager = new ConfigManager();
  processManager = new ProcessManager(configManager);
  setupIpcHandlers();
}

async function startBackgroundServices(): Promise<void> {
  try {
    await processManager.startApiWithRetry(6, 8000);
    console.log('API server started successfully');
  } catch (error) {
    console.error('Failed to start API server:', error);
    const detail = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox(
      'Failed to Start API',
      `${detail}\n\nLangkah perbaikan:\n1. Pastikan folder aplikasi (tempat Incoming Warehouse.exe) bisa ditulis\n2. Restart API dari Settings\n3. Tutup aplikasi lain yang memakai port 4123`,
    );
  }

  const gatewayConfig = configManager.getGatewayConfig();
  if (gatewayConfig.autoStart && gatewayConfig.enabled) {
    try {
      await processManager.startGateway();
      console.log('Gateway started successfully');
    } catch (error) {
      console.error('Failed to start Gateway:', error);
    }
  }
}

function setupIpcHandlers() {
  ipcMain.handle('config:get-database', async () => {
    return configManager.getDatabaseInfo();
  });

  ipcMain.handle('config:set-database', async (_event: IpcMainInvokeEvent, payload: { url?: string }) => {
    try {
      await configManager.setDatabaseUrl(payload?.url || '');
      return { success: true, ...configManager.getDatabaseInfo() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('config:test-database', async () => {
    try {
      const result = await configManager.validateDatabase();
      if (!result.ok) {
        return { success: false, error: result.error || 'SQLite tidak siap.' };
      }
      return { success: true, dbPath: result.dbPath, exists: result.exists };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('config:open-data-folder', async () => {
    const { shell } = await import('electron');
    const info = configManager.getDatabaseInfo();
    await shell.openPath(info.dataDirectory);
    return { success: true, path: info.dataDirectory };
  });

  ipcMain.handle('config:get-odoo', async () => {
    const odoo = configManager.getOdooConfig();
    return {
      baseUrl: odoo.baseUrl,
      hasApiKey: Boolean(odoo.iotApiKey),
      configPath: configManager.getConfigFilePath(),
      settingsFile: configManager.getOdooSettingsFilePath(),
    };
  });

  ipcMain.handle('config:get-cloud', async () => {
    const cloud = configManager.getCloudConfig();
    return {
      serverUrl: cloud.serverUrl,
      hasSyncApiKey: Boolean(cloud.syncApiKey),
      stationId: cloud.stationId,
      configPath: configManager.getConfigFilePath(),
      settingsFile: configManager.getCloudSettingsFilePath(),
    };
  });

  ipcMain.handle('config:set-cloud', async (_event: IpcMainInvokeEvent, cloudConfig: Partial<{ serverUrl: string; syncApiKey: string }>) => {
    try {
      const serverUrl = (cloudConfig.serverUrl ?? '').trim();
      if (!serverUrl) {
        return {
          success: false,
          error: 'Cloud server URL is required, e.g. https://your-vps.example.com',
        };
      }

      await configManager.setCloudConfig(cloudConfig);
      await processManager.restartApi();

      return { success: true };
    } catch (error) {
      console.error('Error setting cloud config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('config:set-odoo', async (_event: IpcMainInvokeEvent, odooConfig: Partial<{ baseUrl: string; iotApiKey: string }>) => {
    try {
      const baseUrl = (odooConfig.baseUrl ?? '').trim();
      if (!baseUrl) {
        return {
          success: false,
          error: 'Alamat Odoo (Base URL) wajib diisi, contoh: http://192.168.1.10:8069',
        };
      }

      await configManager.setOdooConfig(odooConfig);
      await processManager.restartApi();

      return { success: true };
    } catch (error) {
      console.error('Error setting Odoo config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Gateway configuration handlers
  ipcMain.handle('config:get-gateway', async () => {
    return configManager.getGatewayConfig();
  });

  ipcMain.handle('config:set-gateway', async (_event: IpcMainInvokeEvent, gatewayConfig: Partial<any>) => {
    try {
      await configManager.setGatewayConfig(gatewayConfig);
      
      // Start/stop Gateway based on enabled flag
      if (gatewayConfig.enabled) {
        await processManager.startGateway();
      } else {
        await processManager.stopGateway();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error setting gateway config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Process status handlers
  ipcMain.handle('process:get-status', async () => {
    const status = processManager.getStatus();
    return {
      ...status,
      api: {
        ...status.api,
        lastError: processManager.getLastApiError(),
      },
    };
  });

  ipcMain.handle('process:start-gateway', async () => {
    try {
      await processManager.startGateway();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('process:stop-gateway', async () => {
    try {
      await processManager.stopGateway();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('process:restart-api', async () => {
    try {
      await processManager.restartApi();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

// App event handlers
app.whenReady().then(async () => {
  initializeManagers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  await startBackgroundServices();
  if (!isDev) {
    loadMainUi();
  }
});

app.on('window-all-closed', async () => {
  // Cleanup processes before quitting
  if (processManager) {
    await processManager.cleanup();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Ensure cleanup on quit
  if (processManager) {
    await processManager.cleanup();
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Application Error', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

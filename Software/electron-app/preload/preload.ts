import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  config: {
    getDatabase: () => ipcRenderer.invoke('config:get-database'),
    setDatabase: (payload: { url: string }) =>
      ipcRenderer.invoke('config:set-database', payload),
    testDatabase: () => ipcRenderer.invoke('config:test-database'),
    openDataFolder: () => ipcRenderer.invoke('config:open-data-folder'),
    getOdoo: () => ipcRenderer.invoke('config:get-odoo'),
    setOdoo: (odooConfig: { baseUrl: string; iotApiKey?: string }) =>
      ipcRenderer.invoke('config:set-odoo', odooConfig),
    getCloud: () => ipcRenderer.invoke('config:get-cloud'),
    setCloud: (cloudConfig: { serverUrl: string; syncApiKey?: string }) =>
      ipcRenderer.invoke('config:set-cloud', cloudConfig),
  },

  gateway: {
    getConfig: () => ipcRenderer.invoke('config:get-gateway'),
    setConfig: (config: any) => ipcRenderer.invoke('config:set-gateway', config),
  },

  process: {
    getStatus: () => ipcRenderer.invoke('process:get-status'),
    startGateway: () => ipcRenderer.invoke('process:start-gateway'),
    stopGateway: () => ipcRenderer.invoke('process:stop-gateway'),
    restartApi: () => ipcRenderer.invoke('process:restart-api'),
  },

  isElectron: true,
});

declare global {
  interface Window {
    electron: {
      config: {
        getDatabase: () => Promise<{
          configured: boolean;
          engine?: 'sqlite';
          dbPath?: string;
          exists?: boolean;
          urlMasked?: string;
          configPath?: string;
          dataDirectory?: string;
        }>;
        setDatabase: (payload: { url: string }) => Promise<{
          success: boolean;
          error?: string;
        }>;
        testDatabase: () => Promise<{
          success: boolean;
          error?: string;
          dbPath?: string;
          exists?: boolean;
        }>;
        openDataFolder: () => Promise<{ success: boolean; path?: string }>;
        getOdoo: () => Promise<{ baseUrl: string; hasApiKey: boolean; configPath?: string }>;
        setOdoo: (odooConfig: { baseUrl: string; iotApiKey?: string }) => Promise<{ success: boolean; error?: string }>;
        getCloud: () => Promise<{ serverUrl: string; hasSyncApiKey: boolean; stationId: string; configPath?: string; settingsFile?: string }>;
        setCloud: (cloudConfig: { serverUrl: string; syncApiKey?: string }) => Promise<{ success: boolean; error?: string }>;
      };
      gateway: {
        getConfig: () => Promise<any>;
        setConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
      };
      process: {
        getStatus: () => Promise<any>;
        startGateway: () => Promise<{ success: boolean; error?: string }>;
        stopGateway: () => Promise<{ success: boolean; error?: string }>;
        restartApi: () => Promise<{ success: boolean; error?: string }>;
      };
      isElectron: boolean;
    };
  }
}

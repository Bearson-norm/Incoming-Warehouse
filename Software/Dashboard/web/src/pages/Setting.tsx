import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Settings, Languages, RotateCcw, Save, Info, Globe, Database, TestTube, Play, Square, Home, Activity, FileText, LogIn, Link2, ArrowLeftRight, Layers, Cloud, Usb } from 'lucide-react';
import { CloudStatus } from '../types/weighing';
import { toast } from 'sonner';
import api from '../services/api';
import './Setting.css';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).electron?.isElectron === true;

interface GatewaySerialPort {
  path: string;
  manufacturer?: string;
}

interface GatewayDeviceConfig {
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

const defaultGatewayDeviceConfig: GatewayDeviceConfig = {
  serial: {
    port: '',
    baudRate: 9600,
    parity: 'none',
    dataBits: 8,
    stopBits: 1,
    autoDetect: true,
  },
  stable: {
    windowMs: 1000,
    pattern: 'ST|STABLE|S',
    unstablePattern: 'US|UNSTABLE|U',
  },
};

export default function Setting() {
  const { t, language, setLanguage } = useI18n();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const settingNavItems = useMemo(
    () =>
      [
        { path: '/', icon: Home, label: t('home') },
        { path: '/recording-action', icon: Activity, label: t('recordingAction') },
        { path: '/intrans-recording-action', icon: ArrowLeftRight, label: t('intransRecordingAction') },
        { path: '/lpn-breakdown', icon: Layers, label: t('lpnBreakdown') },
        { path: '/record-documents', icon: FileText, label: t('recordDocuments') },
        { path: '/cloud-server', icon: Cloud, label: t('cloudServer') },
        { path: '/database', icon: Database, label: t('databases') },
        { path: '/setting', icon: Settings, label: t('setting') },
      ] as const,
    [t]
  );
  const [dbInfo, setDbInfo] = useState({
    configured: true,
    dbPath: '',
    exists: false,
    configPath: '' as string | undefined,
    dataDirectory: '' as string | undefined,
  });
  const [dbConfigLoading, setDbConfigLoading] = useState(false);
  const [dbTesting, setDbTesting] = useState(false);
  const [processStatus, setProcessStatus] = useState<any>(null);
  const [gatewayDeviceConfig, setGatewayDeviceConfig] =
    useState<GatewayDeviceConfig>(defaultGatewayDeviceConfig);
  const [gatewaySerialPorts, setGatewaySerialPorts] = useState<GatewaySerialPort[]>([]);
  const [gatewayConfigLoading, setGatewayConfigLoading] = useState(false);

  const [odooConfig, setOdooConfig] = useState({
    baseUrl: '',
    iotApiKey: '',
    hasApiKey: false,
    source: '' as string,
    configPath: '' as string | undefined,
    settingsFile: '' as string | undefined,
  });
  const [odooConfigLoading, setOdooConfigLoading] = useState(false);
  const [cloudConfig, setCloudConfig] = useState({
    serverUrl: '',
    syncApiKey: '',
    hasSyncApiKey: false,
    stationId: '',
    source: '' as string,
    settingsFile: '' as string | undefined,
  });
  const [cloudConfigLoading, setCloudConfigLoading] = useState(false);

  useEffect(() => {
    if (isElectron && (window as any).electron) {
      loadDatabaseConfig();
      loadProcessStatus();
      loadGatewayDeviceConfig();
      const interval = setInterval(loadProcessStatus, 2000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    loadOdooConfig();
    loadCloudConfig();
  }, [isAuthenticated]);

  const loadCloudConfig = async () => {
    try {
      setCloudConfigLoading(true);

      if (isAuthenticated) {
        try {
          const { data } = await api.get<CloudStatus & { source?: string; settingsFile?: string }>(
            '/settings/cloud',
          );
          setCloudConfig((prev) => ({
            ...prev,
            serverUrl: data.serverUrl || '',
            hasSyncApiKey: Boolean(data.hasSyncApiKey),
            stationId: data.stationId || '',
            source: data.source || '',
            settingsFile: data.settingsFile,
            syncApiKey: '',
          }));
          return;
        } catch (err: any) {
          if (err.response?.status !== 401) {
            console.error('Failed to load cloud settings from API:', err);
          }
        }
      }

      if (isElectron && (window as any).electron?.config?.getCloud) {
        const data = await (window as any).electron.config.getCloud();
        setCloudConfig((prev) => ({
          ...prev,
          serverUrl: data.serverUrl || '',
          hasSyncApiKey: Boolean(data.hasSyncApiKey),
          stationId: data.stationId || '',
          source: 'electron',
          settingsFile: data.settingsFile,
          syncApiKey: '',
        }));
      }
    } catch (error) {
      console.error('Failed to load cloud config:', error);
    } finally {
      setCloudConfigLoading(false);
    }
  };

  const handleSaveCloud = async () => {
    const serverUrl = cloudConfig.serverUrl.trim().replace(/\/$/, '');
    if (!serverUrl) {
      toast.error(t('cloudServerUrl'));
      return;
    }

    const body: { serverUrl: string; syncApiKey?: string } = { serverUrl };
    if (cloudConfig.syncApiKey.trim()) {
      body.syncApiKey = cloudConfig.syncApiKey.trim();
    }

    try {
      setCloudConfigLoading(true);
      let savedViaApi = false;

      if (isAuthenticated) {
        try {
          await api.patch('/settings/cloud', body);
          savedViaApi = true;
          toast.success(t('cloudConnectionSuccess'));
        } catch (err: any) {
          const msg = err.response?.data?.message;
          toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to save cloud settings');
          if (!isElectron) return;
        }
      }

      if (isElectron && (window as any).electron?.config?.setCloud) {
        const result = await (window as any).electron.config.setCloud(body);
        if (result.success) {
          if (!savedViaApi) {
            toast.success(t('cloudConnectionSuccess'));
          }
          setTimeout(loadProcessStatus, 2000);
        } else if (!savedViaApi) {
          toast.error(result.error || t('cloudConnectionFailed'));
          return;
        }
      }

      await loadCloudConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setCloudConfigLoading(false);
    }
  };

  const handleTestCloud = async () => {
    try {
      setCloudConfigLoading(true);
      const { data } = await api.get<CloudStatus>('/cloud/status');
      if (data.online) {
        toast.success(t('cloudConnectionSuccess'));
      } else {
        toast.error(data.error || t('cloudConnectionFailed'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('cloudConnectionFailed'));
    } finally {
      setCloudConfigLoading(false);
    }
  };

  const loadDatabaseConfig = async () => {
    if (!isElectron || !(window as any).electron) return;

    try {
      setDbConfigLoading(true);
      const info = await (window as any).electron.config.getDatabase();
      setDbInfo((prev) => ({ ...prev, ...info }));
    } catch (error) {
      console.error('Failed to load database info:', error);
    } finally {
      setDbConfigLoading(false);
    }
  };

  const loadOdooConfig = async () => {
    try {
      setOdooConfigLoading(true);

      if (isAuthenticated) {
        try {
          const { data } = await api.get<{
            baseUrl: string;
            hasApiKey: boolean;
            source: string;
            settingsFile?: string;
          }>('/settings/odoo');
          setOdooConfig((prev) => ({
            ...prev,
            baseUrl: data.baseUrl || '',
            hasApiKey: Boolean(data.hasApiKey),
            source: data.source || '',
            settingsFile: data.settingsFile,
            iotApiKey: '',
          }));
          return;
        } catch (err: any) {
          if (err.response?.status !== 401) {
            console.error('Failed to load Odoo settings from API:', err);
          }
        }
      }

      if (isElectron && (window as any).electron?.config?.getOdoo) {
        const data = await (window as any).electron.config.getOdoo();
        setOdooConfig((prev) => ({
          ...prev,
          baseUrl: data.baseUrl || '',
          hasApiKey: Boolean(data.hasApiKey),
          configPath: data.configPath,
          settingsFile: data.settingsFile,
          source: 'electron',
          iotApiKey: '',
        }));
      }
    } catch (error) {
      console.error('Failed to load Odoo config:', error);
    } finally {
      setOdooConfigLoading(false);
    }
  };

  const handleSaveOdoo = async () => {
    const baseUrl = odooConfig.baseUrl.trim().replace(/\/$/, '');
    if (!baseUrl) {
      toast.error(
        language === 'id'
          ? 'Alamat Odoo wajib diisi'
          : 'Odoo base URL is required',
      );
      return;
    }

    const body: { baseUrl: string; iotApiKey?: string } = { baseUrl };
    if (odooConfig.iotApiKey.trim()) {
      body.iotApiKey = odooConfig.iotApiKey.trim();
    }

    try {
      setOdooConfigLoading(true);
      let savedViaApi = false;

      if (isAuthenticated) {
        try {
          await api.patch('/settings/odoo', body);
          savedViaApi = true;
          toast.success(
            language === 'id'
              ? 'Override Odoo disimpan (langsung aktif).'
              : 'Odoo override saved (active immediately).',
          );
        } catch (err: any) {
          const msg = err.response?.data?.message;
          if (Array.isArray(msg)) {
            toast.error(msg.join(', '));
          } else {
            toast.error(msg || 'Gagal menyimpan ke API');
          }
          if (!isElectron) return;
        }
      }

      if (isElectron && (window as any).electron?.config?.setOdoo) {
        const result = await (window as any).electron.config.setOdoo(body);
        if (result.success) {
          if (!savedViaApi) {
            toast.success(
              language === 'id'
                ? 'Konfigurasi Odoo disimpan. API di-restart.'
                : 'Odoo configuration saved. API restarted.',
            );
          }
          setTimeout(loadProcessStatus, 2000);
        } else if (!savedViaApi) {
          toast.error(result.error || 'Gagal menyimpan konfigurasi Odoo');
          return;
        }
      } else if (!savedViaApi && !isAuthenticated) {
        toast.error(
          language === 'id'
            ? 'Login dulu untuk menyimpan override.'
            : 'Log in to save Odoo override.',
        );
        return;
      }

      await loadOdooConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOdooConfigLoading(false);
    }
  };

  const loadProcessStatus = async () => {
    if (!isElectron || !(window as any).electron) return;
    
    try {
      const status = await (window as any).electron.process.getStatus();
      setProcessStatus(status);
    } catch (error) {
      console.error('Failed to load process status:', error);
    }
  };

  const loadGatewayDeviceConfig = async () => {
    if (!isElectron || !(window as any).electron?.gateway) return;

    try {
      setGatewayConfigLoading(true);
      const configResult = await (window as any).electron.gateway.getDeviceConfig();
      if (!configResult.success || !configResult.config) {
        throw new Error(configResult.error || t('gatewayConfigLoadFailed'));
      }
      setGatewayDeviceConfig(configResult.config);

      const portsResult = await (window as any).electron.gateway.listSerialPorts();
      if (!portsResult.success) {
        throw new Error(portsResult.error || t('gatewayPortsLoadFailed'));
      }
      setGatewaySerialPorts(portsResult.ports || []);
      await loadProcessStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setGatewayConfigLoading(false);
    }
  };

  const refreshGatewaySerialPorts = async () => {
    if (!isElectron || !(window as any).electron?.gateway) return;

    try {
      setGatewayConfigLoading(true);
      const result = await (window as any).electron.gateway.listSerialPorts();
      if (!result.success) {
        throw new Error(result.error || t('gatewayPortsLoadFailed'));
      }
      setGatewaySerialPorts(result.ports || []);
      toast.success(t('gatewayPortsRefreshed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setGatewayConfigLoading(false);
    }
  };

  const handleSaveGatewayDeviceConfig = async () => {
    if (!isElectron || !(window as any).electron?.gateway) return;
    if (!gatewayDeviceConfig.serial.port.trim()) {
      toast.error(t('gatewayPortRequired'));
      return;
    }

    try {
      setGatewayConfigLoading(true);
      const result = await (window as any).electron.gateway.setDeviceConfig(
        gatewayDeviceConfig,
      );
      if (!result.success) {
        throw new Error(result.error || t('gatewayConfigSaveFailed'));
      }
      toast.success(t('gatewayConfigSaved'));
      await loadGatewayDeviceConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setGatewayConfigLoading(false);
    }
  };

  const handleTestDatabase = async () => {
    if (!isElectron || !(window as any).electron) return;

    try {
      setDbTesting(true);
      const result = await (window as any).electron.config.testDatabase();

      if (result.success) {
        toast.success(
          language === 'id'
            ? `SQLite siap${result.dbPath ? ` (${result.dbPath})` : ''}`
            : `SQLite ready${result.dbPath ? ` (${result.dbPath})` : ''}`,
        );
        await loadDatabaseConfig();
      } else {
        toast.error(
          result.error ||
            (language === 'id' ? 'Folder SQLite tidak bisa ditulis' : 'SQLite folder is not writable'),
        );
      }
    } catch (error) {
      toast.error(`Error testing database: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDbTesting(false);
    }
  };

  const handleOpenDataFolder = async () => {
    if (!isElectron || !(window as any).electron?.config?.openDataFolder) return;
    try {
      await (window as any).electron.config.openDataFolder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRestartApi = async () => {
    if (!isElectron || !(window as any).electron) return;

    try {
      setDbConfigLoading(true);
      const result = await (window as any).electron.process.restartApi();

      if (result.success) {
        toast.success(
          language === 'id' ? 'API server berhasil di-restart' : 'API server restarted',
        );
        loadProcessStatus();
      } else {
        toast.error(result.error || 'Gagal restart API');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDbConfigLoading(false);
    }
  };


  const handleToggleGateway = async (start: boolean) => {
    if (!isElectron || !(window as any).electron) return;
    
    try {
      const result = start
        ? await (window as any).electron.process.startGateway()
        : await (window as any).electron.process.stopGateway();
      
      if (result.success) {
        toast.success(start ? 'Gateway started' : 'Gateway stopped');
        loadProcessStatus();
      } else {
        toast.error(`Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleLanguageChange = (newLanguage: 'id' | 'en') => {
    setLanguage(newLanguage);
    toast.success(language === 'id' ? 'Bahasa diubah' : 'Language changed');
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      {/* Navigasi cepat — penting saat /setting dibuka tanpa sidebar (mis. dari login Electron) */}
      <div className="mb-6 rounded-xl border-2 border-[#d7ccc8] bg-[#fff8f0] shadow-sm p-4 brown-hover-effect">
        <p className="text-xs font-bold uppercase tracking-wider text-[#8d6e63] mb-3">
          {t('quickNavigation')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!isAuthenticated && (
            <Button variant="default" size="sm" className="brown-gradient-animated text-white shadow-sm" asChild>
              <Link to="/login" className="inline-flex items-center gap-2">
                <LogIn className="w-4 h-4 shrink-0" />
                {t('backToLogin')}
              </Link>
            </Button>
          )}
          {settingNavItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Button
                key={path}
                variant={active ? 'default' : 'outline'}
                size="sm"
                className={
                  active
                    ? 'brown-gradient-animated text-white border-transparent shadow-sm'
                    : 'border-[#d7ccc8] bg-white/80 text-[#5d4037] hover:bg-[#f5ebe0]'
                }
                asChild
              >
                <Link to={path} className="inline-flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              </Button>
            );
          })}
        </div>
        {!isAuthenticated && (
          <p className="text-xs text-[#8d6e63] mt-3 leading-relaxed">
            {language === 'id'
              ? 'Menu lain memerlukan login. Database SQLite dibuat otomatis di folder aplikasi. Restart API jika belum siap, lalu kembali ke login.'
              : 'Other pages require login. SQLite is created automatically in the app folder. Restart the API if it is not ready, then go back to login.'}
          </p>
        )}
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md brown-glow-animated">
            <Settings className="w-5 h-5 text-white brown-pulse-animated" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">{t('setting')}</h1>
            <p className="text-sm text-[#8d6e63]">
              {language === 'id' ? 'Atur preferensi aplikasi Anda' : 'Configure your app preferences'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* ===== BAHASA ===== */}
        <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0]">
          <div className="h-2 brown-gradient-animated relative overflow-hidden">
            <div className="absolute inset-0 brown-shimmer"></div>
          </div>
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="flex items-center gap-3 text-base leading-tight">
              <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
                <Globe className="w-4 h-4 text-[#6d4c41]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[#3e2723] block leading-tight break-words">{t('language')}</span>
                <p className="text-xs font-normal text-[#8d6e63] mt-1 leading-relaxed break-words">
                  {language === 'id'
                    ? 'Pilih bahasa untuk antarmuka aplikasi'
                    : 'Select language for application interface'
                  }
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 pb-6 px-6 max-w-md">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-[#8d6e63]" />
                <Label className="text-sm font-medium text-[#5d4037]">{t('selectLanguage') || t('language')}</Label>
              </div>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full h-10 brown-hover-effect border-[#d7ccc8] focus:border-[#8d6e63] focus:ring-[#8d6e63]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#fff8f0] border-[#d7ccc8]">
                  <SelectItem value="id" className="hover:bg-[#f5ebe0] focus:bg-[#f5ebe0] text-[#3e2723]">
                    <span className="flex items-center gap-2">🇮🇩 {t('indonesian')}</span>
                  </SelectItem>
                  <SelectItem value="en" className="hover:bg-[#f5ebe0] focus:bg-[#f5ebe0] text-[#3e2723]">
                    <span className="flex items-center gap-2">🇬🇧 {t('english')}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ===== SQLITE DATABASE (Electron Only) ===== */}
        {isElectron && (
          <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0]">
            <div className="h-2 brown-gradient-animated relative overflow-hidden">
              <div className="absolute inset-0 brown-shimmer"></div>
            </div>
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="flex items-center gap-3 text-base leading-tight">
                <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
                  <Database className="w-4 h-4 text-[#6d4c41]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[#3e2723] block leading-tight break-words">
                    {language === 'id' ? 'SQLite (perangkat lokal)' : 'SQLite (local device)'}
                  </span>
                  <CardDescription className="text-sm mt-1 leading-relaxed text-[#8d6e63] break-words">
                    {language === 'id'
                      ? 'Data timbangan disimpan di file SQLite di folder aplikasi. PostgreSQL tidak dipakai di perangkat ini.'
                      : 'Weighing data is stored in a SQLite file in the app folder. This device does not use PostgreSQL.'}
                  </CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-6 px-6">
              <div className="space-y-4">
                <div className="rounded-lg border border-[#d7ccc8] bg-[#f5ebe0] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-medium text-[#5d4037]">incoming-warehouse.db</Label>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        dbInfo.exists
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {dbInfo.exists
                        ? language === 'id'
                          ? 'Ada'
                          : 'Present'
                        : language === 'id'
                          ? 'Akan dibuat saat API start'
                          : 'Created when API starts'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-[#5d4037] break-all">
                    {dbInfo.dbPath || dbInfo.dataDirectory || '—'}
                  </p>
                </div>

                {dbInfo.configPath && (
                  <p className="text-xs text-[#8d6e63]">
                    {language === 'id' ? 'Config disimpan di: ' : 'Config saved to: '}
                    <code className="bg-[#f5ebe0] px-1.5 py-0.5 rounded text-[#5d4037]">{dbInfo.configPath}</code>
                  </p>
                )}

                {/* Process Status */}
                {processStatus && (
                  <div className="pt-4 border-t border-[#d7ccc8] space-y-2">
                    <Label className="text-sm font-medium text-[#5d4037]">
                      {language === 'id' ? 'Status Layanan' : 'Service Status'}
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-2 bg-[#f5ebe0] rounded-lg">
                        <span className="text-sm text-[#8d6e63]">API Server</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${processStatus.api?.running ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-xs text-[#5d4037]">
                            {processStatus.api?.running ? 'Running' : 'Stopped'}
                          </span>
                          {!processStatus.api?.running && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRestartApi}
                              disabled={dbConfigLoading}
                              className="h-6 px-2 text-xs border-[#bcaaa4] text-[#8d6e63] hover:bg-[#f5ebe0]"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              {language === 'id' ? 'Restart' : 'Restart'}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-[#f5ebe0] rounded-lg">
                        <span className="text-sm text-[#8d6e63]">Gateway</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${processStatus.gateway?.running ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span className="text-xs text-[#5d4037]">
                            {processStatus.gateway?.running ? 'Running' : 'Stopped'}
                          </span>
                          {processStatus.gateway?.running ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleGateway(false)}
                              className="h-6 px-2 text-xs border-[#bcaaa4] text-[#8d6e63] hover:bg-[#f5ebe0]"
                            >
                              <Square className="w-3 h-3 mr-1" />
                              Stop
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleGateway(true)}
                              className="h-6 px-2 text-xs border-[#bcaaa4] text-[#8d6e63] hover:bg-[#f5ebe0]"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Start
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {!processStatus.api?.running && processStatus.api?.lastError && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                        {processStatus.api.lastError}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-4 border-t border-[#d7ccc8]">
                  <Button
                    onClick={handleTestDatabase}
                    disabled={dbTesting || dbConfigLoading}
                    variant="outline"
                    className="border-[#bcaaa4] text-[#8d6e63] hover:bg-[#f5ebe0] brown-hover-effect"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    {dbTesting
                      ? 'Testing...'
                      : language === 'id'
                        ? 'Tes folder'
                        : 'Test folder'}
                  </Button>
                  <Button
                    onClick={handleOpenDataFolder}
                    disabled={dbConfigLoading}
                    variant="outline"
                    className="border-[#bcaaa4] text-[#8d6e63] hover:bg-[#f5ebe0] brown-hover-effect"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    {language === 'id' ? 'Buka Folder Data' : 'Open Data Folder'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isElectron && (
          <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0]">
            <div className="h-2 brown-gradient-animated relative overflow-hidden">
              <div className="absolute inset-0 brown-shimmer"></div>
            </div>
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="flex items-center gap-3 text-base leading-tight">
                <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
                  <Usb className="w-4 h-4 text-[#6d4c41]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[#3e2723] block leading-tight break-words">
                    {t('gatewaySettings')}
                  </span>
                  <CardDescription className="text-sm mt-1 leading-relaxed text-[#8d6e63] break-words">
                    {t('gatewaySettingsHint')}
                  </CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-6 px-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-medium text-[#5d4037]">
                        {t('gatewaySerialPort')}
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={refreshGatewaySerialPorts}
                        disabled={gatewayConfigLoading}
                        className="h-7 px-2 text-xs text-[#8d6e63]"
                      >
                        <RotateCcw className={`w-3 h-3 mr-1 ${gatewayConfigLoading ? 'animate-spin' : ''}`} />
                        {t('refresh')}
                      </Button>
                    </div>
                    <Select
                      value={gatewayDeviceConfig.serial.port || undefined}
                      onValueChange={(port) =>
                        setGatewayDeviceConfig((prev) => ({
                          ...prev,
                          serial: { ...prev.serial, port },
                        }))
                      }
                      disabled={gatewayConfigLoading}
                    >
                      <SelectTrigger className="border-[#d7ccc8]">
                        <SelectValue placeholder={t('gatewaySelectPort')} />
                      </SelectTrigger>
                      <SelectContent>
                        {gatewayDeviceConfig.serial.port &&
                          !gatewaySerialPorts.some(
                            (port) => port.path === gatewayDeviceConfig.serial.port,
                          ) && (
                            <SelectItem value={gatewayDeviceConfig.serial.port}>
                              {gatewayDeviceConfig.serial.port}
                            </SelectItem>
                          )}
                        {gatewaySerialPorts.map((port) => (
                          <SelectItem key={port.path} value={port.path}>
                            {port.path}
                            {port.manufacturer ? ` — ${port.manufacturer}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#5d4037]">
                      {t('gatewayBaudRate')}
                    </Label>
                    <Select
                      value={String(gatewayDeviceConfig.serial.baudRate)}
                      onValueChange={(value) =>
                        setGatewayDeviceConfig((prev) => ({
                          ...prev,
                          serial: { ...prev.serial, baudRate: Number(value) },
                        }))
                      }
                      disabled={gatewayConfigLoading}
                    >
                      <SelectTrigger className="border-[#d7ccc8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map(
                          (baudRate) => (
                            <SelectItem key={baudRate} value={String(baudRate)}>
                              {baudRate}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#5d4037]">
                      {t('gatewayParity')}
                    </Label>
                    <Select
                      value={gatewayDeviceConfig.serial.parity}
                      onValueChange={(parity: 'none' | 'even' | 'odd') =>
                        setGatewayDeviceConfig((prev) => ({
                          ...prev,
                          serial: { ...prev.serial, parity },
                        }))
                      }
                      disabled={gatewayConfigLoading}
                    >
                      <SelectTrigger className="border-[#d7ccc8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('gatewayParityNone')}</SelectItem>
                        <SelectItem value="even">{t('gatewayParityEven')}</SelectItem>
                        <SelectItem value="odd">{t('gatewayParityOdd')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#5d4037]">
                      {t('gatewayDataBits')}
                    </Label>
                    <Select
                      value={String(gatewayDeviceConfig.serial.dataBits)}
                      onValueChange={(value) =>
                        setGatewayDeviceConfig((prev) => ({
                          ...prev,
                          serial: {
                            ...prev.serial,
                            dataBits: Number(value) as 5 | 6 | 7 | 8,
                          },
                        }))
                      }
                      disabled={gatewayConfigLoading}
                    >
                      <SelectTrigger className="border-[#d7ccc8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 6, 7, 8].map((bits) => (
                          <SelectItem key={bits} value={String(bits)}>
                            {bits}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#5d4037]">
                      {t('gatewayStopBits')}
                    </Label>
                    <Select
                      value={String(gatewayDeviceConfig.serial.stopBits)}
                      onValueChange={(value) =>
                        setGatewayDeviceConfig((prev) => ({
                          ...prev,
                          serial: {
                            ...prev.serial,
                            stopBits: Number(value) as 1 | 1.5 | 2,
                          },
                        }))
                      }
                      disabled={gatewayConfigLoading}
                    >
                      <SelectTrigger className="border-[#d7ccc8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 1.5, 2].map((bits) => (
                          <SelectItem key={bits} value={String(bits)}>
                            {bits}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#5d4037]">
                      {t('gatewayStableWindow')}
                    </Label>
                    <Input
                      type="number"
                      min={100}
                      max={10000}
                      step={100}
                      value={gatewayDeviceConfig.stable.windowMs}
                      onChange={(event) =>
                        setGatewayDeviceConfig((prev) => ({
                          ...prev,
                          stable: {
                            ...prev.stable,
                            windowMs: Number(event.target.value),
                          },
                        }))
                      }
                      disabled={gatewayConfigLoading}
                      className="border-[#d7ccc8]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-[#d7ccc8] bg-[#f5ebe0] p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gatewayDeviceConfig.serial.autoDetect}
                    onChange={(event) =>
                      setGatewayDeviceConfig((prev) => ({
                        ...prev,
                        serial: {
                          ...prev.serial,
                          autoDetect: event.target.checked,
                        },
                      }))
                    }
                    disabled={gatewayConfigLoading}
                    className="h-4 w-4 accent-[#6d4c41]"
                  />
                  <span className="text-sm text-[#5d4037]">{t('gatewayAutoDetect')}</span>
                </label>

                <details className="rounded-lg border border-[#d7ccc8] bg-[#f5ebe0] p-4">
                  <summary className="cursor-pointer text-sm font-medium text-[#5d4037]">
                    {t('gatewayAdvancedSettings')}
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#5d4037]">{t('gatewayStablePattern')}</Label>
                      <Input
                        value={gatewayDeviceConfig.stable.pattern}
                        onChange={(event) =>
                          setGatewayDeviceConfig((prev) => ({
                            ...prev,
                            stable: { ...prev.stable, pattern: event.target.value },
                          }))
                        }
                        disabled={gatewayConfigLoading}
                        className="font-mono border-[#d7ccc8]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#5d4037]">{t('gatewayUnstablePattern')}</Label>
                      <Input
                        value={gatewayDeviceConfig.stable.unstablePattern}
                        onChange={(event) =>
                          setGatewayDeviceConfig((prev) => ({
                            ...prev,
                            stable: {
                              ...prev.stable,
                              unstablePattern: event.target.value,
                            },
                          }))
                        }
                        disabled={gatewayConfigLoading}
                        className="font-mono border-[#d7ccc8]"
                      />
                    </div>
                  </div>
                </details>

                <Button
                  onClick={handleSaveGatewayDeviceConfig}
                  disabled={
                    gatewayConfigLoading ||
                    !gatewayDeviceConfig.serial.port.trim() ||
                    gatewayDeviceConfig.stable.windowMs < 100
                  }
                  className="brown-gradient-animated text-white font-semibold shadow-md"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {gatewayConfigLoading ? t('gatewaySaving') : t('gatewaySaveRestart')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && (
        <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0]">
            <div className="h-2 brown-gradient-animated relative overflow-hidden">
              <div className="absolute inset-0 brown-shimmer"></div>
            </div>
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="flex items-center gap-3 text-base leading-tight">
                <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
                  <Cloud className="w-4 h-4 text-[#6d4c41]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[#3e2723] block leading-tight break-words">{t('cloudSettings')}</span>
                  <CardDescription className="text-sm mt-1 leading-relaxed text-[#8d6e63] break-words">
                    {t('cloudSettingsHint')}
                  </CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-6 px-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#5d4037]">{t('cloudServerUrl')}</Label>
                  <Input
                    type="url"
                    value={cloudConfig.serverUrl}
                    onChange={(e) =>
                      setCloudConfig((prev) => ({ ...prev, serverUrl: e.target.value }))
                    }
                    placeholder="https://your-vps.example.com"
                    className="border-[#d7ccc8] focus:border-[#8d6e63] font-mono text-sm"
                    disabled={cloudConfigLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#5d4037]">{t('cloudSyncApiKey')}</Label>
                  <Input
                    type="password"
                    value={cloudConfig.syncApiKey}
                    onChange={(e) =>
                      setCloudConfig((prev) => ({ ...prev, syncApiKey: e.target.value }))
                    }
                    placeholder={
                      cloudConfig.hasSyncApiKey
                        ? language === 'id'
                          ? 'Kosongkan jika tidak diubah'
                          : 'Leave blank to keep current'
                        : t('cloudSyncApiKey')
                    }
                    className="border-[#d7ccc8] focus:border-[#8d6e63] font-mono text-sm"
                    disabled={cloudConfigLoading}
                  />
                </div>
                {cloudConfig.stationId && (
                  <p className="text-xs text-[#8d6e63]">
                    {t('stationId')}:{' '}
                    <code className="bg-[#f5ebe0] px-1 rounded">{cloudConfig.stationId}</code>
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleSaveCloud}
                    disabled={cloudConfigLoading || !cloudConfig.serverUrl.trim()}
                    className="brown-gradient-animated text-white font-semibold shadow-md"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {t('save')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTestCloud}
                    disabled={cloudConfigLoading}
                    className="border-[#bcaaa4] text-[#8d6e63]"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    {t('testCloudConnection')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && (
        <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0]">
            <div className="h-2 brown-gradient-animated relative overflow-hidden">
              <div className="absolute inset-0 brown-shimmer"></div>
            </div>
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="flex items-center gap-3 text-base leading-tight">
                <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
                  <Link2 className="w-4 h-4 text-[#6d4c41]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[#3e2723] block leading-tight break-words">
                    {language === 'id' ? 'Konfigurasi API Odoo WMS' : 'Odoo WMS API Configuration'}
                  </span>
                  <CardDescription className="text-sm mt-1 leading-relaxed text-[#8d6e63] break-words">
                    {language === 'id'
                      ? 'Override alamat Odoo dan API key (prioritas di atas .env). Setelah login, simpan langsung aktif tanpa restart API.'
                      : 'Override Odoo URL and API key (takes priority over .env). When logged in, saves apply immediately.'}
                  </CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-6 px-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#5d4037]">
                    {language === 'id' ? 'Alamat Odoo (Base URL)' : 'Odoo Base URL'}
                  </Label>
                  <Input
                    type="url"
                    value={odooConfig.baseUrl}
                    onChange={(e) =>
                      setOdooConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
                    }
                    placeholder="http://192.168.1.10:8069"
                    className="border-[#d7ccc8] focus:border-[#8d6e63] font-mono text-sm"
                    disabled={odooConfigLoading}
                  />
                  <p className="text-xs text-[#8d6e63]">
                    {language === 'id'
                      ? 'Tanpa slash di akhir. Contoh: http://IP_SERVER:8069'
                      : 'No trailing slash. Example: http://SERVER_IP:8069'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#5d4037]">
                    X-FOOM-IoT-Key
                  </Label>
                  <Input
                    type="password"
                    value={odooConfig.iotApiKey}
                    onChange={(e) =>
                      setOdooConfig((prev) => ({ ...prev, iotApiKey: e.target.value }))
                    }
                    placeholder={
                      odooConfig.hasApiKey
                        ? language === 'id'
                          ? 'Kosongkan jika tidak diubah'
                          : 'Leave blank to keep current'
                        : language === 'id'
                          ? 'API key dari Odoo System Parameters'
                          : 'API key from Odoo System Parameters'
                    }
                    className="border-[#d7ccc8] focus:border-[#8d6e63] font-mono text-sm"
                    disabled={odooConfigLoading}
                  />
                  {odooConfig.hasApiKey && !odooConfig.iotApiKey && (
                    <p className="text-xs text-green-700">
                      {language === 'id' ? 'API key sudah tersimpan.' : 'API key is already saved.'}
                    </p>
                  )}
                </div>
                {odooConfig.source && (
                  <p className="text-xs text-[#8d6e63]">
                    {language === 'id' ? 'Sumber aktif: ' : 'Active source: '}
                    <span className="font-semibold text-[#5d4037]">
                      {odooConfig.source === 'override'
                        ? language === 'id'
                          ? 'Override (file)'
                          : 'Override (file)'
                        : odooConfig.source === 'env'
                          ? '.env / environment'
                          : odooConfig.source}
                    </span>
                  </p>
                )}
                {(odooConfig.settingsFile || odooConfig.configPath) && (
                  <p className="text-xs text-[#8d6e63] break-all">
                    {odooConfig.settingsFile && (
                      <>
                        Override:{' '}
                        <code className="bg-[#f5ebe0] px-1 rounded">{odooConfig.settingsFile}</code>
                        <br />
                      </>
                    )}
                    {odooConfig.configPath && isElectron && (
                      <>
                        Electron config:{' '}
                        <code className="bg-[#f5ebe0] px-1 rounded">{odooConfig.configPath}</code>
                      </>
                    )}
                  </p>
                )}
                {!isAuthenticated && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    {language === 'id'
                      ? 'Login diperlukan untuk menyimpan override via API. Alternatif: edit Dashboard/api/.env atau config Electron.'
                      : 'Login required to save override via API. Or edit Dashboard/api/.env / Electron config.'}
                  </p>
                )}
                <Button
                  onClick={handleSaveOdoo}
                  disabled={odooConfigLoading || !odooConfig.baseUrl.trim()}
                  className="w-full brown-gradient-animated text-white font-semibold shadow-md"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {odooConfigLoading
                    ? '...'
                    : isAuthenticated
                      ? language === 'id'
                        ? 'Simpan Override'
                        : 'Save Override'
                      : language === 'id'
                        ? 'Simpan (perlu login / Electron)'
                        : 'Save (login / Electron required)'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== INFORMASI SISTEM ===== */}
        <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0]">
          <div className="h-2 brown-gradient-animated relative overflow-hidden">
            <div className="absolute inset-0 brown-shimmer"></div>
          </div>
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="flex items-center gap-3 text-base leading-tight">
              <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
                <Info className="w-4 h-4 text-[#6d4c41]" />
              </div>
              <span className="text-[#3e2723] leading-tight break-words">
                {language === 'id' ? 'Informasi Sistem' : 'System Information'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 pb-6 px-6">
            <div className="ml-12 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[#e8d5c4]">
                <span className="text-sm text-[#8d6e63]">Version</span>
                <span className="text-sm font-medium text-[#3e2723] bg-[#f5ebe0] px-3 py-0.5 rounded-full brown-pulse-animated">1.0.0</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#e8d5c4]">
                <span className="text-sm text-[#8d6e63]">
                  {language === 'id' ? 'Nama Sistem' : 'System Name'}
                </span>
                <span className="text-sm font-medium text-[#3e2723]">
                  {language === 'id'
                    ? 'Sistem Dokumentasi Barang Incoming'
                    : 'Incoming Goods Documentation System'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-[#8d6e63]">
                  {language === 'id' ? 'Fitur' : 'Feature'}
                </span>
                <span className="text-sm font-medium text-[#3e2723]">
                  {language === 'id'
                    ? 'WebSocket Penimbangan Real-time'
                    : 'Real-time WebSocket Weighing'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

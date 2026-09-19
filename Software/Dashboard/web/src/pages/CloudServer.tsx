import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import api from '../services/api';
import { toast } from 'sonner';
import {
  Cloud,
  User,
  RefreshCw,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  RotateCcw,
} from 'lucide-react';
import { CloudScale, CloudStatus, CloudWeighReading } from '../types/weighing';

interface CloudReadingsResponse {
  items: CloudWeighReading[];
  total: number;
  limit: number;
  offset: number;
}

export default function CloudServer() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [scales, setScales] = useState<CloudScale[]>([]);
  const [readings, setReadings] = useState<CloudWeighReading[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [filterScaleId, setFilterScaleId] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [newScaleName, setNewScaleName] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, scalesRes, readingsRes] = await Promise.all([
        api.get<CloudStatus>('/cloud/status'),
        api.get<CloudScale[]>('/cloud/scales', {
          params: isAdmin ? { includeInactive: true } : undefined,
        }),
        api.get<CloudReadingsResponse>('/cloud/readings', {
          params: {
            limit: 100,
            ...(filterScaleId ? { scaleId: Number(filterScaleId) } : {}),
            ...(filterUsername ? { username: filterUsername } : {}),
          },
        }),
      ]);
      setStatus(statusRes.data);
      setScales(scalesRes.data);
      setReadings(readingsRes.data.items);
      setTotal(readingsRes.data.total);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [filterScaleId, filterUsername, isAdmin]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateScale = async () => {
    const name = newScaleName.trim();
    if (!name) {
      toast.error(t('pleaseFillAllFields'));
      return;
    }
    try {
      await api.post('/cloud/scales', { name });
      setNewScaleName('');
      toast.success(t('scaleAdded'));
      await loadAll();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message;
      toast.error(message);
    }
  };

  const handleDeactivateScale = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await api.delete(`/cloud/scales/${id}`);
      toast.success(t('scaleDeleted'));
      await loadAll();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message;
      toast.error(message);
    }
  };

  const handleRetrySync = async () => {
    setRetrying(true);
    try {
      const { data } = await api.post<{ retried: number; synced: number; failed: number }>(
        '/cloud/sync/retry',
      );
      toast.success(`${t('syncStatus')}: ${data.synced}/${data.retried}`);
      await loadAll();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error).message;
      toast.error(message);
    } finally {
      setRetrying(false);
    }
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md">
            <Cloud className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">{t('cloudServer')}</h1>
            <p className="text-sm text-[#8d6e63]">{t('cloudServerSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#d7ccc8] bg-[#fff8f0] px-4 py-2">
          <User className="w-4 h-4 text-[#6d4c41]" />
          <span className="text-sm font-semibold text-[#3e2723]">{user?.username}</span>
          <span className="text-xs text-[#8d6e63] capitalize">({user?.role})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="border-[#d7ccc8] bg-[#fff8f0]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {status?.online ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              {t('cloudConnection')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1 text-[#5d4037]">
            <p>
              {status?.online ? t('cloudOnline') : t('cloudOffline')}
            </p>
            {status?.serverUrl && (
              <p className="text-xs break-all text-[#8d6e63]">{status.serverUrl}</p>
            )}
            {status?.stationId && (
              <p className="text-xs text-[#8d6e63]">
                {t('stationId')}: {status.stationId}
              </p>
            )}
            {status?.activeScales != null && (
              <p className="text-xs">{t('activeScales')}: {status.activeScales}</p>
            )}
            {status?.totalReadings != null && (
              <p className="text-xs">{t('totalCloudReadings')}: {status.totalReadings}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#d7ccc8] bg-[#fff8f0] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('filters')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 min-w-[160px]">
              <Label className="text-xs">{t('scale')}</Label>
              <Select value={filterScaleId || 'all'} onValueChange={(v) => setFilterScaleId(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('allScales')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allScales')}</SelectItem>
                  {scales.filter((s) => s.isActive).map((scale) => (
                    <SelectItem key={scale.id} value={String(scale.id)}>
                      {scale.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs">{t('username')}</Label>
                <Input
                  value={filterUsername}
                  onChange={(e) => setFilterUsername(e.target.value)}
                  className="h-9"
                  placeholder={t('username')}
                />
              </div>
            )}
            <Button variant="outline" className="h-9" onClick={() => void loadAll()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
            <Button variant="outline" className="h-9" onClick={() => void handleRetrySync()} disabled={retrying}>
              <RotateCcw className={`w-4 h-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
              {t('retrySync')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card className="border-[#d7ccc8] bg-[#fff8f0] mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t('manageScales')}</CardTitle>
            <CardDescription>{t('manageScalesHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                value={newScaleName}
                onChange={(e) => setNewScaleName(e.target.value)}
                placeholder={t('scaleName')}
                className="max-w-xs h-10"
              />
              <Button onClick={() => void handleCreateScale()} className="h-10 brown-gradient-animated text-white">
                <Plus className="w-4 h-4 mr-2" />
                {t('addScale')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {scales.map((scale) => (
                <div
                  key={scale.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    scale.isActive ? 'border-[#d7ccc8] bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <span>{scale.name}</span>
                  {scale.isActive && (
                    <button
                      type="button"
                      onClick={() => void handleDeactivateScale(scale.id)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {scales.length === 0 && (
                <p className="text-sm text-[#8d6e63]">{t('noScales')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-[#d7ccc8] bg-[#fff8f0]">
        <CardHeader>
          <CardTitle className="text-base">{t('cloudReadings')}</CardTitle>
          <CardDescription>
            {total} {t('totalRecords')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('scale')}</TableHead>
                  <TableHead>{t('username')}</TableHead>
                  <TableHead>{t('lpn')}</TableHead>
                  <TableHead>{t('flowType')}</TableHead>
                  <TableHead>{t('gross')}</TableHead>
                  <TableHead>{t('net')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(reading.capturedAt)}
                    </TableCell>
                    <TableCell>{reading.scaleName}</TableCell>
                    <TableCell>{reading.username}</TableCell>
                    <TableCell className="font-mono text-xs">{reading.packageUid || '—'}</TableCell>
                    <TableCell className="capitalize">{reading.flowType}</TableCell>
                    <TableCell>{reading.grossWeight ?? reading.weight} {reading.unit}</TableCell>
                    <TableCell>{reading.netWeight ?? '—'}</TableCell>
                    <TableCell className="capitalize">{reading.weightStatus || '—'}</TableCell>
                  </TableRow>
                ))}
                {!loading && readings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-[#8d6e63] py-8">
                      {t('noCloudReadings')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import api from '../services/api';
import { toast } from 'sonner';
import { Search, Layers } from 'lucide-react';
import { Reading, RmCode } from '../types/weighing';

interface BreakdownResponse {
  packageUid: string;
  summary: {
    count: number;
    rmCode: RmCode | null;
    vendor: { id: number; name: string } | null;
    packaging: { id: number; name: string; tareWeight: number | null } | null;
    latestGross: number | null;
    latestTare: number | null;
    latestNet: number | null;
    latestStatus: string | null;
    syncedToOdoo: boolean;
  };
  readings: Reading[];
}

export default function LpnBreakdown() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get('lpn') || '';
  const [lpn, setLpn] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BreakdownResponse | null>(null);

  useEffect(() => {
    if (initial.trim()) {
      load(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (value?: string) => {
    const term = (value ?? lpn).trim();
    if (!term) {
      toast.error(t('pleaseFillLpn'));
      return;
    }
    setLoading(true);
    try {
      const response = await api.get<BreakdownResponse>('/readings/by-lpn', {
        params: { packageUid: term },
      });
      setData(response.data);
      setSearchParams({ lpn: term });
      if (!response.data.readings.length) {
        toast.message(t('noLpnHistory'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('failedToLoadDatabase'));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md brown-glow-animated">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">{t('lpnBreakdown')}</h1>
            <p className="text-sm text-[#8d6e63]">{t('lpnBreakdownSubtitle')}</p>
          </div>
        </div>
      </div>

      <Card className="mb-8 border-2 border-[#d7ccc8] shadow-md bg-[#fff8f0]">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-base text-[#3e2723]">{t('lookUpLpn')}</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">{t('lpn')}</Label>
              <Input
                className="h-10 font-mono"
                value={lpn}
                onChange={(e) => setLpn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') load();
                }}
                placeholder="RM-BOM-31/05/2026-000011"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => load()} className="h-10 brown-gradient-animated text-white">
                <Search className="w-4 h-4 mr-2" />
                {t('search')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          <Card className="mb-8 border-2 border-[#d7ccc8] shadow-md bg-[#fff8f0]">
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="text-base font-mono text-[#3e2723]">{data.packageUid}</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-[#8d6e63]">{t('rmCode')}</p>
                <p className="font-medium">{data.summary.rmCode?.code || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-[#8d6e63]">{t('vendor')}</p>
                <p className="font-medium">{data.summary.vendor?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-[#8d6e63]">{t('net')} / {t('tare')}</p>
                <p className="font-medium">
                  {data.summary.latestNet ?? '-'} / {data.summary.latestTare ?? '-'} kg
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8d6e63]">{t('status')}</p>
                <p className="font-medium">
                  {(data.summary.latestStatus || '-').toUpperCase()} ·{' '}
                  {data.summary.syncedToOdoo ? t('sentToOdoo') : t('localOnly')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#d7ccc8] shadow-md bg-[#fff8f0]">
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="text-base text-[#3e2723]">
                {t('weighingHistory')} ({data.summary.count})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {loading ? (
                <p className="text-sm text-[#8d6e63]">Loading...</p>
              ) : data.readings.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead>{t('time')}</TableHead>
                      <TableHead>{t('flowType')}</TableHead>
                      <TableHead>{t('weighingMethod')}</TableHead>
                      <TableHead className="text-right">{t('gross')}</TableHead>
                      <TableHead className="text-right">{t('tare')}</TableHead>
                      <TableHead className="text-right">{t('net')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>Odoo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.readings.map((reading) => (
                      <TableRow key={reading.id}>
                        <TableCell>{new Date(reading.capturedAt).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(reading.capturedAt).toLocaleTimeString()}</TableCell>
                        <TableCell>
                          {reading.session.flowType === 'intrans' ? t('intrans') : t('incoming')}
                        </TableCell>
                        <TableCell>
                          {reading.session.weighingMethod === 'internal'
                            ? t('methodInternal')
                            : t('methodOdoo')}
                        </TableCell>
                        <TableCell className="text-right">
                          {(reading.grossWeight ?? reading.weight).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(reading.tareWeight ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {(reading.netWeight ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell>{(reading.weightStatus || '-').toUpperCase()}</TableCell>
                        <TableCell>
                          {reading.odooLogId ? t('sentToOdoo') : t('localOnly')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-[#8d6e63] text-center py-8">{t('noLpnHistory')}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { subscribeToWeight } from '../services/socket';
import { WeightLivePayload } from '../types/socket';
import api from '../services/api';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Package, ArrowLeftRight, RefreshCw } from 'lucide-react';
import { cn } from '../components/ui/utils';
import WeighingScaleCard from '../components/WeighingScaleCard';
import WeighingResultCard from '../components/WeighingResultCard';
import { ConfirmResult, WeighingMethod, WeighSession } from '../types/weighing';
import { useCloudScales } from '../hooks/useCloudScales';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export default function IntransRecordingAction() {
  const { t } = useI18n();
  const [method, setMethod] = useState<WeighingMethod>('odoo');
  const [packageUid, setPackageUid] = useState('');
  const [session, setSession] = useState<WeighSession | null>(null);
  const [currentWeight, setCurrentWeight] = useState<WeightLivePayload | null>(null);
  const [isWeighing, setIsWeighing] = useState(false);
  const [isConfigConfirmed, setIsConfigConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<ConfirmResult | null>(null);
  const {
    scales,
    scaleId,
    setScaleId,
    selectedScale,
    loading: scalesLoading,
    error: scalesError,
    reload: reloadScales,
  } = useCloudScales();

  useEffect(() => {
    loadActiveSession();
  }, []);

  useEffect(() => {
    const unsubscribeWeight = subscribeToWeight((payload) => {
      setCurrentWeight(payload);
    });
    return () => unsubscribeWeight();
  }, []);

  const loadActiveSession = async () => {
    try {
      const response = await api.get<WeighSession | null>('/sessions/active', {
        params: { flowType: 'intrans' },
      });
      if (response.data) {
        setSession(response.data);
        setMethod(response.data.weighingMethod === 'internal' ? 'internal' : 'odoo');
        setPackageUid(response.data.packageUid || '');
        if (response.data.scaleId) {
          setScaleId(String(response.data.scaleId));
        }
        setIsConfigConfirmed(true);
        setIsWeighing(!!response.data.weighingStarted);
      }
    } catch {
      setIsConfigConfirmed(false);
    }
  };

  const handleConfirmConfig = async () => {
    if (!scaleId || !selectedScale) {
      toast.error(t('scaleRequired'));
      return;
    }
    const lpn = packageUid.trim();
    if (!lpn) {
      toast.error(t('pleaseFillLpn'));
      return;
    }
    try {
      const response = await api.post<WeighSession>('/sessions', {
        flowType: 'intrans',
        weighingMethod: method,
        scaleId: Number(scaleId),
        scaleName: selectedScale.name,
        packageUid: lpn,
        autosaveEnabled: false,
      });
      setSession(response.data);
      setIsConfigConfirmed(true);
      setLastResult(null);
      toast.success(t('confirmConfig'));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menyimpan session');
    }
  };

  const handleStart = async () => {
    if (!currentWeight?.stable || !session) {
      toast.error(t('waitForStableWeight'));
      return;
    }
    try {
      await api.patch(`/sessions/${session.id}/start-weighing`);
      setIsWeighing(true);
      toast.success(t('weighingStarted'));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal memulai penimbangan');
    }
  };

  const handleConfirmWeighing = async () => {
    if (!currentWeight?.stable || !session) {
      toast.error(t('waitForStableWeight'));
      return;
    }
    setConfirming(true);
    try {
      const response = await api.post<ConfirmResult>('/weighings/confirm', {
        sessionId: session.id,
      });
      setLastResult(response.data);
      const status = response.data.weightStatus?.toLowerCase();
      if (status === 'pass') {
        toast.success(t('weightPass') + ': ' + (response.data.message || ''));
      } else if (status === 'local') {
        toast.success(t('savedLocally'));
      } else {
        toast.warning(t('weightFail') + ': ' + (response.data.message || ''));
      }
      setSession(null);
      setIsWeighing(false);
      setIsConfigConfirmed(false);
      setPackageUid('');
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Gagal menyimpan penimbangan',
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleSendToOdoo = async () => {
    if (!lastResult?.readingId) return;
    setSending(true);
    try {
      const response = await api.post<ConfirmResult>(
        `/weighings/${lastResult.readingId}/send-to-odoo`,
      );
      setLastResult(response.data);
      toast.success(t('sentToOdoo'));
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || error.response?.data?.error || t('sendToOdooFailed'),
      );
    } finally {
      setSending(false);
    }
  };

  const canStart = !!(session && currentWeight && currentWeight.stable);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md brown-glow-animated">
            <ArrowLeftRight className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">{t('intransRecordingAction')}</h1>
            <p className="text-sm text-[#8d6e63]">{t('intransSubtitle')}</p>
          </div>
        </div>
      </div>

      {lastResult && !isConfigConfirmed && (
        <WeighingResultCard
          result={lastResult}
          onSendToOdoo={lastResult.weighingMethod === 'internal' ? handleSendToOdoo : undefined}
          sending={sending}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="border-2 border-[#d7ccc8] shadow-md sticky top-6 z-10 bg-[#fff8f0]">
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="w-8 h-8 rounded-lg bg-[#f5ebe0] flex items-center justify-center">
                  <Package className="w-4 h-4 text-[#6d4c41]" />
                </div>
                <span className="text-[#3e2723]">{t('lpn')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2 pb-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('selectScale')}</Label>
                {scalesError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                    <p className="text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {t('cloudOffline')}: {scalesError}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-8"
                      onClick={() => void reloadScales()}
                    >
                      <RefreshCw className="w-3 h-3 mr-2" />
                      {t('retryCloudConnection')}
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={scaleId || undefined}
                    onValueChange={setScaleId}
                    disabled={isConfigConfirmed || scalesLoading || scales.length === 0}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue
                        placeholder={scalesLoading ? t('loadingScales') : t('selectScale')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {scales.map((scale) => (
                        <SelectItem key={scale.id} value={String(scale.id)}>
                          {scale.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['odoo', 'internal'] as WeighingMethod[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={isConfigConfirmed}
                    onClick={() => setMethod(value)}
                    className={cn(
                      'h-10 rounded-lg text-sm font-semibold border transition-all',
                      method === value
                        ? 'brown-gradient-animated text-white border-transparent'
                        : 'bg-white text-[#5d4037] border-[#d7ccc8]',
                    )}
                  >
                    {value === 'odoo' ? t('methodOdoo') : t('methodInternal')}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('lpn')}</Label>
                <Input
                  value={packageUid}
                  onChange={(e) => setPackageUid(e.target.value)}
                  placeholder="RM-BOM-31/05/2026-000011"
                  className="h-10 font-mono"
                  disabled={isConfigConfirmed}
                />
                <p className="text-[10px] text-[#8d6e63]">{t('intransLpnHint')}</p>
              </div>
              <Button
                onClick={handleConfirmConfig}
                className="w-full h-10 brown-gradient-animated text-white font-semibold"
                disabled={
                  isWeighing ||
                  isConfigConfirmed ||
                  !scaleId ||
                  !!scalesError ||
                  scalesLoading
                }
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('confirmConfig')}
              </Button>
              {session && (
                <Button
                  variant="outline"
                  className="w-full h-10 border-red-200 text-red-600"
                  disabled={isWeighing}
                  onClick={async () => {
                    if (!confirm(t('confirmResetSession'))) return;
                    try {
                      await api.patch(`/sessions/${session.id}/end`);
                      setSession(null);
                      setIsConfigConfirmed(false);
                      setIsWeighing(false);
                      setPackageUid('');
                      setLastResult(null);
                      toast.success(t('sessionReset'));
                    } catch (error: any) {
                      toast.error(error.response?.data?.message || 'Failed to reset');
                    }
                  }}
                >
                  Reset
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {isConfigConfirmed ? (
            <div className="space-y-5">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-[#3e2723]">{t('lpn')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 pb-6 px-6">
                  <p className="text-lg font-mono font-bold text-[#3e2723] break-all">
                    {packageUid || session?.packageUid}
                  </p>
                  <p className="text-xs text-[#8d6e63] mt-2">
                    {method === 'odoo' ? t('odooTareNote') : t('intransInternalNote')}
                  </p>
                </CardContent>
              </Card>
              <WeighingScaleCard
                currentWeight={currentWeight}
                isWeighing={isWeighing}
                confirming={confirming}
                canStart={canStart}
                scaleName={session?.scaleName || selectedScale?.name}
                confirmLabel={method === 'odoo' ? t('confirmWeighing') : t('saveWeight')}
                onStart={handleStart}
                onConfirm={handleConfirmWeighing}
              />
            </div>
          ) : (
            <Card className="h-full min-h-[500px] border-0 shadow-sm">
              <CardContent className="flex items-center justify-center h-full min-h-[500px] py-16">
                <div className="text-center text-gray-400 max-w-sm">
                  <p className="text-base font-medium text-gray-500 mb-1">{t('waitingForConfig')}</p>
                  <p className="text-sm text-gray-400">{t('intransWaitingHint')}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

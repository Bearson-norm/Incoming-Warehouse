import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
import { subscribeToWeight } from '../services/socket';
import { WeightLivePayload } from '../types/socket';
import api from '../services/api';
import { toast } from 'sonner';
import { CheckCircle, Package, Activity } from 'lucide-react';
import { cn } from '../components/ui/utils';
import PrintLabel, { PrintLabelData, printLabelInNewWindow } from '../components/PrintLabel';
import { getPrintValidationError } from '../utils/printLabelValidation';
import WeighingScaleCard from '../components/WeighingScaleCard';
import WeighingResultCard from '../components/WeighingResultCard';
import {
  ConfirmResult,
  Packaging,
  parseLabelMetadata,
  RmCode,
  Vendor,
  WeighingMethod,
  WeighSession,
} from '../types/weighing';
import { useCloudScales } from '../hooks/useCloudScales';
import { AlertCircle, RefreshCw } from 'lucide-react';

function toPrintData(args: {
  lpn: string;
  dateIncoming: string;
  result: ConfirmResult;
  vendorName?: string;
  packagingName?: string;
  rmCode?: string;
}): PrintLabelData {
  return {
    vendorName: args.vendorName || '',
    packagingName: args.packagingName || '',
    tareWeight: args.result.tareWeight ?? 0,
    weight: args.result.grossWeight ?? 0,
    unit: 'kg',
    capturedAt: new Date().toISOString(),
    referenceOdoo: args.rmCode || '',
    batch: '',
    labelProductNumber: args.lpn,
    poAdj: '',
    skuName: args.rmCode || args.packagingName || '',
    dateIncoming: args.dateIncoming,
  };
}

export default function RecordingAction() {
  const { t } = useI18n();
  const [method, setMethod] = useState<WeighingMethod>('odoo');
  const [packageUid, setPackageUid] = useState('');
  const [dateIncoming, setDateIncoming] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rmCodes, setRmCodes] = useState<RmCode[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [packagingId, setPackagingId] = useState('');
  const [rmCodeId, setRmCodeId] = useState('');
  const [session, setSession] = useState<WeighSession | null>(null);
  const [currentWeight, setCurrentWeight] = useState<WeightLivePayload | null>(null);
  const [isWeighing, setIsWeighing] = useState(false);
  const [isConfigConfirmed, setIsConfigConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<ConfirmResult | null>(null);
  const [printLabelData, setPrintLabelData] = useState<PrintLabelData | null>(null);
  const {
    scales,
    scaleId,
    setScaleId,
    selectedScale,
    loading: scalesLoading,
    error: scalesError,
    reload: reloadScales,
  } = useCloudScales();

  const selectedVendor = vendors.find((v) => String(v.id) === vendorId);
  const selectedPackaging = selectedVendor?.packagings?.find((p) => String(p.id) === packagingId);
  const selectedRm = rmCodes.find((r) => String(r.id) === rmCodeId);

  useEffect(() => {
    loadMasters();
    loadActiveSession();
  }, []);

  useEffect(() => {
    const unsubscribeWeight = subscribeToWeight((payload) => {
      setCurrentWeight(payload);
    });
    return () => {
      unsubscribeWeight();
    };
  }, []);

  const loadMasters = async () => {
    try {
      const [vendorRes, rmRes] = await Promise.all([
        api.get<Vendor[]>('/vendors'),
        api.get<RmCode[]>('/rm-codes'),
      ]);
      setVendors(vendorRes.data);
      setRmCodes(rmRes.data);
    } catch {
      // masters optional until internal method is used
    }
  };

  const loadActiveSession = async () => {
    try {
      const response = await api.get<WeighSession | null>('/sessions/active', {
        params: { flowType: 'incoming' },
      });
      if (response.data) {
        applySession(response.data);
      } else {
        setIsConfigConfirmed(false);
      }
    } catch {
      setIsConfigConfirmed(false);
    }
  };

  const applySession = (data: WeighSession) => {
    setSession(data);
    setMethod(data.weighingMethod === 'internal' ? 'internal' : 'odoo');
    setPackageUid(data.packageUid || '');
    setVendorId(data.vendorId ? String(data.vendorId) : '');
    setPackagingId(data.packagingId ? String(data.packagingId) : '');
    setRmCodeId(data.rmCodeId ? String(data.rmCodeId) : '');
    if (data.scaleId) {
      setScaleId(String(data.scaleId));
    }
    const meta = parseLabelMetadata(data.labelMetadata);
    if (typeof meta.dateIncoming === 'string') {
      setDateIncoming(meta.dateIncoming);
    }
    setIsConfigConfirmed(true);
    setIsWeighing(!!data.weighingStarted);
  };

  const handleConfirmConfig = async () => {
    if (!scaleId || !selectedScale) {
      toast.error(t('scaleRequired'));
      return;
    }
    if (method === 'odoo') {
      if (!packageUid.trim()) {
        toast.error(t('pleaseFillLpn'));
        return;
      }
    } else if (!vendorId || !packagingId || !rmCodeId) {
      toast.error(t('pleaseSelectTareAndRm'));
      return;
    }

    try {
      const response = await api.post<WeighSession>('/sessions', {
        flowType: 'incoming',
        weighingMethod: method,
        autosaveEnabled: false,
        scaleId: Number(scaleId),
        scaleName: selectedScale.name,
        packageUid: packageUid.trim() || undefined,
        vendorId: method === 'internal' ? Number(vendorId) : undefined,
        packagingId: method === 'internal' ? Number(packagingId) : undefined,
        rmCodeId: method === 'internal' ? Number(rmCodeId) : undefined,
        labelMetadata: dateIncoming ? { dateIncoming } : undefined,
      });
      applySession(response.data);
      setLastResult(null);
      toast.success(t('confirmConfig'));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menyimpan session');
    }
  };

  const handleStart = async () => {
    if (!currentWeight || !session) {
      toast.error(t('waitForStableWeight'));
      return;
    }
    if (!currentWeight.stable) {
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

  const resetForm = (clearResult = false) => {
    setCurrentWeight(null);
    if (clearResult) {
      setPackageUid('');
      setDateIncoming('');
      setVendorId('');
      setPackagingId('');
      setRmCodeId('');
      setLastResult(null);
    }
  };

  const handleConfirmWeighing = async () => {
    if (!currentWeight || !session) {
      toast.error('Tidak ada data berat yang tersedia');
      return;
    }
    if (!currentWeight.stable) {
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
      resetForm(false);
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Gagal menyimpan penimbangan';
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  const handleSendToOdoo = async () => {
    if (!lastResult?.readingId) return;
    const lpn = lastResult.packageUid || packageUid.trim();
    if (!lpn) {
      toast.error(t('pleaseFillLpnForOdoo'));
      return;
    }
    if (!lastResult.packageUid && lpn) {
      try {
        await api.patch(`/readings/${lastResult.readingId}/label`, {
          packageUid: lpn,
          dateIncoming: dateIncoming || undefined,
        });
      } catch (error: any) {
        toast.error(error.response?.data?.message || t('pleaseFillLpnForOdoo'));
        return;
      }
    }
    setSending(true);
    try {
      const response = await api.post<ConfirmResult>(
        `/weighings/${lastResult.readingId}/send-to-odoo`,
      );
      setLastResult(response.data);
      toast.success(t('sentToOdoo'));
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.response?.data?.error || t('sendToOdooFailed'));
    } finally {
      setSending(false);
    }
  };

  const handlePrint = () => {
    if (!lastResult) return;
    const lpn = lastResult.packageUid || packageUid.trim();
    const data = toPrintData({
      lpn,
      dateIncoming,
      result: lastResult,
      vendorName: selectedVendor?.name || session?.vendor?.name,
      packagingName: selectedPackaging?.name || session?.packaging?.name,
      rmCode: selectedRm?.code || session?.rmCode?.code,
    });
    const errorKey = getPrintValidationError(data);
    if (errorKey) {
      toast.error(t(errorKey));
      return;
    }
    flushSync(() => setPrintLabelData(data));
    window.setTimeout(() => {
      if (!printLabelInNewWindow()) {
        toast.error(t('printBlocked'));
      }
    }, 80);
  };

  const canStart = !!(session && currentWeight && currentWeight.stable);
  const packingOptions: Packaging[] = selectedVendor?.packagings || [];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      <PrintLabel data={printLabelData} />
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md brown-glow-animated">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">{t('recordingAction')}</h1>
            <p className="text-sm text-[#8d6e63]">{t('incomingSubtitle')}</p>
          </div>
        </div>
      </div>

      {lastResult && !isConfigConfirmed && (
        <WeighingResultCard
          result={lastResult}
          onSendToOdoo={lastResult.weighingMethod === 'internal' ? handleSendToOdoo : undefined}
          sending={sending}
          onPrint={handlePrint}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="border-2 border-[#d7ccc8] shadow-md sticky top-6 z-10 overflow-visible bg-[#fff8f0]">
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="flex items-center gap-3 text-base leading-tight">
                <div className="w-8 h-8 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
                  <Package className="w-4 h-4 text-[#6d4c41]" />
                </div>
                <span className="text-[#3e2723]">{t('weighingMethod')}</span>
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

              {method === 'internal' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#5d4037]">{t('vendor')}</Label>
                    <Select
                      value={vendorId || undefined}
                      onValueChange={(v) => {
                        setVendorId(v);
                        setPackagingId('');
                      }}
                      disabled={isConfigConfirmed}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={t('selectVendor')} />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={String(vendor.id)}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#5d4037]">{t('packaging')}</Label>
                    <Select
                      value={packagingId || undefined}
                      onValueChange={setPackagingId}
                      disabled={isConfigConfirmed || !vendorId}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={t('selectPackaging')} />
                      </SelectTrigger>
                      <SelectContent>
                        {packingOptions.map((packaging) => (
                          <SelectItem key={packaging.id} value={String(packaging.id)}>
                            {packaging.name} ({packaging.tareWeight ?? '-'} kg)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#5d4037]">{t('rmCode')}</Label>
                    <Select
                      value={rmCodeId || undefined}
                      onValueChange={setRmCodeId}
                      disabled={isConfigConfirmed}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={t('selectRmCode')} />
                      </SelectTrigger>
                      <SelectContent>
                        {rmCodes.map((rm) => (
                          <SelectItem key={rm.id} value={String(rm.id)}>
                            {rm.code}
                            {rm.name ? ` — ${rm.name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('lpn')}</Label>
                <Input
                  type="text"
                  value={packageUid}
                  onChange={(e) => setPackageUid(e.target.value)}
                  placeholder="RM-BOM-31/05/2026-000011"
                  className="h-10 font-mono"
                  autoComplete="off"
                  disabled={isConfigConfirmed}
                />
                <p className="text-[10px] text-[#8d6e63]">
                  {method === 'odoo' ? t('lpnHint') : t('lpnOptionalHint')}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('dateIncoming')}</Label>
                <Input
                  type="date"
                  value={dateIncoming}
                  onChange={(e) => setDateIncoming(e.target.value)}
                  className="h-10"
                  disabled={isConfigConfirmed}
                />
                <p className="text-[10px] text-[#8d6e63]">{t('dateIncomingHint')}</p>
              </div>

              <Button
                onClick={handleConfirmConfig}
                className="w-full h-10 brown-gradient-animated text-white font-semibold shadow-md brown-hover-effect brown-glow-animated"
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
                  onClick={async () => {
                    if (!confirm(t('confirmResetSession'))) return;
                    try {
                      await api.patch(`/sessions/${session.id}/end`);
                      setSession(null);
                      setIsConfigConfirmed(false);
                      setIsWeighing(false);
                      resetForm(true);
                      toast.success(t('sessionReset'));
                    } catch (error: any) {
                      toast.error(error.response?.data?.message || 'Failed to reset');
                    }
                  }}
                  variant="outline"
                  className="w-full h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={isWeighing}
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
              <Card className="border-0 shadow-sm overflow-visible">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-[#3e2723] leading-tight">
                    {method === 'odoo' ? t('lpn') : t('methodInternal')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 pb-6 px-6 space-y-1">
                  <p className="text-lg font-mono font-bold text-[#3e2723] break-all">
                    {packageUid || session?.packageUid || t('lpnNotSet')}
                  </p>
                  {method === 'internal' && selectedPackaging && (
                    <p className="text-sm text-[#5d4037]">
                      {t('tare')}: {selectedPackaging.tareWeight} kg · {t('rmCode')}:{' '}
                      {selectedRm?.code || session?.rmCode?.code}
                    </p>
                  )}
                  <p className="text-xs text-[#8d6e63] mt-2">
                    {method === 'odoo' ? t('odooTareNote') : t('internalTareNote')}
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
                  <p className="text-base font-medium text-gray-500 mb-1">
                    {t('waitingForConfig')}
                  </p>
                  <p className="text-sm text-gray-400">{t('incomingWaitingHint')}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

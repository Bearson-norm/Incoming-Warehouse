import { useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import { SearchableSelect } from '../components/SearchableSelect';
import OdooLocalFallbackDialog from '../components/OdooLocalFallbackDialog';
import {
  composeIncomingLpnPreview,
  previewIncomingUniqueSegment,
} from '../utils/incomingLpn';

function toPrintData(args: {
  lpn: string;
  referenceOdoo: string;
  batch: string;
  arrivalAt: string;
  expiredDate: string;
  result: ConfirmResult;
  vendorName?: string;
  packagingName?: string;
  rmCode?: string;
  skuName?: string;
}): PrintLabelData {
  return {
    vendorName: args.vendorName || '',
    packagingName: args.packagingName || '',
    tareWeight: args.result.tareWeight ?? 0,
    weight: args.result.grossWeight ?? 0,
    unit: 'kg',
    capturedAt: new Date().toISOString(),
    referenceOdoo: args.referenceOdoo,
    batch: args.batch,
    labelProductNumber: args.lpn,
    skuName: args.skuName || args.rmCode || args.packagingName || '',
    skuCode: args.rmCode || undefined,
    expiredDate: args.expiredDate,
    arrivalAt: args.arrivalAt,
  };
}

export default function RecordingAction() {
  const { t } = useI18n();
  const [method, setMethod] = useState<WeighingMethod>('odoo');
  const [packageUid, setPackageUid] = useState('');
  const [referenceOdoo, setReferenceOdoo] = useState('');
  const [batch, setBatch] = useState('');
  const [arrivalAt, setArrivalAt] = useState('');
  const [expiredDate, setExpiredDate] = useState('');
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
  const [odooFailure, setOdooFailure] = useState<string | null>(null);
  const [printLabelData, setPrintLabelData] = useState<PrintLabelData | null>(null);
  const [previewUniqueSegment, setPreviewUniqueSegment] = useState('');
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
    setReferenceOdoo(typeof meta.referenceOdoo === 'string' ? meta.referenceOdoo : '');
    setBatch(typeof meta.batch === 'string' ? meta.batch : '');
    setArrivalAt(typeof meta.arrivalAt === 'string' ? meta.arrivalAt : '');
    const storedExpiredDate =
      typeof meta.expiredDate === 'string'
        ? meta.expiredDate
        : typeof meta.dateIncoming === 'string'
          ? meta.dateIncoming
          : '';
    setExpiredDate(storedExpiredDate);
    const uniqueSeg =
      typeof meta.lpnUniqueSegment === 'string' ? meta.lpnUniqueSegment : '';
    if (uniqueSeg) {
      setPreviewUniqueSegment(uniqueSeg);
    }
    setIsConfigConfirmed(true);
    setIsWeighing(!!data.weighingStarted);
  };

  useEffect(() => {
    if (
      method === 'internal' &&
      !isConfigConfirmed &&
      !previewUniqueSegment
    ) {
      setPreviewUniqueSegment(previewIncomingUniqueSegment());
    }
  }, [method, isConfigConfirmed, previewUniqueSegment]);

  const internalLpnPreview = useMemo(() => {
    if (method !== 'internal' || !selectedRm?.code) return null;
    if (!previewUniqueSegment) return null;
    return composeIncomingLpnPreview({
      uniqueSegment: previewUniqueSegment,
      reference: referenceOdoo,
      rmCode: selectedRm.code,
      batch,
    });
  }, [
    method,
    previewUniqueSegment,
    referenceOdoo,
    batch,
    selectedRm?.code,
  ]);

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
    } else {
      const draftPrint = toPrintData({
        lpn: internalLpnPreview || 'LPN-N/A',
        referenceOdoo,
        batch,
        arrivalAt,
        expiredDate,
        result: {
          success: true,
          readingId: 0,
          packageUid: '',
          tareWeight: selectedPackaging?.tareWeight ?? 0,
          grossWeight: 0,
          netWeight: 0,
          weightStatus: 'local',
          weighingMethod: 'internal',
          flowType: 'incoming',
          syncedToOdoo: false,
        },
        vendorName: selectedVendor?.name,
        packagingName: selectedPackaging?.name,
        rmCode: selectedRm?.code,
        skuName: selectedRm?.name || selectedRm?.code,
      });
      const printError = getPrintValidationError(draftPrint);
      if (printError) {
        toast.error(t(printError));
        return;
      }
    }

    try {
      const response = await api.post<WeighSession>('/sessions', {
        flowType: 'incoming',
        weighingMethod: method,
        autosaveEnabled: false,
        scaleId: Number(scaleId),
        scaleName: selectedScale.name,
        ...(method === 'odoo'
          ? { packageUid: packageUid.trim().toUpperCase() }
          : {}),
        vendorId: method === 'internal' ? Number(vendorId) : undefined,
        packagingId: method === 'internal' ? Number(packagingId) : undefined,
        rmCodeId: method === 'internal' ? Number(rmCodeId) : undefined,
        labelMetadata:
          method === 'internal'
            ? {
                referenceOdoo: referenceOdoo.trim(),
                batch: batch.trim(),
                arrivalAt,
                expiredDate,
                vendorName: selectedVendor?.name || '',
                skuName: selectedRm?.name || selectedRm?.code || '',
              }
            : referenceOdoo.trim() || batch.trim() || arrivalAt || expiredDate
              ? {
                  referenceOdoo: referenceOdoo.trim(),
                  batch: batch.trim(),
                  arrivalAt,
                  expiredDate,
                  vendorName: selectedVendor?.name || '',
                  skuName: selectedRm?.name || selectedRm?.code || '',
                }
              : undefined,
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
      setReferenceOdoo('');
      setBatch('');
      setArrivalAt('');
      setExpiredDate('');
      setVendorId('');
      setPackagingId('');
      setRmCodeId('');
      setPreviewUniqueSegment('');
      setLastResult(null);
    }
  };

  const completeWeighing = (result: ConfirmResult) => {
    setLastResult(result);
    const status = result.weightStatus?.toLowerCase();
    if (status === 'pass') {
      toast.success(t('weightPass') + ': ' + (result.message || ''));
    } else if (status === 'local') {
      toast.success(t('savedLocally'));
    } else {
      toast.warning(t('weightFail') + ': ' + (result.message || ''));
    }
    setOdooFailure(null);
    setSession(null);
    setIsWeighing(false);
    setIsConfigConfirmed(false);
    resetForm(false);
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
      completeWeighing(response.data);
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Gagal menyimpan penimbangan';
      if (method === 'odoo') {
        setOdooFailure(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleSaveLocalFallback = async () => {
    if (!session) return;
    setConfirming(true);
    try {
      const response = await api.post<ConfirmResult>('/weighings/confirm', {
        sessionId: session.id,
        saveLocally: true,
      });
      completeWeighing(response.data);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Gagal menyimpan penimbangan secara lokal',
      );
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
          referenceOdoo: referenceOdoo.trim(),
          batch: batch.trim(),
          arrivalAt,
          expiredDate: expiredDate || undefined,
          vendorName: selectedVendor?.name || '',
          skuName: selectedRm?.name || selectedRm?.code || '',
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

  const handlePrint = async () => {
    if (!lastResult) return;
    const lpn = (lastResult.packageUid || packageUid).trim().toUpperCase();
    const data = toPrintData({
      lpn,
      referenceOdoo,
      batch,
      arrivalAt,
      expiredDate,
      result: lastResult,
      vendorName: selectedVendor?.name || session?.vendor?.name,
      packagingName: selectedPackaging?.name || session?.packaging?.name,
      rmCode: selectedRm?.code || session?.rmCode?.code,
      skuName:
        selectedRm?.name ||
        session?.rmCode?.name ||
        selectedRm?.code ||
        session?.rmCode?.code,
    });
    const errorKey = getPrintValidationError(data);
    if (errorKey) {
      toast.error(t(errorKey));
      return;
    }
    try {
      await api.patch(`/readings/${lastResult.readingId}/label`, {
        packageUid: lpn,
        referenceOdoo: referenceOdoo.trim(),
        batch: batch.trim(),
        arrivalAt,
        expiredDate,
        vendorName: selectedVendor?.name || '',
        skuName: selectedRm?.name || selectedRm?.code || '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('printIncomplete'));
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
  const filteredRmCodes = vendorId
    ? rmCodes.filter((rm) => rm.vendorId === Number(vendorId))
    : [];

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
          onSendToOdoo={!lastResult.syncedToOdoo ? handleSendToOdoo : undefined}
          sending={sending}
          onPrint={method === 'internal' ? handlePrint : undefined}
        />
      )}

      <OdooLocalFallbackDialog
        open={!!odooFailure}
        error={odooFailure || ''}
        saving={confirming}
        onCancel={() => setOdooFailure(null)}
        onSaveLocal={handleSaveLocalFallback}
      />

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
                  <SearchableSelect
                    value={scaleId}
                    onValueChange={setScaleId}
                    disabled={isConfigConfirmed || scalesLoading || scales.length === 0}
                    options={scales.map((scale) => ({ value: String(scale.id), label: scale.name }))}
                    placeholder={scalesLoading ? t('loadingScales') : t('selectScale')}
                    className="h-10"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['odoo', 'internal'] as WeighingMethod[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={isConfigConfirmed}
                    onClick={() => {
                      setMethod(value);
                      if (value === 'internal' && !previewUniqueSegment) {
                        setPreviewUniqueSegment(previewIncomingUniqueSegment());
                      }
                    }}
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
                    <SearchableSelect
                      value={vendorId}
                      onValueChange={(v) => {
                        setVendorId(v);
                        setPackagingId('');
                        setRmCodeId('');
                      }}
                      disabled={isConfigConfirmed}
                      options={vendors.map((vendor) => ({ value: String(vendor.id), label: vendor.name }))}
                      placeholder={t('selectVendor')}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#5d4037]">{t('packaging')}</Label>
                    <SearchableSelect
                      value={packagingId}
                      onValueChange={setPackagingId}
                      disabled={isConfigConfirmed || !vendorId}
                      options={packingOptions.map((packaging) => ({ value: String(packaging.id), label: `${packaging.name} (${packaging.tareWeight ?? '-'} kg)` }))}
                      placeholder={t('selectPackaging')}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#5d4037]">{t('rmCode')}</Label>
                    <SearchableSelect
                      value={rmCodeId}
                      onValueChange={setRmCodeId}
                      disabled={isConfigConfirmed || !vendorId}
                      options={filteredRmCodes.map((rm) => ({
                        value: String(rm.id),
                        label: rm.name || rm.code,
                      }))}
                      placeholder={t('selectRmCode')}
                      className="h-10"
                    />
                  </div>
                </>
              )}

              {method === 'odoo' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#5d4037]">{t('lpn')}</Label>
                  <Input
                    type="text"
                    value={packageUid}
                    onChange={(e) => setPackageUid(e.target.value.toUpperCase())}
                    placeholder="RM-BOM-31/05/2026-000011"
                    className="h-10 font-mono"
                    autoComplete="off"
                    disabled={isConfigConfirmed}
                  />
                  <p className="text-[10px] text-[#8d6e63]">{t('lpnHint')}</p>
                </div>
              )}

              {method === 'internal' && (
                <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('referenceOdoo')}</Label>
                <Input
                  type="text"
                  value={referenceOdoo}
                  onChange={(e) => setReferenceOdoo(e.target.value)}
                  className="h-10 font-mono"
                  disabled={isConfigConfirmed}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('batch')}</Label>
                <Input
                  type="text"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="h-10 font-mono"
                  disabled={isConfigConfirmed}
                  autoComplete="off"
                />
                <p className="text-[10px] text-[#8d6e63]">{t('batchHint')}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('arrivalDate')}</Label>
                <Input
                  type="date"
                  value={arrivalAt}
                  onChange={(e) => setArrivalAt(e.target.value)}
                  className="h-10"
                  disabled={isConfigConfirmed}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('bestBeforeDate')}</Label>
                <Input
                  type="date"
                  value={expiredDate}
                  onChange={(e) => setExpiredDate(e.target.value)}
                  className="h-10"
                  disabled={isConfigConfirmed}
                />
                <p className="text-[10px] text-[#8d6e63]">{t('expiredDateHint')}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('uniqueNumber')}</Label>
                <Input
                  type="text"
                  value={
                    isConfigConfirmed
                      ? previewUniqueSegment || '—'
                      : previewUniqueSegment || t('lpnNotSet')
                  }
                  readOnly
                  className="h-10 font-mono bg-[#efebe9]"
                  autoComplete="off"
                />
                <p className="text-[10px] text-[#8d6e63]">{t('uniqueNumberHint')}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5d4037]">{t('lpn')}</Label>
                <Input
                  type="text"
                  value={
                    isConfigConfirmed
                      ? packageUid || session?.packageUid || '—'
                      : internalLpnPreview || '—'
                  }
                  readOnly
                  className="h-10 font-mono bg-[#efebe9] break-all"
                  autoComplete="off"
                />
                <p className="text-[10px] text-[#8d6e63]">{t('internalLpnPreviewHint')}</p>
              </div>
                </>
              )}

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
                      {selectedRm?.name || session?.rmCode?.name || selectedRm?.code || session?.rmCode?.code}
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

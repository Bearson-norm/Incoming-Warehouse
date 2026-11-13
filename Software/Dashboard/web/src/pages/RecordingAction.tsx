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
import PrintLabel, { PrintLabelData } from '../components/PrintLabel';
import { getInternalIncomingFieldsError } from '../utils/internalIncomingFieldValidation';
import { getPrintValidationError } from '../utils/printLabelValidation';
import { loadLabelPrinterSettings } from '../utils/printerSettings';
import {
  formatPrintFailure,
  beginReadingPrint,
  finishReadingPrint,
  markReadingPrinted,
  printRenderedLabel,
} from '../utils/printLabelJob';
import WeighingScaleCard from '../components/WeighingScaleCard';
import WeighingResultCard from '../components/WeighingResultCard';
import {
  BatchQueueItem,
  ConfirmResult,
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
import { composeIncomingLpnPreview } from '../utils/incomingLpn';
import { normalizeLpnField, parsePackageUidInput } from '../utils/parseLpnInput';

type OdooProcess = 'inbound' | 'qc_sample' | 'production';

function metaProcess(value: unknown): OdooProcess {
  return value === 'qc_sample' || value === 'production' ? value : 'inbound';
}

function BatchQueueList({
  items,
  title,
  activeLabel,
  pendingLabel,
  doneLabel,
}: {
  items: BatchQueueItem[];
  title: string;
  activeLabel: string;
  pendingLabel: string;
  doneLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-[#5d4037]">{title}</Label>
      <ol className="space-y-1.5">
        {items.map((item) => {
          const status = item.queueStatus;
          const label =
            status === 'active' ? activeLabel : status === 'done' ? doneLabel : pendingLabel;
          return (
            <li
              key={item.id}
              className={cn(
                'rounded-lg border px-3 py-2',
                status === 'active'
                  ? 'border-[#6d4c41] bg-[#f5ebe0]'
                  : status === 'done'
                    ? 'border-green-200 bg-green-50'
                    : 'border-[#d7ccc8] bg-white',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#3e2723]">
                  {item.batchSequence ?? '—'}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#5d4037]">
                  {label}
                </span>
              </div>
              <p className="font-mono text-xs break-all text-[#3e2723]">
                {item.packageUid || '—'}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function toPrintData(args: {
  lpn: string;
  referenceOdoo: string;
  poNumber: string;
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
    unit: 'g',
    capturedAt: new Date().toISOString(),
    referenceOdoo: args.referenceOdoo,
    poNumber: args.poNumber,
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
  const [odooProcess, setOdooProcess] = useState<OdooProcess>('inbound');
  const [qcRecord, setQcRecord] = useState('');
  const [sampleTare, setSampleTare] = useState('');
  const [referenceOdoo, setReferenceOdoo] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [batch, setBatch] = useState('');
  const [batchWeighing, setBatchWeighing] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState('2');
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
  const allPackagings = useMemo(
    () =>
      vendors.flatMap((v) =>
        (v.packagings || []).map((p) => ({
          ...p,
          vendorName: p.vendorName ?? v.name,
        })),
      ),
    [vendors],
  );
  const selectedPackaging =
    allPackagings.find((p) => String(p.id) === packagingId) ??
    session?.packaging ??
    undefined;
  const selectedRm = rmCodes.find((r) => String(r.id) === rmCodeId);
  const batchQueue = session?.batchQueue ?? [];
  const showBatchQueue = method === 'internal' && batchQueue.length > 0;
  const batchCount = Number(batchQuantity);
  const batchCountValid =
    Number.isInteger(batchCount) && batchCount >= 2 && batchCount <= 30;

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
    setOdooProcess(metaProcess(meta.odooWeighingType));
    setQcRecord(typeof meta.qcRecord === 'string' ? meta.qcRecord : '');
    setSampleTare(
      typeof meta.sampleTareG === 'number'
        ? String(meta.sampleTareG)
        : typeof meta.sampleTareKg === 'number'
          ? String(meta.sampleTareKg * 1000)
          : '',
    );
    setReferenceOdoo(typeof meta.referenceOdoo === 'string' ? meta.referenceOdoo : '');
    const storedPo =
      typeof meta.poNumber === 'string'
        ? meta.poNumber
        : typeof meta.poAdj === 'string'
          ? meta.poAdj
          : '';
    setPoNumber(storedPo);
    setBatch(typeof meta.batch === 'string' ? meta.batch : '');
    setArrivalAt(typeof meta.arrivalAt === 'string' ? meta.arrivalAt : '');
    const storedExpiredDate =
      typeof meta.expiredDate === 'string'
        ? meta.expiredDate
        : typeof meta.dateIncoming === 'string'
          ? meta.dateIncoming
          : '';
    setExpiredDate(storedExpiredDate);
    setIsConfigConfirmed(true);
    setIsWeighing(!!data.weighingStarted);
  };

  const internalLpnPreview = useMemo(() => {
    if (method !== 'internal' || !selectedRm?.code) return null;
    return composeIncomingLpnPreview({
      reference: referenceOdoo,
      rmCode: selectedRm.code,
      batch,
    });
  }, [method, referenceOdoo, batch, selectedRm?.code]);

  const handleConfirmConfig = async () => {
    if (!scaleId || !selectedScale) {
      toast.error(t('scaleRequired'));
      return;
    }
    if (method === 'odoo') {
      const lpnRequired = odooProcess !== 'qc_sample';
      const parsedLpn = parsePackageUidInput(packageUid);
      if (parsedLpn.kind === 'reject') {
        toast.error(parsedLpn.message);
        return;
      }
      const lpn = parsedLpn.kind === 'ok' ? parsedLpn.uid : '';
      if (lpnRequired && !lpn) {
        toast.error(t('pleaseFillLpn'));
        return;
      }
      if (odooProcess === 'qc_sample') {
        if (!qcRecord.trim()) {
          toast.error(t('pleaseFillQcRecord'));
          return;
        }
        const tare = Number(sampleTare);
        if (!Number.isFinite(tare) || tare < 0) {
          toast.error(t('pleaseFillSampleTare'));
          return;
        }
      }
    } else if (!vendorId || !packagingId || !rmCodeId) {
      toast.error(t('pleaseSelectTareAndRm'));
      return;
    } else {
      const fieldsError = getInternalIncomingFieldsError({
        referenceOdoo,
        poNumber,
        batch,
        arrivalAt,
        expiredDate,
        vendorName: selectedVendor?.name,
        skuName: selectedRm?.name || selectedRm?.code,
      });
      if (fieldsError) {
        toast.error(t(fieldsError));
        return;
      }
      if (batchWeighing && !batchCountValid) {
        toast.error(t('batchQuantityInvalid'));
        return;
      }
      if (!internalLpnPreview) {
        toast.error(t('internalFieldsIncomplete'));
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
          ? {
              packageUid: (() => {
                const parsed = parsePackageUidInput(packageUid);
                return parsed.kind === 'ok' ? parsed.uid : undefined;
              })(),
            }
          : {}),
        vendorId: method === 'internal' ? Number(vendorId) : undefined,
        packagingId: method === 'internal' ? Number(packagingId) : undefined,
        rmCodeId: method === 'internal' ? Number(rmCodeId) : undefined,
        ...(method === 'internal' && batchWeighing && batchCountValid
          ? { batchQuantity: batchCount }
          : {}),
        labelMetadata:
          method === 'odoo'
            ? {
                odooWeighingType: odooProcess,
                ...(odooProcess === 'qc_sample'
                  ? {
                      qcRecord: qcRecord.trim(),
                      sampleTareG: Number(sampleTare),
                    }
                  : {}),
              }
            : {
                referenceOdoo: referenceOdoo.trim(),
                poNumber: poNumber.trim(),
                batch: batch.trim(),
                arrivalAt,
                expiredDate,
                vendorName: selectedVendor?.name || '',
                skuName: selectedRm?.name || selectedRm?.code || '',
              },
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
      setQcRecord('');
      setSampleTare('');
      setOdooProcess('inbound');
      setReferenceOdoo('');
      setPoNumber('');
      setBatch('');
      setArrivalAt('');
      setExpiredDate('');
      setVendorId('');
      setPackagingId('');
      setRmCodeId('');
      setBatchWeighing(false);
      setBatchQuantity('2');
      setLastResult(null);
    }
  };

  const completeWeighing = (result: ConfirmResult) => {
    setLastResult(result);
    const status = result.weightStatus?.toLowerCase();
    if (status === 'pass') {
      toast.success(t('weightPass') + ': ' + (result.message || ''));
    } else if (status === 'pending') {
      toast.success(t('sentRefreshIot'));
    } else if (status === 'local') {
      toast.success(t('savedLocally'));
    } else {
      toast.warning(t('weightFail') + ': ' + (result.message || ''));
    }
    setOdooFailure(null);
    if (method === 'internal') {
      queueAutoPrint(result);
    }
    if (result.nextSession) {
      applySession(result.nextSession);
      resetForm(false);
      toast.success(t('batchNextReady'));
      return;
    }
    setSession(null);
    setIsWeighing(false);
    setIsConfigConfirmed(false);
    setBatchWeighing(false);
    setBatchQuantity('2');
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
      if (method === 'odoo' && error.response?.status === 409) {
        toast.warning(
          typeof msg === 'string' && msg ? msg : t('lpnAlreadyWeighed'),
        );
      } else if (method === 'odoo') {
        setOdooFailure(typeof msg === 'string' ? msg : t('sendToOdooFailed'));
      } else {
        toast.error(typeof msg === 'string' ? msg : 'Gagal menyimpan penimbangan');
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
          poNumber: poNumber.trim(),
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
      poNumber,
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
        poNumber: poNumber.trim(),
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
      void printRenderedLabel('manual').then((outcome) => {
        if (outcome.ok && outcome.via === 'silent' && lastResult) {
          markReadingPrinted(lastResult.readingId);
          return;
        }
        if (!outcome.ok) {
          toast.error(formatPrintFailure(t, outcome, data.labelProductNumber), { duration: 8000 });
        }
      });
    }, 80);
  };

  const queueAutoPrint = (result: ConfirmResult) => {
    if (!loadLabelPrinterSettings().autoPrint) return;
    if (!beginReadingPrint(result.readingId)) return;
    const lpn = (result.packageUid || packageUid).trim().toUpperCase();
    const data = toPrintData({
      lpn,
      referenceOdoo,
      poNumber,
      batch,
      arrivalAt,
      expiredDate,
      result,
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
      finishReadingPrint(result.readingId, false);
      toast.error(`${t(errorKey)}. ${t('printFixInDocuments')}`, { duration: 8000 });
      return;
    }
    flushSync(() => setPrintLabelData(data));
    window.setTimeout(() => {
      void printRenderedLabel('auto')
        .then((outcome) => {
          const printed = outcome.ok && outcome.via === 'silent';
          finishReadingPrint(result.readingId, printed);
          if (!printed && outcome.reason !== 'skipped') {
            toast.error(formatPrintFailure(t, outcome, data.labelProductNumber), { duration: 8000 });
          }
        })
        .catch(() => finishReadingPrint(result.readingId, false));
    }, 80);
  };

  const canStart = !!(session && currentWeight && currentWeight.stable);
  const packingSelectOptions = useMemo(() => {
    const selectedVendorIdNum = vendorId ? Number(vendorId) : null;
    const ownPackagings = selectedVendor?.packagings || [];
    const otherPackagings = allPackagings.filter(
      (p) => p.vendorId !== selectedVendorIdNum,
    );
    return [
      ...ownPackagings.map((p) => ({
        value: String(p.id),
        label: `${p.name} (${p.tareWeight ?? '-'} g)`,
        keywords: selectedVendor?.name ?? '',
      })),
      ...otherPackagings.map((p) => ({
        value: String(p.id),
        label: `${p.name} (${p.tareWeight ?? '-'} g) — ${p.vendorName || 'Global'}`,
        keywords: p.vendorName || '',
      })),
    ];
  }, [vendorId, selectedVendor, allPackagings]);
  const filteredRmCodes = vendorId
    ? rmCodes.filter(
        (rm) =>
          rm.vendorId == null || rm.vendorId === Number(vendorId),
      )
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

      {lastResult && (
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
                      if (value !== 'internal') {
                        setBatchWeighing(false);
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
                      options={packingSelectOptions}
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
                        label: rm.name ? `${rm.name} (${rm.code})` : rm.code,
                        code: rm.code,
                        keywords: rm.name ?? '',
                      }))}
                      placeholder={t('selectRmCode')}
                      className="h-10"
                    />
                  </div>
                </>
              )}

              {method === 'odoo' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#5d4037]">{t('odooProcess')}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['inbound', 'odooProcessInbound'],
                        ['qc_sample', 'odooProcessQc'],
                        ['production', 'odooProcessProduction'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={isConfigConfirmed}
                        onClick={() => setOdooProcess(value)}
                        className={cn(
                          'h-10 rounded-lg text-xs font-semibold border transition-all px-1',
                          odooProcess === value
                            ? 'brown-gradient-animated text-white border-transparent'
                            : 'bg-white text-[#5d4037] border-[#d7ccc8]',
                        )}
                      >
                        {t(label)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {method === 'odoo' && odooProcess === 'qc_sample' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#5d4037]">{t('qcRecord')}</Label>
                    <Input
                      type="text"
                      value={qcRecord}
                      onChange={(e) => setQcRecord(e.target.value)}
                      placeholder="INBOUND-QC-000161"
                      className="h-10 font-mono"
                      autoComplete="off"
                      disabled={isConfigConfirmed}
                    />
                    <p className="text-[10px] text-[#8d6e63]">{t('qcRecordHint')}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#5d4037]">{t('sampleTare')}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={sampleTare}
                      onChange={(e) => setSampleTare(e.target.value)}
                      className="h-10 font-mono"
                      autoComplete="off"
                      disabled={isConfigConfirmed}
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
                    onChange={(e) => {
                      const next = normalizeLpnField(e.target.value);
                      if (next.error) {
                        toast.error(next.error);
                        setPackageUid('');
                        return;
                      }
                      setPackageUid(next.value);
                    }}
                    placeholder="RM-BOM-31/05/2026-000011"
                    className="h-10 font-mono"
                    autoComplete="off"
                    disabled={isConfigConfirmed}
                  />
                  <p className="text-[10px] text-[#8d6e63]">
                    {odooProcess === 'qc_sample' ? t('lpnOptionalQc') : t('lpnHint')}
                  </p>
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
                <Label className="text-xs font-medium text-[#5d4037]">{t('poNumber')}</Label>
                <Input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="h-10 font-mono"
                  disabled={isConfigConfirmed}
                  autoComplete="off"
                  placeholder="PO-..."
                />
                <p className="text-[10px] text-[#8d6e63]">{t('poNumberHint')}</p>
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

              {!showBatchQueue && (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    disabled={isConfigConfirmed}
                    onClick={() => setBatchWeighing((current) => !current)}
                    className={cn(
                      'h-10 w-full rounded-lg text-sm font-semibold border transition-all',
                      batchWeighing
                        ? 'brown-gradient-animated text-white border-transparent'
                        : 'bg-white text-[#5d4037] border-[#d7ccc8]',
                    )}
                  >
                    {t('batchWeigh')}
                  </button>
                  {batchWeighing && (
                    <>
                      <Label className="text-xs font-medium text-[#5d4037]">{t('batchQuantity')}</Label>
                      <Input
                        type="number"
                        min={2}
                        max={30}
                        step={1}
                        value={batchQuantity}
                        onChange={(e) => setBatchQuantity(e.target.value)}
                        className="h-10 font-mono"
                        disabled={isConfigConfirmed}
                        autoComplete="off"
                      />
                      <p className="text-[10px] text-[#8d6e63]">{t('batchQuantityHint')}</p>
                    </>
                  )}
                </div>
              )}

              {showBatchQueue ? (
                <BatchQueueList
                  items={batchQueue}
                  title={t('batchQueueTitle')}
                  activeLabel={t('batchQueueActive')}
                  pendingLabel={t('batchQueuePending')}
                  doneLabel={t('batchQueueDone')}
                />
              ) : batchWeighing ? (
                <p className="text-[10px] text-[#8d6e63]">
                  {t('batchWeighPendingHint').split('{count}').join(
                    batchCountValid ? String(batchCount) : '—',
                  )}
                </p>
              ) : (
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
              )}
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
                    if (!confirm(showBatchQueue ? t('confirmResetBatch') : t('confirmResetSession'))) return;
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
                    {method === 'odoo'
                      ? odooProcess === 'qc_sample'
                        ? t('qcRecord')
                        : t('lpn')
                      : t('methodInternal')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 pb-6 px-6 space-y-1">
                  <p className="text-lg font-mono font-bold text-[#3e2723] break-all">
                    {method === 'odoo' && odooProcess === 'qc_sample'
                      ? qcRecord || t('lpnNotSet')
                      : packageUid || session?.packageUid || t('lpnNotSet')}
                  </p>
                  {method === 'odoo' && odooProcess === 'qc_sample' && (
                    <p className="text-sm text-[#5d4037]">
                      {t('sampleTare')}: {sampleTare || '—'}
                      {(packageUid || session?.packageUid) &&
                        ` · ${t('lpn')}: ${packageUid || session?.packageUid}`}
                    </p>
                  )}
                  {method === 'internal' && selectedPackaging && (
                    <p className="text-sm text-[#5d4037]">
                      {t('tare')}: {selectedPackaging.tareWeight} g · {t('rmCode')}:{' '}
                      {selectedRm?.name || session?.rmCode?.name || selectedRm?.code || session?.rmCode?.code}
                    </p>
                  )}
                  <p className="text-xs text-[#8d6e63] mt-2">
                    {method === 'odoo'
                      ? odooProcess === 'qc_sample'
                        ? t('odooQcNote')
                        : odooProcess === 'production'
                          ? t('odooProductionNote')
                          : t('odooTareNote')
                      : t('internalTareNote')}
                  </p>
                  {showBatchQueue && (
                    <div className="pt-3">
                      <BatchQueueList
                        items={batchQueue}
                        title={t('batchQueueTitle')}
                        activeLabel={t('batchQueueActive')}
                        pendingLabel={t('batchQueuePending')}
                        doneLabel={t('batchQueueDone')}
                      />
                    </div>
                  )}
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

import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import api from '../services/api';
import { toast } from 'sonner';
import {
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  Printer,
  Upload,
  Layers,
  Pencil,
} from 'lucide-react';
import PrintLabel, { PrintLabelData, printLabelInNewWindow } from '../components/PrintLabel';
import { getPrintValidationError } from '../utils/printLabelValidation';
import { ConfirmResult, parseLabelMetadata, Reading, readingLpn } from '../types/weighing';

function readingToPrintData(reading: Reading, overrides?: { lpn?: string; dateIncoming?: string }): PrintLabelData {
  const meta = parseLabelMetadata(reading.session.labelMetadata);
  const lpn = overrides?.lpn || readingLpn(reading);
  const dateIncoming =
    overrides?.dateIncoming ||
    (typeof meta.dateIncoming === 'string' ? meta.dateIncoming : '');
  return {
    vendorName: reading.session.vendor?.name || '',
    packagingName: reading.session.packaging?.name || '',
    tareWeight: reading.tareWeight ?? reading.session.packaging?.tareWeight ?? 0,
    weight: reading.grossWeight ?? reading.weight,
    unit: reading.unit || 'kg',
    capturedAt: reading.capturedAt,
    referenceOdoo: reading.session.rmCode?.code || String(meta.referenceOdoo || ''),
    batch: String(meta.batch || ''),
    labelProductNumber: lpn,
    poAdj: String(meta.poAdj || ''),
    skuName: reading.session.rmCode?.code || String(meta.skuName || ''),
    dateIncoming,
  };
}

export default function RecordDocuments() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [searchDate, setSearchDate] = useState('');
  const [searchLpn, setSearchLpn] = useState('');
  const [appliedLpn, setAppliedLpn] = useState('');
  const [flowType, setFlowType] = useState<'all' | 'incoming' | 'intrans'>('all');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [printLabelData, setPrintLabelData] = useState<PrintLabelData | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [editReading, setEditReading] = useState<Reading | null>(null);
  const [editLpn, setEditLpn] = useState('');
  const [editDate, setEditDate] = useState('');
  const limit = 50;

  useEffect(() => {
    loadReadings();
  }, [searchDate, page, appliedLpn, flowType]);

  const loadReadings = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit };
      if (searchDate) {
        params.startDate = new Date(searchDate).toISOString();
        const endDate = new Date(searchDate);
        endDate.setDate(endDate.getDate() + 1);
        params.endDate = endDate.toISOString();
      }
      if (appliedLpn.trim()) {
        params.packageUid = appliedLpn.trim();
      }
      if (flowType !== 'all') {
        params.flowType = flowType;
      }

      const response = await api.get('/readings', { params });
      const stableReadings = (response.data.data || []).filter((r: Reading) => r.stable);
      setReadings(stableReadings);
      setTotal(response.data.meta?.total || 0);
      setTotalPages(response.data.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to load readings:', error);
      toast.error('Failed to load readings');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (reading: Reading) => {
    const meta = parseLabelMetadata(reading.session.labelMetadata);
    setEditReading(reading);
    setEditLpn(readingLpn(reading));
    setEditDate(typeof meta.dateIncoming === 'string' ? meta.dateIncoming : '');
  };

  const saveEdit = async () => {
    if (!editReading) return;
    try {
      await api.patch(`/readings/${editReading.id}/label`, {
        packageUid: editLpn.trim() || undefined,
        dateIncoming: editDate || '',
      });
      toast.success(t('paramsUpdated'));
      setEditReading(null);
      await loadReadings();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pleaseFillAllFields'));
    }
  };

  const handlePrint = (reading: Reading) => {
    if (reading.session.flowType === 'intrans') {
      toast.error(t('intransNoPrint'));
      return;
    }
    const data = readingToPrintData(reading);
    const errorKey = getPrintValidationError(data);
    if (errorKey) {
      toast.error(t(errorKey));
      openEdit(reading);
      return;
    }
    flushSync(() => setPrintLabelData(data));
    window.setTimeout(() => {
      if (!printLabelInNewWindow()) {
        toast.error(t('printBlocked'));
      }
    }, 80);
  };

  const handleSendToOdoo = async (reading: Reading) => {
    const lpn = readingLpn(reading);
    if (!lpn) {
      toast.error(t('pleaseFillLpnForOdoo'));
      openEdit(reading);
      return;
    }
    setSendingId(reading.id);
    try {
      await api.post<ConfirmResult>(`/weighings/${reading.id}/send-to-odoo`);
      toast.success(t('sentToOdoo'));
      await loadReadings();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || error.response?.data?.error || t('sendToOdooFailed'),
      );
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      <PrintLabel data={printLabelData} />
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md brown-glow-animated">
            <FileText className="w-5 h-5 text-white brown-pulse-animated" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">{t('recordDocuments')}</h1>
            <p className="text-sm text-[#8d6e63]">{t('recordDocumentsSubtitle')}</p>
          </div>
        </div>
      </div>

      <Card className="mb-8 border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0]">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="flex items-center gap-3 text-base leading-tight">
            <Search className="w-4 h-4 text-[#6d4c41]" />
            <span className="text-[#3e2723]">{t('search')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-6 px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5d4037]">{t('lpn')}</label>
              <Input
                value={searchLpn}
                onChange={(e) => setSearchLpn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    setAppliedLpn(searchLpn);
                  }
                }}
                placeholder={t('lpn')}
                className="h-10 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5d4037]">{t('searchByDate')}</label>
              <Input
                type="date"
                value={searchDate}
                onChange={(e) => {
                  setPage(1);
                  setSearchDate(e.target.value);
                }}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5d4037]">{t('flowType')}</label>
              <Select
                value={flowType}
                onValueChange={(v) => {
                  setPage(1);
                  setFlowType(v as 'all' | 'incoming' | 'intrans');
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allFlows')}</SelectItem>
                  <SelectItem value="incoming">{t('incoming')}</SelectItem>
                  <SelectItem value="intrans">{t('intrans')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  setPage(1);
                  setAppliedLpn(searchLpn);
                }}
                className="h-10 brown-gradient-animated text-white"
              >
                <Search className="w-4 h-4 mr-2" />
                {t('search')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-[#d7ccc8] shadow-md bg-[#fff8f0]">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="flex items-center gap-3 text-base">
            <span className="text-[#3e2723]">{t('recordList')}</span>
            <span className="text-xs font-medium text-[#6d4c41] bg-[#f5ebe0] px-2.5 py-0.5 rounded-full">
              {total}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-6 px-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-2 border-[#8d6e63] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-[#8d6e63]">Loading...</p>
            </div>
          ) : readings.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead>{t('flowType')}</TableHead>
                      <TableHead>{t('weighingMethod')}</TableHead>
                      <TableHead>{t('rmCode')}</TableHead>
                      <TableHead>{t('lpn')}</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">{t('gross')}</TableHead>
                      <TableHead className="text-right">{t('tare')}</TableHead>
                      <TableHead className="text-right">{t('net')}</TableHead>
                      <TableHead>Odoo</TableHead>
                      <TableHead>{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings.map((reading) => {
                      const gross = reading.grossWeight ?? reading.weight;
                      const tare =
                        reading.tareWeight ?? reading.session.packaging?.tareWeight ?? 0;
                      const net = reading.netWeight ?? gross - tare;
                      const lpn = readingLpn(reading) || '-';
                      const status = reading.weightStatus?.toUpperCase() || '-';
                      const canSend =
                        reading.session.weighingMethod === 'internal' && !reading.odooLogId;

                      return (
                        <TableRow key={reading.id}>
                          <TableCell className="text-sm">
                            {new Date(reading.capturedAt).toLocaleDateString()}{' '}
                            {new Date(reading.capturedAt).toLocaleTimeString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {reading.session.flowType === 'intrans' ? t('intrans') : t('incoming')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {reading.session.weighingMethod === 'internal'
                              ? t('methodInternal')
                              : t('methodOdoo')}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {reading.session.rmCode?.code || '-'}
                          </TableCell>
                          <TableCell className="text-sm font-mono break-all">{lpn}</TableCell>
                          <TableCell className="text-sm font-semibold">{status}</TableCell>
                          <TableCell className="text-right text-sm">{gross.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm">{Number(tare).toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {Number(net).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {reading.odooLogId ? t('sentToOdoo') : t('localOnly')}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                title={t('completeParams')}
                                onClick={() => openEdit(reading)}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              {reading.session.flowType !== 'intrans' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title={t('print')}
                                  onClick={() => handlePrint(reading)}
                                >
                                  <Printer className="w-3 h-3" />
                                </Button>
                              )}
                              {canSend && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title={t('sendToOdoo')}
                                  disabled={sendingId === reading.id}
                                  onClick={() => handleSendToOdoo(reading)}
                                >
                                  <Upload className="w-3 h-3" />
                                </Button>
                              )}
                              {lpn !== '-' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title={t('lpnBreakdown')}
                                  onClick={() =>
                                    navigate(`/lpn-breakdown?lpn=${encodeURIComponent(lpn)}`)
                                  }
                                >
                                  <Layers className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-[#8d6e63]">
                  {t('page') || 'Page'} {page} / {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <FileText className="w-14 h-14 mx-auto mb-4 opacity-30 text-[#a1887f]" />
              <p className="text-base font-medium text-[#5d4037] mb-1">{t('noRecords')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editReading} onOpenChange={(open) => !open && setEditReading(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('completeParams')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('lpn')}</Label>
              <Input className="font-mono" value={editLpn} onChange={(e) => setEditLpn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('dateIncoming')}</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditReading(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={saveEdit}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

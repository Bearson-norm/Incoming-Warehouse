import { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Vendor, Packaging, RecordingConfig, WeighingRecord } from '../types';
import { websocketService, WeightData } from '../services/websocketService';
import { toast } from 'sonner';
import { Scale, CheckCircle, Printer, Package } from 'lucide-react';
import { cn } from '../components/ui/utils';
import PrintLabel, { PrintLabelData, printLabelInNewWindow } from '../components/PrintLabel';

export default function RecordingAction() {
  const { t } = useI18n();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedPackagingId, setSelectedPackagingId] = useState('');
  const [referenceOdoo, setReferenceOdoo] = useState('');
  const [batch, setBatch] = useState('');
  const [labelProductNumber, setLabelProductNumber] = useState('');
  const [poAdj, setPoAdj] = useState('');
  const [skuName, setSkuName] = useState('');
  const [dateIncoming, setDateIncoming] = useState('');
  const [qty, setQty] = useState<number>(0);
  
  const [config, setConfig] = useState<RecordingConfig | null>(null);
  const [weightData, setWeightData] = useState<WeightData | null>(null);
  const [isWeighing, setIsWeighing] = useState(false);

  // State untuk data print label — SELALU di-render di DOM
  const [printLabelData, setPrintLabelData] = useState<PrintLabelData | null>(null);

  // Load vendors from localStorage
  useEffect(() => {
    const savedVendors = localStorage.getItem('vendors');
    if (savedVendors) {
      setVendors(JSON.parse(savedVendors));
    } else {
      const sampleVendors: Vendor[] = [
        {
          id: '1',
          name: 'PT Supplier A',
          packagings: [
            { id: '1-1', type: 'Karung 50kg', tareWeight: 0.5 },
            { id: '1-2', type: 'Karung 25kg', tareWeight: 0.3 },
          ],
        },
        {
          id: '2',
          name: 'PT Supplier B',
          packagings: [
            { id: '2-1', type: 'Drum 200L', tareWeight: 25 },
            { id: '2-2', type: 'Jerigen 20L', tareWeight: 2 },
          ],
        },
      ];
      localStorage.setItem('vendors', JSON.stringify(sampleVendors));
      setVendors(sampleVendors);
    }
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    websocketService.connect();
    const unsubscribe = websocketService.subscribe((data) => {
      setWeightData(data);
    });

    return () => {
      unsubscribe();
      websocketService.disconnect();
    };
  }, []);

  const selectedVendor = vendors.find(v => v.id === selectedVendorId);
  const selectedPackaging = selectedVendor?.packagings.find(p => p.id === selectedPackagingId);

  const handleConfirmConfig = () => {
    if (!selectedVendor || !selectedPackaging || !referenceOdoo || !batch || !labelProductNumber) {
      toast.error(t('pleaseFillAllFields'));
      return;
    }

    setConfig({
      vendor: selectedVendor,
      packaging: selectedPackaging,
      referenceOdoo,
      batch,
      labelProductNumber,
    });

    toast.success(t('confirmConfig'));
  };

  const handleStart = () => {
    if (!weightData || !config) return;

    if (!weightData.stable) {
      toast.error(t('waitForStableWeight'));
      return;
    }

    setIsWeighing(true);
    websocketService.setRunningMode(true);
  };

  const resetForm = useCallback(() => {
    setConfig(null);
    setIsWeighing(false);
    setSelectedVendorId('');
    setSelectedPackagingId('');
    setReferenceOdoo('');
    setBatch('');
    setLabelProductNumber('');
    setPoAdj('');
    setSkuName('');
    setDateIncoming('');
    setQty(0);
    setPrintLabelData(null);
    websocketService.setRunningMode(false);
  }, []);

  const handleSaveAndPrint = () => {
    if (!weightData || !config) return;

    const netWeight = weightData.gross - config.packaging.tareWeight;
    
    const record: WeighingRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('id-ID'),
      vendorName: config.vendor.name,
      packagingType: config.packaging.type,
      tare: config.packaging.tareWeight,
      gross: weightData.gross,
      net: netWeight,
      referenceOdoo: config.referenceOdoo,
      batch: config.batch,
      labelProductNumber: config.labelProductNumber,
      poAdj,
      skuName,
      dateIncoming,
      qty,
    };

    // 1. Simpan ke localStorage
    const savedRecords = localStorage.getItem('weighingRecords');
    const records: WeighingRecord[] = savedRecords ? JSON.parse(savedRecords) : [];
    records.unshift(record);
    localStorage.setItem('weighingRecords', JSON.stringify(records));

    // 2. flushSync: paksa React commit state ke DOM secara SINKRON
    //    Ini memastikan PrintLabel (dengan QR code SVG) sudah ter-render di DOM
    flushSync(() => {
      setPrintLabelData({
        config,
        record,
        skuName: skuName || config.packaging.type,
        poAdj,
        dateIncoming,
        qty,
      });
    });

    // 3. Tunggu browser repaint, lalu buka jendela baru untuk print
    requestAnimationFrame(() => {
      const printed = printLabelInNewWindow();

      if (printed) {
    toast.success(t('recordSaved'));
      } else {
        toast.error('Gagal membuka jendela print. Pastikan pop-up tidak diblokir.');
      }

      // 4. Reset form setelah print
      setTimeout(() => {
        resetForm();
      }, 500);
    });
  };

  const netWeight = config && weightData ? weightData.gross - config.packaging.tareWeight : 0;
  const canStart = config && weightData && weightData.stable;

  return (
    <div className="p-8">
      {/* === PRINT LABEL: tersembunyi off-screen, dirender agar QR code SVG ada di DOM === */}
      <PrintLabel data={printLabelData} />

      {/* === UI HALAMAN === */}
      <div>
      <div className="mb-6">
        <h1 className="text-3xl mb-2">{t('recordingAction')}</h1>
        <p className="text-gray-600">Konfigurasi dan pencatatan penimbangan barang</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Configuration */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Konfigurasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vendor Selection */}
              <div className="space-y-2">
                <Label>{t('vendor')}</Label>
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectVendor')} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Packaging Selection */}
              <div className="space-y-2">
                <Label>{t('packaging')}</Label>
                <Select 
                  value={selectedPackagingId} 
                  onValueChange={setSelectedPackagingId}
                  disabled={!selectedVendorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectPackaging')} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedVendor?.packagings.map(packaging => (
                      <SelectItem key={packaging.id} value={packaging.id}>
                        {packaging.type} (Tare: {packaging.tareWeight} kg)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reference Odoo */}
              <div className="space-y-2">
                <Label>{t('referenceOdoo')}</Label>
                <Input
                  value={referenceOdoo}
                  onChange={(e) => setReferenceOdoo(e.target.value)}
                  placeholder="WH/IN/00001"
                />
              </div>

              {/* Batch */}
              <div className="space-y-2">
                <Label>{t('batch')}</Label>
                <Input
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="BATCH-2026-001"
                />
              </div>

              {/* Label Product Number */}
              <div className="space-y-2">
                <Label>{t('labelProductNumber')}</Label>
                <Input
                  value={labelProductNumber}
                  onChange={(e) => setLabelProductNumber(e.target.value)}
                  placeholder="PRD-12345"
                />
              </div>

                {/* PO / Adj */}
                <div className="space-y-2">
                  <Label>PO / Adj</Label>
                  <Input
                    value={poAdj}
                    onChange={(e) => setPoAdj(e.target.value)}
                    placeholder="P11469"
                  />
                </div>

                {/* SKU Name */}
                <div className="space-y-2">
                  <Label>SKU Name</Label>
                  <Input
                    value={skuName}
                    onChange={(e) => setSkuName(e.target.value)}
                    placeholder="STICKER ICY GRAPE (30ML)"
                  />
                </div>

                {/* Date Incoming */}
                <div className="space-y-2">
                  <Label>Date Incoming / Best Before</Label>
                  <Input
                    type="date"
                    value={dateIncoming}
                    onChange={(e) => setDateIncoming(e.target.value)}
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    value={qty || ''}
                    onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                    placeholder="2500"
                    min="0"
                  />
                </div>

              {/* Confirm Button */}
              <Button 
                onClick={handleConfirmConfig} 
                className="w-full"
                disabled={isWeighing}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('confirmConfig')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Weighing Display */}
        <div className="lg:col-span-2">
          {config ? (
            <div className="space-y-6">
              {/* Configuration Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Konfigurasi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">{t('vendor')}</p>
                      <p className="font-medium">{config.vendor.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('packaging')}</p>
                      <p className="font-medium">{config.packaging.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('referenceOdoo')}</p>
                      <p className="font-medium">{config.referenceOdoo}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('batch')}</p>
                      <p className="font-medium">{config.batch}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('labelProductNumber')}</p>
                      <p className="font-medium">{config.labelProductNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('tare')}</p>
                      <p className="font-medium">{config.packaging.tareWeight} kg</p>
                    </div>
                      {poAdj && (
                        <div>
                          <p className="text-sm text-gray-500">PO / Adj</p>
                          <p className="font-medium">{poAdj}</p>
                        </div>
                      )}
                      {skuName && (
                        <div>
                          <p className="text-sm text-gray-500">SKU Name</p>
                          <p className="font-medium">{skuName}</p>
                        </div>
                      )}
                      {dateIncoming && (
                        <div>
                          <p className="text-sm text-gray-500">Date Incoming</p>
                          <p className="font-medium">{dateIncoming}</p>
                        </div>
                      )}
                      {qty > 0 && (
                        <div>
                          <p className="text-sm text-gray-500">Qty</p>
                          <p className="font-medium">{qty.toLocaleString('id-ID')}</p>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>

                {/* Weighing Display Card */}
              <Card className="border-2 border-indigo-200">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Scale className="w-6 h-6 text-indigo-600" />
                      {t('currentWeight')}
                    </span>
                    <span className={cn(
                      "text-sm px-3 py-1 rounded-full",
                      weightData?.stable 
                        ? "bg-green-100 text-green-700" 
                        : "bg-yellow-100 text-yellow-700"
                    )}>
                      {weightData?.stable ? t('stable') : t('unstable')}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-8">
                  <div className="space-y-8">
                    {/* Gross Weight */}
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-2">{t('gross')}</p>
                      <div className="text-6xl font-mono bg-gray-100 py-6 rounded-lg">
                        {weightData?.gross.toFixed(2) || '0.00'}
                        <span className="text-3xl text-gray-500 ml-2">kg</span>
                      </div>
                    </div>

                    {/* Net Weight */}
                    <div className="text-center bg-indigo-50 p-6 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">{t('net')} = {t('gross')} - {t('tare')}</p>
                      <div className="text-5xl font-mono text-indigo-600">
                        {netWeight.toFixed(2)}
                        <span className="text-2xl text-indigo-400 ml-2">kg</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4">
                      {!isWeighing ? (
                        <Button 
                          onClick={handleStart}
                          disabled={!canStart}
                          className="w-full h-14 text-lg"
                          size="lg"
                        >
                          <Scale className="w-5 h-5 mr-2" />
                          {t('start')}
                        </Button>
                      ) : (
                        <Button 
                          onClick={handleSaveAndPrint}
                          className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                          size="lg"
                        >
                          <Printer className="w-5 h-5 mr-2" />
                          {t('savePrint')}
                        </Button>
                      )}
                      {!canStart && !isWeighing && (
                        <p className="text-sm text-amber-600 text-center mt-2">
                          {t('waitForStableWeight')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-[600px]">
                <div className="text-center text-gray-400">
                  <Scale className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">{t('waitingForConfig')}</p>
                  <p className="text-sm mt-2">Silakan lengkapi konfigurasi di panel kiri</p>
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

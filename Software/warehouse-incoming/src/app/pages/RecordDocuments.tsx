import React, { useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { WeighingRecord } from '../types';
import { toast } from 'sonner';
import { Search, Printer, Trash2, FileText } from 'lucide-react';
import PrintLabel, { PrintLabelData, printLabelInNewWindow } from '../components/PrintLabel';

export default function RecordDocuments() {
  const { t } = useI18n();
  const [records, setRecords] = useState<WeighingRecord[]>([]);
  const [searchDate, setSearchDate] = useState('');
  const [searchMaterial, setSearchMaterial] = useState('');
  const [searchVendor, setSearchVendor] = useState('');

  // State untuk label print (tersembunyi off-screen, hanya untuk render QR code SVG)
  const [printLabelData, setPrintLabelData] = useState<PrintLabelData | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = () => {
    const savedRecords = localStorage.getItem('weighingRecords');
    if (savedRecords) {
      setRecords(JSON.parse(savedRecords));
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const matchDate = !searchDate || record.date.includes(searchDate);
      const matchMaterial = !searchMaterial || 
        record.labelProductNumber.toLowerCase().includes(searchMaterial.toLowerCase()) ||
        record.batch.toLowerCase().includes(searchMaterial.toLowerCase());
      const matchVendor = !searchVendor || 
        record.vendorName.toLowerCase().includes(searchVendor.toLowerCase());
      
      return matchDate && matchMaterial && matchVendor;
    });
  }, [records, searchDate, searchMaterial, searchVendor]);

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus rekaman ini?')) {
      const updatedRecords = records.filter(r => r.id !== id);
      setRecords(updatedRecords);
      localStorage.setItem('weighingRecords', JSON.stringify(updatedRecords));
      toast.success(t('recordDeleted'));
    }
  };

  const handlePrint = (record: WeighingRecord) => {
    // Bangun config dari data record yang tersimpan
    const config = {
      vendor: { id: '', name: record.vendorName, packagings: [] },
      packaging: { id: '', type: record.packagingType, tareWeight: record.tare },
      referenceOdoo: record.referenceOdoo,
      batch: record.batch,
      labelProductNumber: record.labelProductNumber,
    };

    // flushSync: paksa React render PrintLabel ke DOM secara sinkron
    flushSync(() => {
      setPrintLabelData({
        config,
        record,
        skuName: record.skuName || record.packagingType,
        poAdj: record.poAdj || '',
        dateIncoming: record.dateIncoming || '',
        qty: record.qty || 0,
      });
    });

    // Tunggu browser repaint, lalu buka jendela baru untuk print
    requestAnimationFrame(() => {
      const printed = printLabelInNewWindow();

      if (!printed) {
        toast.error('Gagal membuka jendela print. Pastikan pop-up tidak diblokir.');
      }

      // Bersihkan state setelah cetak
      setTimeout(() => {
        setPrintLabelData(null);
      }, 500);
    });
  };

  return (
    <div className="p-8">
      {/* === PRINT LABEL: tersembunyi off-screen, dirender agar QR code SVG ada di DOM === */}
      <PrintLabel data={printLabelData} />

      <div className="mb-6">
        <h1 className="text-3xl mb-2">{t('recordDocuments')}</h1>
        <p className="text-gray-600">Riwayat penimbangan barang incoming</p>
      </div>

      {/* Search Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            {t('search')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-600">{t('searchByDate')}</label>
              <Input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                placeholder={t('date')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-600">{t('searchByMaterial')}</label>
              <Input
                value={searchMaterial}
                onChange={(e) => setSearchMaterial(e.target.value)}
                placeholder={t('material')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-600">{t('searchByVendor')}</label>
              <Input
                value={searchVendor}
                onChange={(e) => setSearchVendor(e.target.value)}
                placeholder={t('vendor')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Daftar Rekaman ({filteredRecords.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('time')}</TableHead>
                    <TableHead>{t('vendor')}</TableHead>
                    <TableHead>{t('packaging')}</TableHead>
                    <TableHead>{t('batch')}</TableHead>
                    <TableHead>{t('labelProductNumber')}</TableHead>
                    <TableHead className="text-right">{t('gross')} (kg)</TableHead>
                    <TableHead className="text-right">{t('tare')} (kg)</TableHead>
                    <TableHead className="text-right">{t('net')} (kg)</TableHead>
                    <TableHead className="text-center">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>{record.time}</TableCell>
                      <TableCell>{record.vendorName}</TableCell>
                      <TableCell>{record.packagingType}</TableCell>
                      <TableCell>{record.batch}</TableCell>
                      <TableCell>{record.labelProductNumber}</TableCell>
                      <TableCell className="text-right">{record.gross.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{record.tare.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">{record.net.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrint(record)}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">{t('noRecords')}</p>
              <p className="text-sm mt-2">Belum ada data penimbangan yang tersimpan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

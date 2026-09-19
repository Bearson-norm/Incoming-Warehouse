import React from 'react';
import PrintLabel, { PrintLabelData } from './PrintLabel';
import { RecordingConfig, WeighingRecord } from '../types';

/**
 * Contoh penggunaan komponen PrintLabel
 * 
 * Komponen ini menunjukkan cara menggunakan PrintLabel dengan data contoh
 * sesuai gambar label FOOM.
 */
export const PrintLabelExample: React.FC = () => {
  const exampleConfig: RecordingConfig = {
    vendor: {
      id: '1',
      name: 'PT ANUGRAH PRIMA PRINTING',
      packagings: [
        {
          id: '1',
          type: 'STICKER ICY GRAPE (30ML)',
          tareWeight: 0,
        },
      ],
    },
    packaging: {
      id: '1',
      type: 'STICKER ICY GRAPE (30ML)',
      tareWeight: 0,
    },
    referenceOdoo: 'WRMPM/IN/13010',
    batch: '11469-19012026',
    labelProductNumber: '1901-WRM13010-PMSTK00297-4',
  };

  const exampleRecord: WeighingRecord = {
    id: '1',
    date: '2026-01-19',
    time: '14:18:56',
    vendorName: 'PT ANUGRAH PRIMA PRINTING',
    packagingType: 'STICKER ICY GRAPE (30ML)',
    tare: 0,
    gross: 0,
    net: 0,
    referenceOdoo: 'WRMPM/IN/13010',
    batch: '11469-19012026',
    labelProductNumber: '1901-WRM13010-PMSTK00297-4',
  };

  const exampleData: PrintLabelData = {
    config: exampleConfig,
    record: exampleRecord,
    skuName: 'STICKER ICY GRAPE (30ML)',
    poAdj: 'P11469',
    dateIncoming: '2026-01-19',
    qty: 2500,
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5' }}>
      <h2 style={{ marginBottom: '20px' }}>Contoh Print Label</h2>
      {/* Override style agar terlihat di screen (bukan off-screen) */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', left: 'auto', top: 'auto' }}>
          <PrintLabel data={exampleData} />
        </div>
      </div>
    </div>
  );
};

export default PrintLabelExample;

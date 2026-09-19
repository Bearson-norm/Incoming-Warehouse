import React from 'react';
import QRCode from 'react-qr-code';
import { RecordingConfig, WeighingRecord } from '../types';
import logoFoomHitam from '../../assets/logo-foom-hitam.jpg';

export interface PrintLabelData {
  config: RecordingConfig;
  record: WeighingRecord;
  skuName: string;
  poAdj: string;
  dateIncoming: string;
  qty: number;
}

interface PrintLabelProps {
  data: PrintLabelData | null;
}

/* ============================================ */
/* CSS khusus styling label (tanpa @media print) */
/* ============================================ */
const LABEL_CSS = `
  .label-card {
    background-color: #FFD600;
    color: #000000;
    font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    padding: 12px 14px;
    width: 100mm;
    box-sizing: border-box;
    border: 2px solid #000000;
    -webkit-font-smoothing: antialiased;
  }

  .label-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 4mm;
    margin-bottom: 8px;
    border-bottom: 1px solid #000;
    padding-bottom: 6px;
  }

  .label-header-dates {
    font-size: 8.5px;
    font-weight: 700;
    line-height: 1.6;
    flex: 1;
    min-width: 0;
  }

  .label-logo {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    line-height: 0;
  }

  .label-logo-img {
    display: block;
    height: auto;
    max-height: 40px;
    max-width: 42mm;
    width: auto;
    object-fit: contain;
    object-position: right top;
  }

  .label-title {
    text-align: center;
    font-size: 14px;
    font-weight: 800;
    font-family: 'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    letter-spacing: 0.04em;
    margin: 6px 0 4px 0;
  }

  .label-product-number {
    text-align: center;
    font-size: 13px;
    font-weight: 800;
    font-family: 'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    border: 2px solid #000;
    padding: 5px 8px;
    margin: 0 0 8px 0;
    word-break: break-all;
  }

  .label-po {
    font-size: 9px;
    font-weight: 700;
    font-family: 'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    margin-bottom: 6px;
    padding-left: 2px;
  }

  /* Tabel info utama */
  .label-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    margin-bottom: 8px;
  }

  .label-table td {
    border: 1.5px solid #000;
    padding: 4px 6px;
    vertical-align: top;
  }

  .label-table .td-label {
    font-weight: 700;
    width: 25%;
    font-size: 8.5px;
  }

  .label-table .td-value {
    font-size: 9px;
    font-weight: 600;
  }

  /* QR Codes */
  .label-qr-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 8px;
    padding: 0 4px;
  }

  .label-qr-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .label-qr-box {
    background: #fff;
    padding: 3px;
    border: 1px solid #000;
  }

  .label-qr-tag {
    display: inline-block;
    background-color: #FFD600;
    color: #000;
    border: 1.5px solid #000;
    padding: 2px 10px;
    font-size: 8px;
    font-weight: bold;
    text-align: center;
    min-width: 40px;
  }
`;

/**
 * Fungsi utilitas: cetak label di jendela baru (window.open)
 * Ambil HTML yang sudah di-render oleh React (termasuk QR code SVG),
 * lalu buka jendela baru dan cetak dari sana.
 *
 * Pendekatan ini lebih reliable karena:
 * - Tidak bergantung pada @media print CSS yang bisa konflik
 * - Jendela baru hanya berisi label, tanpa sidebar/navigasi
 */
export function printLabelInNewWindow(): boolean {
  const printArea = document.getElementById('print-area');
  if (!printArea) return false;

  const labelCard = printArea.querySelector('.label-card');
  if (!labelCard) return false;

  const printWindow = window.open('', '_blank', 'width=600,height=800');
  if (!printWindow) return false;

  const printBase = document.baseURI || window.location.href;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <base href="${printBase.replace(/"/g, '&quot;')}" />
        <title>Print Label FOOM</title>
        <style>
          body {
            margin: 0;
            padding: 10mm;
            background: #fff;
          }
          @page {
            size: A4;
            margin: 5mm;
          }
          @media print {
            body {
              margin: 0;
              padding: 5mm;
            }
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          ${LABEL_CSS}
        </style>
      </head>
      <body>
        ${labelCard.outerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  // Tunggu sebentar agar browser merender konten, lalu print
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);

  return true;
}

/**
 * Komponen PrintLabel
 *
 * PENTING: Komponen ini di-render di DOM (tersembunyi off-screen).
 * Tujuannya agar React bisa me-render QR code SVG ke DOM.
 * Setelah di-render, fungsi printLabelInNewWindow() mengambil HTML-nya
 * dan mencetaknya di jendela baru.
 */
export const PrintLabel: React.FC<PrintLabelProps> = ({ data }) => {
  if (!data) {
    return <div id="print-area" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} />;
  }

  const { config, record, skuName, poAdj, dateIncoming, qty } = data;

  const now = new Date();
  const printDate = `${now.getDate().toString().padStart(2, '0')}-${now.toLocaleString('en-US', { month: 'short' })}-${now.getFullYear()} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

  const arrivalDateTime = dateIncoming
    ? (() => {
        const d = new Date(dateIncoming);
        return `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()} ${record.time || '00:00:00'}`;
      })()
    : `${record.date} ${record.time}`;

  const dateIncomingFormatted = dateIncoming
    ? (() => {
        const d = new Date(dateIncoming);
        return `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()}`;
      })()
    : record.date;

  // QR code values
  const lpnValue = record.labelProductNumber || config.labelProductNumber || 'N/A';
  const skuValue = skuName || config.packaging.type || 'N/A';
  const batchValue = record.batch || config.batch || 'N/A';

  return (
    <div id="print-area" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '100mm' }}>
      <style>{LABEL_CSS}</style>

      <div className="label-card">
        {/* === HEADER === */}
        <div className="label-header">
          <div className="label-header-dates">
            <div>Tanggal Print : {printDate}</div>
            <div>Tanggal Kedatangan : {arrivalDateTime}</div>
          </div>
          <div className="label-logo">
            <img src={logoFoomHitam} alt="FOOM" className="label-logo-img" />
          </div>
        </div>

        {/* === LABEL PRODUCT NUMBER === */}
        <div className="label-title">Label Product Number</div>
        <div className="label-product-number">
          {record.labelProductNumber || config.labelProductNumber}
        </div>

        {/* === PO / Adj === */}
        <div className="label-po">PO / Adj&nbsp;&nbsp;&nbsp;&nbsp;: {poAdj || '-'}</div>

        {/* === TABLE INFO === */}
        <table className="label-table">
          <tbody>
            {/* Row 1: Sku Name + Batch */}
            <tr>
              <td className="td-label">Sku Name</td>
              <td className="td-value">{skuValue}</td>
              <td className="td-label">Batch</td>
              <td className="td-value">{batchValue}</td>
            </tr>
            {/* Row 2: Name Vendor + Date Incoming */}
            <tr>
              <td className="td-label">Name Vendor</td>
              <td className="td-value">{config.vendor.name}</td>
              <td className="td-label">Date Incoming / Best Before</td>
              <td className="td-value">{dateIncomingFormatted}</td>
            </tr>
            {/* Row 3: Reference Odoo + Qty */}
            <tr>
              <td className="td-label">Reference Odoo</td>
              <td className="td-value">{record.referenceOdoo || config.referenceOdoo}</td>
              <td className="td-label">Qty</td>
              <td className="td-value">{qty > 0 ? qty.toLocaleString('id-ID') : '-'}</td>
            </tr>
          </tbody>
        </table>

        {/* === QR CODES === */}
        <div className="label-qr-row">
          <div className="label-qr-item">
            <div className="label-qr-box">
              <QRCode value={lpnValue} size={70} level="M" />
            </div>
            <div className="label-qr-tag">LPN</div>
          </div>
          <div className="label-qr-item">
            <div className="label-qr-box">
              <QRCode value={skuValue} size={70} level="M" />
            </div>
            <div className="label-qr-tag">SKU</div>
          </div>
          <div className="label-qr-item">
            <div className="label-qr-box">
              <QRCode value={batchValue} size={70} level="M" />
            </div>
            <div className="label-qr-tag">BATCH</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintLabel;

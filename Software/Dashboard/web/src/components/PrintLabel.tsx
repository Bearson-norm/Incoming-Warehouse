import React from 'react';
import QRCode from 'react-qr-code';
import { loadPrintLabelConfig, PrintLabelConfig } from '../utils/printLabelConfig';
import logoFoomHitam from '../assets/logo-foom-hitam.jpg';

/**
 * Interface data yang diperlukan untuk mencetak label FOOM.
 * Bisa dipakai dari RecordingAction maupun RecordDocuments.
 */
export interface PrintLabelData {
  vendorName: string;
  packagingName: string;
  tareWeight: number;
  weight: number;
  unit: string;
  capturedAt: string;
  referenceOdoo: string;
  batch: string;
  labelProductNumber: string;
  poAdj: string;
  skuName: string;
  /** ISO / datetime-local — tanggal & waktu untuk baris "Date Incoming / Best Before" di tabel cetak */
  dateIncoming: string;
  /** Tanggal & waktu kedatangan (ISO atau datetime-local) untuk header "Tanggal Kedatangan" */
  arrivalAt?: string;
}

function formatLabelDateTime(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

/** Nilai dari input datetime-local atau ISO; jika tidak ter-parse, tampilkan teks apa adanya. */
function formatBestBeforeForPrint(raw: string): string {
  const s = raw.trim();
  if (!s) return '-';
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return formatLabelDateTime(d);
  return s;
}

interface PrintLabelProps {
  data: PrintLabelData | null;
  /** Opsional: override config (dipakai untuk live-preview di Setting) */
  configOverride?: PrintLabelConfig;
}

/* ============================================ */
/* Generate CSS dari konfigurasi                */
/* ============================================ */
export function generateLabelCSS(cfg: PrintLabelConfig): string {
  return `
  .label-card {
    background-color: #FFFFFF;
    color: #000000;
    font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    padding: ${cfg.paperPaddingY}mm ${cfg.paperPaddingX}mm;
    width: ${cfg.paperWidth}mm;
    ${cfg.paperHeight > 0 ? `height: ${cfg.paperHeight}mm;` : ''}
    box-sizing: border-box;
    border: 2px solid #000000;
    overflow: hidden;
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
    font-size: ${cfg.headerDatesFontSize}px;
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
    max-height: ${cfg.logoFontSize}px;
    max-width: 42mm;
    width: auto;
    object-fit: contain;
    object-position: right top;
  }

  .label-title {
    text-align: center;
    font-size: ${cfg.titleFontSize}px;
    font-weight: 800;
    font-family: 'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    letter-spacing: 0.04em;
    margin: 6px 0 4px 0;
  }

  .label-product-number {
    text-align: center;
    font-size: ${cfg.productNumberFontSize}px;
    font-weight: 800;
    font-family: 'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    border: 2px solid #000;
    padding: 5px 8px;
    margin: 0 0 8px 0;
    word-break: break-all;
    line-height: 1.3;
  }

  .label-po {
    font-size: ${cfg.poAdjFontSize}px;
    font-weight: 700;
    font-family: 'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    margin-bottom: 6px;
    padding-left: 2px;
  }

  .label-table {
    width: 100%;
    border-collapse: collapse;
    font-size: ${cfg.tableValueFontSize}px;
    margin-bottom: 8px;
  }

  .label-table td {
    border: 1.5px solid #000;
    padding: 4px 6px;
    vertical-align: top;
    line-height: 1.3;
  }

  .label-table .td-label {
    font-weight: 700;
    font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    width: 25%;
    font-size: ${cfg.tableLabelFontSize}px;
  }

  .label-table .td-value {
    font-size: ${cfg.tableValueFontSize}px;
    font-weight: 600;
    word-break: break-word;
  }

  .label-tare-netto {
    font-size: ${cfg.tareNettoFontSize}px !important;
    line-height: 1.3;
  }

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
    background-color: #FFFFFF;
    color: #000;
    border: 1.5px solid #000;
    padding: 2px 10px;
    font-size: ${cfg.qrTagFontSize}px;
    font-weight: bold;
    text-align: center;
    min-width: 40px;
  }
`;
}

/**
 * Fungsi utilitas: cetak label FOOM di jendela baru (window.open).
 *
 * Membaca konfigurasi dari localStorage.
 * Komponen PrintLabel harus sudah di-render di DOM sebelum fungsi ini dipanggil.
 */
export function printLabelInNewWindow(): boolean {
  const printArea = document.getElementById('print-label-area');
  if (!printArea) return false;

  const labelCard = printArea.querySelector('.label-card');
  if (!labelCard) return false;

  const cfg = loadPrintLabelConfig();
  const css = generateLabelCSS(cfg);

  const pageWidth = cfg.paperWidth;
  const pageHeight = cfg.paperHeight > 0 ? cfg.paperHeight : pageWidth * 1.4;

  const printWindow = window.open('', '_blank', `width=${Math.round(pageWidth * 3.78 + 100)},height=${Math.round(pageHeight * 3.78 + 100)}`);
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
            padding: 0;
            background: #fff;
          }
          @page {
            size: ${pageWidth}mm ${cfg.paperHeight > 0 ? cfg.paperHeight + 'mm' : 'auto'};
            margin: 0;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
          }
          @media screen {
            body {
              display: flex;
              justify-content: center;
              align-items: flex-start;
              padding: 10mm;
              background: #f0f0f0;
            }
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          ${css}
        </style>
      </head>
      <body>
        ${labelCard.outerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);

  return true;
}

/**
 * Komponen PrintLabel
 *
 * Komponen ini di-render TERSEMBUNYI di DOM (off-screen).
 * Tujuannya: agar React bisa merender QR code SVG ke DOM.
 * Setelah QR code ter-render, fungsi printLabelInNewWindow()
 * mengambil HTML-nya dan mencetaknya di jendela browser baru.
 *
 * Juga digunakan untuk live-preview di halaman Setting (dengan configOverride).
 */
export const PrintLabel: React.FC<PrintLabelProps> = ({ data, configOverride }) => {
  const cfg = configOverride || loadPrintLabelConfig();

  if (!data) {
    return <div id="print-label-area" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} />;
  }

  const {
    vendorName,
    packagingName,
    tareWeight,
    weight,
    unit,
    capturedAt,
    referenceOdoo,
    batch,
    labelProductNumber,
    poAdj,
    skuName,
    dateIncoming,
    arrivalAt,
  } = data;

  // Hitung net weight — konversi ke gram
  const weightInGrams = unit === 'kg' ? weight * 1000 : weight;
  const tareWeightInGrams = unit === 'kg' ? tareWeight * 1000 : tareWeight;
  const netWeightInGrams = weightInGrams - tareWeightInGrams;

  // Format tanggal print
  const now = new Date();
  const printDate = formatLabelDateTime(now);

  const capturedDate = new Date(capturedAt);

  // Tanggal kedatangan di header: dari arrivalAt bila ada, selain itu dari waktu penimbangan
  const arrivalDateTime = (() => {
    if (arrivalAt) {
      const d = new Date(arrivalAt);
      if (!Number.isNaN(d.getTime())) return formatLabelDateTime(d);
    }
    return formatLabelDateTime(capturedDate);
  })();

  const bestBeforePrint = formatBestBeforeForPrint(dateIncoming);

  // QR code values - pastikan tidak kosong
  const lpnValue = (labelProductNumber && labelProductNumber.trim() !== '' && labelProductNumber !== '-') ? labelProductNumber : 'LPN-N/A';
  const skuValue = (skuName && skuName.trim() !== '' && skuName !== 'N/A') ? skuName : ((packagingName && packagingName.trim() !== '') ? packagingName : 'SKU-N/A');
  const batchValue = (batch && batch.trim() !== '' && batch !== '-') ? batch : 'BATCH-N/A';

  const labelCSS = generateLabelCSS(cfg);

  return (
    <div id="print-label-area" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: `${cfg.paperWidth}mm` }}>
      <style>{labelCSS}</style>

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
          {lpnValue}
        </div>

        {/* === PO / Adj === */}
        <div className="label-po">PO / Adj&nbsp;&nbsp;&nbsp;&nbsp;: {(poAdj && poAdj.trim() !== '' && poAdj !== '-') ? poAdj : 'N/A'}</div>

        {/* === TABLE INFO === */}
        <table className="label-table">
          <tbody>
            <tr>
              <td className="td-label">Sku Name</td>
              <td className="td-value">{skuValue}</td>
              <td className="td-label">Batch</td>
              <td className="td-value">{batchValue}</td>
            </tr>
            <tr>
              <td className="td-label">Name Vendor</td>
              <td className="td-value">{(vendorName && vendorName.trim() !== '' && vendorName !== 'N/A') ? vendorName : 'Vendor N/A'}</td>
              <td className="td-label">Date Incoming / Best Before</td>
              <td className="td-value">{bestBeforePrint}</td>
            </tr>
            <tr>
              <td className="td-label">Reference Odoo</td>
              <td className="td-value">{(referenceOdoo && referenceOdoo.trim() !== '' && referenceOdoo !== '-') ? referenceOdoo : 'REF-N/A'}</td>
              <td className="td-label">Tare / Netto</td>
              <td className="td-value label-tare-netto">
                T: {tareWeightInGrams.toFixed(2)}g<br />
                N: {netWeightInGrams.toFixed(2)}g
              </td>
            </tr>
          </tbody>
        </table>

        {/* === QR CODES === */}
        <div className="label-qr-row">
          <div className="label-qr-item">
            <div className="label-qr-box">
              <QRCode value={lpnValue} size={cfg.qrSize} level="M" />
            </div>
            <div className="label-qr-tag">LPN</div>
          </div>
          <div className="label-qr-item">
            <div className="label-qr-box">
              <QRCode value={skuValue} size={cfg.qrSize} level="M" />
            </div>
            <div className="label-qr-tag">SKU</div>
          </div>
          <div className="label-qr-item">
            <div className="label-qr-box">
              <QRCode value={batchValue} size={cfg.qrSize} level="M" />
            </div>
            <div className="label-qr-tag">BATCH</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Komponen LabelPreview — versi visible untuk preview di halaman Setting.
 * Sama persis dengan PrintLabel tapi tanpa posisi off-screen.
 */
export const LabelPreview: React.FC<PrintLabelProps> = ({ data, configOverride }) => {
  const cfg = configOverride || loadPrintLabelConfig();

  if (!data) return null;

  const {
    vendorName,
    packagingName,
    tareWeight,
    weight,
    unit,
    capturedAt,
    referenceOdoo,
    batch,
    labelProductNumber,
    poAdj,
    skuName,
    dateIncoming,
    arrivalAt,
  } = data;

  const weightInGrams = unit === 'kg' ? weight * 1000 : weight;
  const tareWeightInGrams = unit === 'kg' ? tareWeight * 1000 : tareWeight;
  const netWeightInGrams = weightInGrams - tareWeightInGrams;

  const now = new Date();
  const printDate = formatLabelDateTime(now);

  const capturedDate = new Date(capturedAt);
  const arrivalDateTime = (() => {
    if (arrivalAt) {
      const d = new Date(arrivalAt);
      if (!Number.isNaN(d.getTime())) return formatLabelDateTime(d);
    }
    return formatLabelDateTime(capturedDate);
  })();

  const bestBeforePrint = formatBestBeforeForPrint(dateIncoming);

  const lpnValue = labelProductNumber || 'N/A';
  const skuValue = skuName || packagingName || 'N/A';
  const batchValue = batch || 'N/A';
  const labelCSS = generateLabelCSS(cfg);

  return (
    <div style={{ width: `${cfg.paperWidth}mm` }}>
      <style>{labelCSS}</style>
      <div className="label-card">
        <div className="label-header">
          <div className="label-header-dates">
            <div>Tanggal Print : {printDate}</div>
            <div>Tanggal Kedatangan : {arrivalDateTime}</div>
          </div>
          <div className="label-logo">
            <img src={logoFoomHitam} alt="FOOM" className="label-logo-img" />
          </div>
        </div>

        <div className="label-title">Label Product Number</div>
        <div className="label-product-number">
          {labelProductNumber || '-'}
        </div>

        <div className="label-po">PO / Adj&nbsp;&nbsp;&nbsp;&nbsp;: {poAdj || '-'}</div>

        <table className="label-table">
          <tbody>
            <tr>
              <td className="td-label">Sku Name</td>
              <td className="td-value">{skuValue}</td>
              <td className="td-label">Batch</td>
              <td className="td-value">{batchValue}</td>
            </tr>
            <tr>
              <td className="td-label">Name Vendor</td>
              <td className="td-value">{vendorName}</td>
              <td className="td-label">Date Incoming / Best Before</td>
              <td className="td-value">{bestBeforePrint}</td>
            </tr>
            <tr>
              <td className="td-label">Reference Odoo</td>
              <td className="td-value">{referenceOdoo || '-'}</td>
              <td className="td-label">Tare / Netto</td>
              <td className="td-value label-tare-netto">
                T: {tareWeightInGrams.toFixed(2)}g<br />
                N: {netWeightInGrams.toFixed(2)}g
              </td>
            </tr>
          </tbody>
        </table>

        <div className="label-qr-row">
          <div className="label-qr-item">
            <div className="label-qr-box">
              <QRCode value={lpnValue} size={cfg.qrSize} level="M" />
            </div>
            <div className="label-qr-tag">LPN</div>
          </div>
          <div className="label-qr-item">
            <div className="label-qr-box">
              <QRCode value={skuValue} size={cfg.qrSize} level="M" />
            </div>
            <div className="label-qr-tag">SKU</div>
          </div>
          <div className="label-qr-item">
            <div className="label-qr-box">
              <QRCode value={batchValue} size={cfg.qrSize} level="M" />
            </div>
            <div className="label-qr-tag">BATCH</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintLabel;

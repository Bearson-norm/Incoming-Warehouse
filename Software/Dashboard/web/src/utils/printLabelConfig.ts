/**
 * Konfigurasi ukuran kertas dan font untuk Print Label FOOM.
 * Disimpan di localStorage agar persisten antar sesi.
 */

export interface PrintLabelConfig {
  // === Ukuran Kertas (mm) ===
  paperWidth: number;
  paperHeight: number;       // 0 = auto
  paperPaddingX: number;     // padding horizontal (mm)
  paperPaddingY: number;     // padding vertical (mm)

  // === Font Sizes (px) ===
  headerDatesFontSize: number;
  logoFontSize: number;
  titleFontSize: number;
  productNumberFontSize: number;
  poAdjFontSize: number;
  tableLabelFontSize: number;
  tableValueFontSize: number;
  tareNettoFontSize: number;
  qrTagFontSize: number;

  // === QR Code ===
  qrSize: number;            // px
}

export const DEFAULT_CONFIG: PrintLabelConfig = {
  paperWidth: 100,
  paperHeight: 0,
  paperPaddingX: 3.5,
  paperPaddingY: 3,

  headerDatesFontSize: 8.5,
  logoFontSize: 40,
  titleFontSize: 14,
  productNumberFontSize: 13,
  poAdjFontSize: 9,
  tableLabelFontSize: 8.5,
  tableValueFontSize: 9,
  tareNettoFontSize: 8.5,
  qrTagFontSize: 8,

  qrSize: 70,
};

const STORAGE_KEY = 'printLabelConfig';

/** Baca konfigurasi dari localStorage, fallback ke default */
export function loadPrintLabelConfig(): PrintLabelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    // Merge dengan default agar field baru yang ditambahkan di masa depan tetap ada
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Simpan konfigurasi ke localStorage */
export function savePrintLabelConfig(config: PrintLabelConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** Reset konfigurasi ke default */
export function resetPrintLabelConfig(): PrintLabelConfig {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_CONFIG };
}

/**
 * Deskripsi label untuk setiap field konfigurasi (Bahasa Indonesia).
 * Digunakan di halaman Setting untuk menampilkan nama field.
 */
export const CONFIG_LABELS: Record<keyof PrintLabelConfig, string> = {
  paperWidth: 'Lebar Kertas (mm)',
  paperHeight: 'Tinggi Kertas (mm, 0 = auto)',
  paperPaddingX: 'Padding Horizontal (mm)',
  paperPaddingY: 'Padding Vertical (mm)',
  headerDatesFontSize: 'Font Header Tanggal (px)',
  logoFontSize: 'Tinggi maks logo FOOM (px)',
  titleFontSize: 'Font Judul "Label Product Number" (px)',
  productNumberFontSize: 'Font Nomor Produk (px)',
  poAdjFontSize: 'Font PO / Adj (px)',
  tableLabelFontSize: 'Font Label Tabel (px)',
  tableValueFontSize: 'Font Nilai Tabel (px)',
  tareNettoFontSize: 'Font Tare / Netto (px)',
  qrTagFontSize: 'Font Tag QR Code (px)',
  qrSize: 'Ukuran QR Code (px)',
};

/** Batas min-max untuk tiap field */
export const CONFIG_LIMITS: Record<keyof PrintLabelConfig, { min: number; max: number; step: number }> = {
  paperWidth: { min: 30, max: 210, step: 1 },
  paperHeight: { min: 0, max: 297, step: 1 },
  paperPaddingX: { min: 0, max: 20, step: 0.5 },
  paperPaddingY: { min: 0, max: 20, step: 0.5 },
  headerDatesFontSize: { min: 4, max: 20, step: 0.5 },
  logoFontSize: { min: 10, max: 60, step: 1 },
  titleFontSize: { min: 6, max: 30, step: 0.5 },
  productNumberFontSize: { min: 6, max: 30, step: 0.5 },
  poAdjFontSize: { min: 4, max: 20, step: 0.5 },
  tableLabelFontSize: { min: 4, max: 20, step: 0.5 },
  tableValueFontSize: { min: 4, max: 20, step: 0.5 },
  tareNettoFontSize: { min: 4, max: 20, step: 0.5 },
  qrTagFontSize: { min: 4, max: 20, step: 0.5 },
  qrSize: { min: 20, max: 150, step: 5 },
};

/**
 * Konfigurasi ukuran kertas dan font untuk Print Label FOOM.
 * Disimpan di localStorage agar persisten antar sesi.
 */

/** Bump when default paper/orientation changes so stored presets can migrate. */
export const PRINT_LABEL_CONFIG_VERSION = 2;

export interface PrintLabelConfig {
  configVersion?: number;
  // === Ukuran Kertas (mm) ===
  /** Lebar area konten label (mm); landscape 78×100 → 100. */
  paperWidth: number;
  paperHeight: number;       // 0 = auto
  /** Ukuran fisik stiker (mm), sisi pendek × sisi panjang — untuk @page landscape. */
  paperMediaWidth: number;
  paperMediaHeight: number;
  paperLandscape: boolean;
  paperPaddingX: number;     // padding horizontal (mm)
  paperPaddingY: number;     // padding vertical (mm)

  // === Font Sizes (px) ===
  headerDatesFontSize: number;
  logoFontSize: number;
  titleFontSize: number;
  productNumberFontSize: number;
  tableLabelFontSize: number;
  tableValueFontSize: number;
  tareNettoFontSize: number;
  qrTagFontSize: number;

  // === QR Code ===
  qrSize: number;            // px
}

export const DEFAULT_CONFIG: PrintLabelConfig = {
  configVersion: PRINT_LABEL_CONFIG_VERSION,
  // Stiker 78 × 100 mm, cetak landscape (konten 100 × 78 mm)
  paperWidth: 100,
  paperHeight: 78,
  paperMediaWidth: 78,
  paperMediaHeight: 100,
  paperLandscape: true,
  paperPaddingX: 2.5,
  paperPaddingY: 2,

  headerDatesFontSize: 8,
  logoFontSize: 32,
  titleFontSize: 12,
  productNumberFontSize: 11,
  tableLabelFontSize: 7.5,
  tableValueFontSize: 8,
  tareNettoFontSize: 7.5,
  qrTagFontSize: 7.5,

  qrSize: 56,
};

const STORAGE_KEY = 'printLabelConfig';

const PAPER_FIELDS: (keyof PrintLabelConfig)[] = [
  'paperWidth',
  'paperHeight',
  'paperMediaWidth',
  'paperMediaHeight',
  'paperLandscape',
  'paperPaddingX',
  'paperPaddingY',
  'qrSize',
];

function migratePrintLabelConfig(
  parsed: Partial<PrintLabelConfig>,
): PrintLabelConfig {
  const merged = { ...DEFAULT_CONFIG, ...parsed };
  const version = parsed.configVersion ?? 0;
  if (version >= PRINT_LABEL_CONFIG_VERSION) {
    return { ...merged, configVersion: PRINT_LABEL_CONFIG_VERSION };
  }
  const next = { ...merged, configVersion: PRINT_LABEL_CONFIG_VERSION };
  for (const key of PAPER_FIELDS) {
    (next as PrintLabelConfig)[key] = DEFAULT_CONFIG[key] as never;
  }
  return next;
}

/** Nilai `size` untuk aturan CSS @page. */
export function formatPrintPageSize(cfg: PrintLabelConfig): string {
  if (cfg.paperLandscape) {
    const w = cfg.paperMediaWidth;
    const h = cfg.paperMediaHeight;
    return `${w}mm ${h}mm landscape`;
  }
  if (cfg.paperHeight > 0) {
    return `${cfg.paperWidth}mm ${cfg.paperHeight}mm`;
  }
  return `${cfg.paperWidth}mm auto`;
}

/** Baca konfigurasi dari localStorage, fallback ke default */
export function loadPrintLabelConfig(): PrintLabelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<PrintLabelConfig>;
    const migrated = migratePrintLabelConfig(parsed);
    if ((parsed.configVersion ?? 0) < PRINT_LABEL_CONFIG_VERSION) {
      savePrintLabelConfig(migrated);
    }
    return migrated;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Simpan konfigurasi ke localStorage */
export function savePrintLabelConfig(config: PrintLabelConfig): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...config,
      configVersion: PRINT_LABEL_CONFIG_VERSION,
    }),
  );
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
  configVersion: 'Versi preset (internal)',
  paperWidth: 'Lebar area konten (mm)',
  paperHeight: 'Tinggi area konten (mm, 0 = auto)',
  paperMediaWidth: 'Lebar stiker fisik (mm)',
  paperMediaHeight: 'Tinggi stiker fisik (mm)',
  paperLandscape: 'Orientasi landscape',
  paperPaddingX: 'Padding Horizontal (mm)',
  paperPaddingY: 'Padding Vertical (mm)',
  headerDatesFontSize: 'Font Header Tanggal (px)',
  logoFontSize: 'Tinggi maks logo FOOM (px)',
  titleFontSize: 'Font Judul "Label Product Number" (px)',
  productNumberFontSize: 'Font Nomor Produk (px)',
  tableLabelFontSize: 'Font Label Tabel (px)',
  tableValueFontSize: 'Font Nilai Tabel (px)',
  tareNettoFontSize: 'Font Tare / Netto (px)',
  qrTagFontSize: 'Font Tag QR Code (px)',
  qrSize: 'Ukuran QR Code (px)',
};

/** Batas min-max untuk tiap field */
export const CONFIG_LIMITS: Partial<
  Record<keyof PrintLabelConfig, { min: number; max: number; step: number }>
> = {
  paperWidth: { min: 30, max: 210, step: 1 },
  paperHeight: { min: 0, max: 297, step: 1 },
  paperMediaWidth: { min: 30, max: 210, step: 1 },
  paperMediaHeight: { min: 30, max: 297, step: 1 },
  paperPaddingX: { min: 0, max: 20, step: 0.5 },
  paperPaddingY: { min: 0, max: 20, step: 0.5 },
  headerDatesFontSize: { min: 4, max: 20, step: 0.5 },
  logoFontSize: { min: 10, max: 60, step: 1 },
  titleFontSize: { min: 6, max: 30, step: 0.5 },
  productNumberFontSize: { min: 6, max: 30, step: 0.5 },
  tableLabelFontSize: { min: 4, max: 20, step: 0.5 },
  tableValueFontSize: { min: 4, max: 20, step: 0.5 },
  tareNettoFontSize: { min: 4, max: 20, step: 0.5 },
  qrTagFontSize: { min: 4, max: 20, step: 0.5 },
  qrSize: { min: 20, max: 150, step: 5 },
};

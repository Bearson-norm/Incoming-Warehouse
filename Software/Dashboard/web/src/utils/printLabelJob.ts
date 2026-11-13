import {
  buildPrintLabelDocumentHtml,
  printLabelInNewWindow,
} from '../components/PrintLabel';
import { loadPrintLabelConfig } from './printLabelConfig';
import { loadLabelPrinterSettings } from './printerSettings';

export type PrintJobReason =
  | 'offline'
  | 'unavailable'
  | 'paper_jam'
  | 'paper_out'
  | 'paper_problem'
  | 'door_open'
  | 'no_toner'
  | 'intervention'
  | 'error'
  | 'not_found'
  | 'timeout'
  | 'spooler'
  | 'no_printer'
  | 'blocked'
  | 'incomplete'
  | 'skipped';

export interface PrintJobResult {
  ok: boolean;
  via: 'silent' | 'dialog' | 'skipped';
  reason?: PrintJobReason;
  detail?: string;
}

const printedReadingIds = new Set<number>();
const inflightReadingIds = new Set<number>();

export function wasReadingPrinted(readingId: number): boolean {
  return printedReadingIds.has(readingId) || inflightReadingIds.has(readingId);
}

/** Returns false when this reading is already printing or already printed. */
export function beginReadingPrint(readingId: number): boolean {
  if (wasReadingPrinted(readingId)) return false;
  inflightReadingIds.add(readingId);
  return true;
}

export function finishReadingPrint(readingId: number, ok: boolean): void {
  inflightReadingIds.delete(readingId);
  if (ok) printedReadingIds.add(readingId);
}

export function markReadingPrinted(readingId: number): void {
  finishReadingPrint(readingId, true);
}

type ElectronPrinterApi = {
  printHtml: (payload: {
    html: string;
    deviceName: string;
    paperWidthMm?: number;
    paperHeightMm?: number;
    landscape?: boolean;
  }) => Promise<{ ok: boolean; reason?: string; detail?: string }>;
};

function electronPrinter(): ElectronPrinterApi | null {
  const printer = (window as { electron?: { printer?: ElectronPrinterApi } }).electron?.printer;
  return printer?.printHtml ? printer : null;
}

function asReason(value: string | undefined): PrintJobReason {
  const known: PrintJobReason[] = [
    'offline',
    'unavailable',
    'paper_jam',
    'paper_out',
    'paper_problem',
    'door_open',
    'no_toner',
    'intervention',
    'error',
    'not_found',
    'timeout',
    'spooler',
    'no_printer',
    'blocked',
    'incomplete',
    'skipped',
  ];
  return known.includes(value as PrintJobReason) ? (value as PrintJobReason) : 'spooler';
}

async function printSilent(html: string, deviceName: string): Promise<PrintJobResult> {
  const printer = electronPrinter();
  if (!printer) return { ok: false, via: 'skipped', reason: 'no_printer' };
  const cfg = loadPrintLabelConfig();
  const paperWidthMm = cfg.paperLandscape ? cfg.paperMediaWidth : cfg.paperWidth;
  const paperHeightMm = cfg.paperLandscape
    ? cfg.paperMediaHeight
    : cfg.paperHeight > 0
      ? cfg.paperHeight
      : cfg.paperWidth;
  const result = await printer.printHtml({
    html,
    deviceName,
    paperWidthMm,
    paperHeightMm,
    landscape: cfg.paperLandscape,
  });
  if (result.ok) return { ok: true, via: 'silent' };
  return {
    ok: false,
    via: 'silent',
    reason: asReason(result.reason),
    detail: result.detail,
  };
}

function printDialog(): PrintJobResult {
  if (!printLabelInNewWindow()) return { ok: false, via: 'dialog', reason: 'blocked' };
  return { ok: true, via: 'dialog' };
}

/**
 * Prints the label currently rendered in #print-label-area.
 * auto/test stay silent. Manual falls back to the system dialog when no
 * printer is selected or the saved name is gone.
 */
export async function printRenderedLabel(mode: 'auto' | 'manual' | 'test'): Promise<PrintJobResult> {
  const html = buildPrintLabelDocumentHtml();
  if (!html) return { ok: false, via: 'skipped', reason: 'incomplete' };

  const settings = loadLabelPrinterSettings();
  const canSilent = Boolean(electronPrinter() && settings.deviceName);

  if (mode === 'auto' && !settings.autoPrint) {
    return { ok: false, via: 'skipped', reason: 'skipped' };
  }
  if ((mode === 'auto' || mode === 'test') && !canSilent) {
    return { ok: false, via: 'skipped', reason: 'no_printer' };
  }
  if (!canSilent) return printDialog();

  const silent = await printSilent(html, settings.deviceName);
  if (mode === 'manual' && silent.reason === 'not_found') return printDialog();
  return silent;
}

export function formatPrintFailure(
  t: (key: string) => string,
  result: PrintJobResult,
  lpn?: string,
): string {
  const reason = result.reason || 'spooler';
  const key = reason === 'blocked' ? 'printBlocked' : `printFail_${reason}`;
  const translated = t(key);
  const message =
    reason === 'spooler' && result.detail
      ? result.detail
      : translated === key
        ? t('printFail_spooler')
        : translated;
  return lpn ? `${lpn}: ${message}` : message;
}

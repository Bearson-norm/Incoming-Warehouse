import { BrowserWindow, WebContents } from 'electron';

/** Windows PRINTER_STATUS bits that must not receive a label job. */
const STATUS_ERROR = 0x00000002;
const STATUS_PAPER_JAM = 0x00000008;
const STATUS_PAPER_OUT = 0x00000010;
const STATUS_PAPER_PROBLEM = 0x00000040;
const STATUS_OFFLINE = 0x00000080;
const STATUS_NOT_AVAILABLE = 0x00001000;
const STATUS_NO_TONER = 0x00040000;
const STATUS_USER_INTERVENTION = 0x00100000;
const STATUS_DOOR_OPEN = 0x00400000;

const LOAD_TIMEOUT_MS = 8000;
const PRINT_TIMEOUT_MS = 15000;
const MICRONS_PER_MM = 1000;

export type PrinterBlockReason =
  | 'offline'
  | 'unavailable'
  | 'paper_jam'
  | 'paper_out'
  | 'paper_problem'
  | 'door_open'
  | 'no_toner'
  | 'intervention'
  | 'error';

export interface ListedPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
  status: number;
  blocked: boolean;
  reason: PrinterBlockReason | null;
}

export interface LabelPrintRequest {
  html: string;
  deviceName: string;
  paperWidthMm?: number;
  paperHeightMm?: number;
  landscape?: boolean;
}

export interface LabelPrintResult {
  ok: boolean;
  reason?: PrinterBlockReason | 'not_found' | 'timeout' | 'spooler';
  detail?: string;
}

export function blockingPrinterReason(status: number | undefined): PrinterBlockReason | null {
  const bits = status ?? 0;
  if (bits & STATUS_OFFLINE) return 'offline';
  if (bits & STATUS_NOT_AVAILABLE) return 'unavailable';
  if (bits & STATUS_PAPER_JAM) return 'paper_jam';
  if (bits & STATUS_PAPER_OUT) return 'paper_out';
  if (bits & STATUS_PAPER_PROBLEM) return 'paper_problem';
  if (bits & STATUS_DOOR_OPEN) return 'door_open';
  if (bits & STATUS_NO_TONER) return 'no_toner';
  if (bits & STATUS_USER_INTERVENTION) return 'intervention';
  if (bits & STATUS_ERROR) return 'error';
  return null;
}

export async function listPrinters(contents: WebContents): Promise<ListedPrinter[]> {
  const printers = await contents.getPrintersAsync();
  return printers.map((printer) => {
    const reason = blockingPrinterReason(printer.status);
    return {
      name: printer.name,
      displayName: printer.displayName || printer.name,
      isDefault: Boolean(printer.isDefault),
      status: printer.status ?? 0,
      blocked: reason != null,
      reason,
    };
  });
}

let printChain: Promise<void> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = printChain.then(task, task);
  printChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function loadHtml(win: BrowserWindow, html: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
    win.webContents.once('did-finish-load', () => finish(true));
    win.webContents.once('did-fail-load', () => finish(false));
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    void win.loadURL(url).catch(() => finish(false));
  });
}

async function printLoadedWindow(
  win: BrowserWindow,
  request: LabelPrintRequest,
): Promise<LabelPrintResult> {
  const widthMm = request.paperWidthMm && request.paperWidthMm > 0 ? request.paperWidthMm : 78;
  const heightMm = request.paperHeightMm && request.paperHeightMm > 0 ? request.paperHeightMm : 100;
  const printed = await new Promise<{ ok: boolean; detail?: string }>((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, detail: 'timeout' }), PRINT_TIMEOUT_MS);
    win.webContents.print(
      {
        silent: true,
        deviceName: request.deviceName,
        printBackground: true,
        landscape: request.landscape === true,
        scaleFactor: 100,
        margins: {
          marginType: 'custom',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
        header: '',
        footer: '',
        pageSize: {
          width: Math.round(widthMm * MICRONS_PER_MM),
          height: Math.round(heightMm * MICRONS_PER_MM),
        },
      },
      (success, failureReason) => {
        clearTimeout(timer);
        resolve(
          success
            ? { ok: true }
            : { ok: false, detail: failureReason || 'spooler' },
        );
      },
    );
  });
  if (printed.ok) return { ok: true };
  if (printed.detail === 'timeout') return { ok: false, reason: 'timeout' };
  return { ok: false, reason: 'spooler', detail: printed.detail };
}

async function printHtmlNow(
  contents: WebContents,
  request: LabelPrintRequest,
): Promise<LabelPrintResult> {
  const deviceName = request.deviceName?.trim();
  if (!deviceName) return { ok: false, reason: 'not_found' };
  if (!request.html?.trim()) return { ok: false, reason: 'spooler', detail: 'empty label' };

  const printers = await listPrinters(contents);
  const match = printers.find((printer) => printer.name === deviceName);
  if (!match) return { ok: false, reason: 'not_found' };
  if (match.reason) return { ok: false, reason: match.reason };

  const mediaWidthMm = request.paperWidthMm && request.paperWidthMm > 0 ? request.paperWidthMm : 78;
  const mediaHeightMm = request.paperHeightMm && request.paperHeightMm > 0 ? request.paperHeightMm : 100;
  const contentWidthMm = request.landscape === true ? mediaHeightMm : mediaWidthMm;
  const contentHeightMm = request.landscape === true ? mediaWidthMm : mediaHeightMm;
  const cssPx = (mm: number) => Math.ceil((mm / 25.4) * 96);
  const win = new BrowserWindow({
    show: false,
    width: cssPx(contentWidthMm) + 32,
    height: cssPx(contentHeightMm) + 32,
    useContentSize: true,
    skipTaskbar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    const loaded = await loadHtml(win, request.html);
    if (!loaded) return { ok: false, reason: 'timeout' };
    await win.webContents
      .executeJavaScript(
        `Promise.all(Array.from(document.images).map((img) => img.complete && img.naturalWidth > 0 ? Promise.resolve(true) : new Promise((resolve) => { img.addEventListener('load', () => resolve(true), { once: true }); img.addEventListener('error', () => resolve(false), { once: true }); })))`,
        true,
      )
      .catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return await printLoadedWindow(win, { ...request, deviceName });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

export function printHtmlQueued(
  contents: WebContents,
  request: LabelPrintRequest,
): Promise<LabelPrintResult> {
  return enqueue(() => printHtmlNow(contents, request));
}

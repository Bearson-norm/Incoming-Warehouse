const STORAGE_KEY = 'labelPrinterSettings';

export interface LabelPrinterSettings {
  deviceName: string;
  autoPrint: boolean;
}

const DEFAULT_SETTINGS: LabelPrinterSettings = {
  deviceName: '',
  autoPrint: false,
};

export function loadLabelPrinterSettings(): LabelPrinterSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<LabelPrinterSettings>;
    return {
      deviceName: typeof parsed.deviceName === 'string' ? parsed.deviceName : '',
      autoPrint: parsed.autoPrint === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveLabelPrinterSettings(settings: LabelPrinterSettings): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      deviceName: settings.deviceName,
      autoPrint: settings.autoPrint,
    }),
  );
}

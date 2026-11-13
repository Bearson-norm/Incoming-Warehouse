export type IncomingOdooProcess = 'inbound' | 'qc_sample' | 'production';

export interface IncomingOdooMeta {
  weighingType: IncomingOdooProcess;
  qcRecord: string | null;
  /** Grams. Legacy sampleTareKg in the JSON is converted on read. */
  sampleTareG: number | null;
}

export function readIncomingOdooMeta(meta: unknown): IncomingOdooMeta {
  const record = asRecord(meta);
  const raw = record?.odooWeighingType;
  const weighingType: IncomingOdooProcess =
    raw === 'qc_sample' || raw === 'production' || raw === 'inbound'
      ? raw
      : 'inbound';
  const rawQc =
    typeof record?.qcRecord === 'string'
      ? record.qcRecord
      : typeof record?.qcReference === 'string'
        ? record.qcReference
        : typeof record?.qc_reference === 'string'
          ? record.qc_reference
          : '';
  const qcRecord = rawQc.trim();
  const sampleTareG = readSampleTareG(record);
  return {
    weighingType,
    qcRecord: qcRecord || null,
    sampleTareG,
  };
}

function readSampleTareG(
  record: Record<string, unknown> | null,
): number | null {
  const grams = readTare(record?.sampleTareG);
  if (grams != null) return grams;
  const legacyKg = readTare(record?.sampleTareKg);
  if (legacyKg == null) return null;
  return legacyKg * 1000;
}

function asRecord(meta: unknown): Record<string, unknown> | null {
  if (!meta) return null;
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return null;
}

function readTare(value: unknown): number | null {
  const tare =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : null;
  if (tare == null || !Number.isFinite(tare)) return null;
  return tare;
}

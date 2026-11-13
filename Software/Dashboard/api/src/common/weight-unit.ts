/** Stored and displayed weights are grams. Legacy kilograms are scaled once. */
export function toGrams(weight: number, unit: string | null | undefined): number {
  const u = (unit || 'g').trim().toLowerCase();
  if (u === 'kg') return weight * 1000;
  if (u === 'lb') return weight * 453.59237;
  return weight;
}

/** Match scale precision of 0.1 g. */
export function roundGrams(value: number): number {
  return Math.round(Number((value * 10).toFixed(8))) / 10;
}

/**
 * Rewrite legacy sampleTareKg (kilograms) to sampleTareG.
 * Leaves metadata unchanged when it is already in grams or not JSON.
 */
export function labelMetadataToGrams(
  raw: string | null | undefined,
): string | null | undefined {
  if (raw == null || raw === '') return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return raw;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.sampleTareG === 'number') {
      delete record.sampleTareKg;
      return JSON.stringify(record);
    }
    if (
      typeof record.sampleTareKg === 'number' &&
      Number.isFinite(record.sampleTareKg)
    ) {
      record.sampleTareG = record.sampleTareKg * 1000;
      delete record.sampleTareKg;
      return JSON.stringify(record);
    }
    return raw;
  } catch {
    return raw;
  }
}

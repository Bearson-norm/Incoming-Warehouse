/**
 * Client-side mirror of API incoming LPN compose (preview only; server is authoritative).
 * See Software/Dashboard/docs/incoming-lpn-format.md
 */

export const INCOMING_LPN_MAX_LENGTH = 64;

export function normalizeIncomingReference(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeIncomingBatch(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function normalizeIncomingRmCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function incomingLpnSequenceSuffixLength(n: number): number {
  if (!Number.isInteger(n) || n < 1) return 0;
  return 1 + String(n).length;
}

export function appendIncomingLpnSequence(
  baseLpn: string,
  n: number,
): string | null {
  const base = baseLpn.trim().toUpperCase();
  if (!base || !Number.isInteger(n) || n < 1) return null;
  const lpn = `${base}-${n}`;
  if (lpn.length > INCOMING_LPN_MAX_LENGTH) return null;
  return lpn;
}

export function composeIncomingLpnPreview(parts: {
  reference: string;
  rmCode: string;
  batch: string;
  reservedSuffixLength?: number;
}): string | null {
  const reference = normalizeIncomingReference(parts.reference);
  const batch = normalizeIncomingBatch(parts.batch);
  const rmCode = normalizeIncomingRmCode(parts.rmCode);
  if (!reference || !batch || !rmCode) {
    return null;
  }
  const reserved = Math.max(0, parts.reservedSuffixLength ?? 0);
  const maxLen = INCOMING_LPN_MAX_LENGTH - reserved;
  if (maxLen < 5) return null;

  let ref = reference;
  let bat = batch;
  let lpn = `${ref}-${rmCode}-${bat}`;
  if (lpn.length > maxLen) {
    const fixedLen = rmCode.length + 2;
    let budget = maxLen - fixedLen;
    if (budget < 2) return null;
    const refLen = Math.max(1, Math.min(ref.length, Math.floor(budget / 2)));
    const batchLen = Math.max(1, budget - refLen - 1);
    ref = ref.slice(0, refLen);
    bat = bat.slice(0, batchLen);
    lpn = `${ref}-${rmCode}-${bat}`;
  }
  if (lpn.length > maxLen) return null;
  return lpn.toUpperCase();
}

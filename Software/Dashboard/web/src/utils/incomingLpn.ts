/**
 * Client-side mirror of API incoming LPN compose (preview only; server is authoritative).
 * See Software/Dashboard/docs/incoming-lpn-format.md
 */

export const INCOMING_LPN_MAX_LENGTH = 64;

export function previewIncomingUniqueSegment(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const short = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  const year = new Date().getFullYear();
  return `${short}${year}`;
}

export function normalizeIncomingReference(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeIncomingBatch(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function normalizeIncomingRmCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function composeIncomingLpnPreview(parts: {
  uniqueSegment: string;
  reference: string;
  rmCode: string;
  batch: string;
}): string | null {
  const reference = normalizeIncomingReference(parts.reference);
  const batch = normalizeIncomingBatch(parts.batch);
  const rmCode = normalizeIncomingRmCode(parts.rmCode);
  const uniqueSegment = parts.uniqueSegment.trim().toUpperCase();
  if (!uniqueSegment || !reference || !batch || !rmCode) {
    return null;
  }
  let lpn = `${uniqueSegment}-${reference}-${rmCode}-${batch}`;
  if (lpn.length > INCOMING_LPN_MAX_LENGTH) {
    const fixedLen = uniqueSegment.length + rmCode.length + 3;
    let budget = INCOMING_LPN_MAX_LENGTH - fixedLen;
    if (budget < 2) return null;
    const refLen = Math.max(1, Math.min(reference.length, Math.floor(budget / 2)));
    const batchLen = Math.max(1, budget - refLen - 1);
    lpn = `${uniqueSegment}-${reference.slice(0, refLen)}-${rmCode}-${batch.slice(0, batchLen)}`;
  }
  return lpn.toUpperCase();
}

import { BadRequestException } from '@nestjs/common';

export const INCOMING_LPN_MAX_LENGTH = 64;
const SEGMENT_REGEX = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;

export type IncomingLpnParts = {
  reference: string;
  rmCode: string;
  batch: string;
};

export type ComposeIncomingLpnOptions = {
  /** Reserve trailing characters (e.g. `-30`) so batch suffixes still fit in 64. */
  reservedSuffixLength?: number;
};

export function normalizeIncomingReference(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeIncomingBatch(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function normalizeIncomingRmCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function assertSegment(name: string, value: string): void {
  if (!value) {
    throw new BadRequestException(`LPN segment ${name} is required`);
  }
  if (!SEGMENT_REGEX.test(value)) {
    throw new BadRequestException(
      `LPN segment ${name} contains invalid characters`,
    );
  }
}

function truncateSegment(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen);
}

/** Characters needed for `-${n}` (hyphen + digits). */
export function incomingLpnSequenceSuffixLength(n: number): number {
  if (!Number.isInteger(n) || n < 1) {
    throw new BadRequestException('LPN sequence must be a positive integer');
  }
  return 1 + String(n).length;
}

/** Append 1-based arrival sequence: `base-n`. */
export function appendIncomingLpnSequence(baseLpn: string, n: number): string {
  const base = baseLpn.trim().toUpperCase();
  if (!base) {
    throw new BadRequestException('Base LPN is required');
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new BadRequestException('LPN sequence must be a positive integer');
  }
  const lpn = `${base}-${n}`;
  if (lpn.length > INCOMING_LPN_MAX_LENGTH) {
    throw new BadRequestException('Composed LPN exceeds maximum length');
  }
  return lpn;
}

/**
 * Builds incoming internal LPN `{Reference}-{RmCode}-{Batch}`.
 * Truncates batch then reference if over max length (minus reservedSuffixLength).
 */
export function composeIncomingLpn(
  parts: IncomingLpnParts,
  options: ComposeIncomingLpnOptions = {},
): string {
  let reference = normalizeIncomingReference(parts.reference);
  let batch = normalizeIncomingBatch(parts.batch);
  const rmCode = normalizeIncomingRmCode(parts.rmCode);
  const reserved = Math.max(0, options.reservedSuffixLength ?? 0);

  assertSegment('rmCode', rmCode);
  if (!reference) {
    throw new BadRequestException('Reference is required for LPN');
  }
  if (!batch) {
    throw new BadRequestException('Batch is required for LPN');
  }
  assertSegment('reference', reference);
  assertSegment('batch', batch);

  const maxLen = INCOMING_LPN_MAX_LENGTH - reserved;
  if (maxLen < 5) {
    throw new BadRequestException('LPN segments are too long to fit');
  }

  const build = () => `${reference}-${rmCode}-${batch}`.toUpperCase();

  let lpn = build();
  if (lpn.length <= maxLen) {
    return lpn;
  }

  const fixedLen = rmCode.length + 2; /* two hyphens */
  let budget = maxLen - fixedLen;
  if (budget < 2) {
    throw new BadRequestException('LPN segments are too long to fit');
  }

  const refLen = Math.max(1, Math.min(reference.length, Math.floor(budget / 2)));
  const batchLen = Math.max(1, budget - refLen - 1);
  reference = truncateSegment(reference, refLen);
  batch = truncateSegment(batch, batchLen);
  lpn = build();

  if (lpn.length > maxLen) {
    throw new BadRequestException('Composed LPN exceeds maximum length');
  }
  return lpn;
}

export function buildIncomingLpnFromInputs(args: {
  reference: string;
  rmCode: string;
  batch: string;
  reservedSuffixLength?: number;
}): { lpn: string } {
  const lpn = composeIncomingLpn(
    {
      reference: args.reference,
      rmCode: args.rmCode,
      batch: args.batch,
    },
    { reservedSuffixLength: args.reservedSuffixLength },
  );
  return { lpn };
}

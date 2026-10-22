import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export const INCOMING_LPN_MAX_LENGTH = 64;
const SEGMENT_REGEX = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;
const LPN_TIMEZONE = 'Asia/Jakarta';

export type IncomingLpnParts = {
  uniqueSegment: string;
  reference: string;
  rmCode: string;
  batch: string;
};

function yearInTimezone(tz: string, at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
  }).formatToParts(at);
  const year = parts.find((p) => p.type === 'year')?.value;
  if (!year) {
    return String(at.getUTCFullYear());
  }
  return year;
}

/** 4 hex chars + 4-digit calendar year (e.g. A3F72026). */
export function generateIncomingUniqueSegment(at = new Date()): string {
  const short = randomBytes(2).toString('hex').toUpperCase();
  const year = yearInTimezone(LPN_TIMEZONE, at);
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

/**
 * Builds incoming internal LPN; truncates batch then reference if over max length.
 */
export function composeIncomingLpn(parts: IncomingLpnParts): string {
  const uniqueSegment = parts.uniqueSegment.trim().toUpperCase();
  let reference = normalizeIncomingReference(parts.reference);
  let batch = normalizeIncomingBatch(parts.batch);
  const rmCode = normalizeIncomingRmCode(parts.rmCode);

  assertSegment('unique', uniqueSegment);
  assertSegment('rmCode', rmCode);
  if (!reference) {
    throw new BadRequestException('Reference is required for LPN');
  }
  if (!batch) {
    throw new BadRequestException('Batch is required for LPN');
  }
  assertSegment('reference', reference);
  assertSegment('batch', batch);

  const build = () =>
    `${uniqueSegment}-${reference}-${rmCode}-${batch}`.toUpperCase();

  let lpn = build();
  if (lpn.length <= INCOMING_LPN_MAX_LENGTH) {
    return lpn;
  }

  const fixedLen =
    uniqueSegment.length + rmCode.length + 3; /* three hyphens */
  let budget = INCOMING_LPN_MAX_LENGTH - fixedLen;
  if (budget < 2) {
    throw new BadRequestException('LPN segments are too long to fit');
  }

  const refLen = Math.max(1, Math.min(reference.length, Math.floor(budget / 2)));
  const batchLen = Math.max(1, budget - refLen - 1);
  reference = truncateSegment(reference, refLen);
  batch = truncateSegment(batch, batchLen);
  lpn = build();

  if (lpn.length > INCOMING_LPN_MAX_LENGTH) {
    throw new BadRequestException('Composed LPN exceeds maximum length');
  }
  return lpn;
}

export function buildIncomingLpnFromInputs(args: {
  reference: string;
  rmCode: string;
  batch: string;
  at?: Date;
}): { lpn: string; uniqueSegment: string } {
  const uniqueSegment = generateIncomingUniqueSegment(args.at);
  const lpn = composeIncomingLpn({
    uniqueSegment,
    reference: args.reference,
    rmCode: args.rmCode,
    batch: args.batch,
  });
  return { lpn, uniqueSegment };
}

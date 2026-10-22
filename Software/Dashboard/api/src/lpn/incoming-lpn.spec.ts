import {
  composeIncomingLpn,
  generateIncomingUniqueSegment,
  normalizeIncomingBatch,
  normalizeIncomingReference,
  INCOMING_LPN_MAX_LENGTH,
} from './incoming-lpn';

describe('incoming-lpn', () => {
  it('generateIncomingUniqueSegment appends 4-digit year', () => {
    const seg = generateIncomingUniqueSegment(new Date('2026-03-15T12:00:00Z'));
    expect(seg).toMatch(/^[0-9A-F]{4}2026$/);
  });

  it('composeIncomingLpn joins segments with hyphens', () => {
    const lpn = composeIncomingLpn({
      uniqueSegment: 'ABCD2026',
      reference: 'WRMPM/IN/13010',
      rmCode: 'PMSTK00297',
      batch: '11469',
    });
    expect(lpn).toBe('ABCD2026-WRMPM/IN/13010-PMSTK00297-11469');
  });

  it('normalizes batch spaces and case', () => {
    expect(normalizeIncomingBatch('  ab 12 ')).toBe('AB12');
    expect(normalizeIncomingReference(' ref ')).toBe('REF');
  });

  it('truncates when composed LPN exceeds max length', () => {
    const lpn = composeIncomingLpn({
      uniqueSegment: 'ABCD2026',
      reference: 'R'.repeat(40),
      rmCode: 'SKU1',
      batch: 'B'.repeat(40),
    });
    expect(lpn.length).toBeLessThanOrEqual(INCOMING_LPN_MAX_LENGTH);
    expect(lpn.startsWith('ABCD2026-')).toBe(true);
  });
});

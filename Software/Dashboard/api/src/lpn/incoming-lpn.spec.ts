import {
  appendIncomingLpnSequence,
  composeIncomingLpn,
  incomingLpnSequenceSuffixLength,
  normalizeIncomingBatch,
  normalizeIncomingReference,
  INCOMING_LPN_MAX_LENGTH,
} from './incoming-lpn';

describe('incoming-lpn', () => {
  it('composeIncomingLpn joins reference, RM, and batch', () => {
    const lpn = composeIncomingLpn({
      reference: 'WRMPM/IN/13010',
      rmCode: 'PMSTK00297',
      batch: '11469',
    });
    expect(lpn).toBe('WRMPM/IN/13010-PMSTK00297-11469');
  });

  it('normalizes batch spaces and case', () => {
    expect(normalizeIncomingBatch('  ab 12 ')).toBe('AB12');
    expect(normalizeIncomingReference(' ref ')).toBe('REF');
  });

  it('truncates when composed LPN exceeds max length', () => {
    const lpn = composeIncomingLpn({
      reference: 'R'.repeat(40),
      rmCode: 'SKU1',
      batch: 'B'.repeat(40),
    });
    expect(lpn.length).toBeLessThanOrEqual(INCOMING_LPN_MAX_LENGTH);
    expect(lpn.includes('-SKU1-')).toBe(true);
  });

  it('reserves space for batch sequence suffixes', () => {
    const reserved = incomingLpnSequenceSuffixLength(30);
    expect(reserved).toBe(3);
    const base = composeIncomingLpn(
      {
        reference: 'R'.repeat(40),
        rmCode: 'SKU1',
        batch: 'B'.repeat(40),
      },
      { reservedSuffixLength: reserved },
    );
    const withSuffix = appendIncomingLpnSequence(base, 30);
    expect(withSuffix.length).toBeLessThanOrEqual(INCOMING_LPN_MAX_LENGTH);
    expect(withSuffix.endsWith('-30')).toBe(true);
  });

  it('appendIncomingLpnSequence adds 1-based suffix', () => {
    expect(
      appendIncomingLpnSequence('WRMPM/IN/13010-PMSTK00297-11469', 1),
    ).toBe('WRMPM/IN/13010-PMSTK00297-11469-1');
    expect(
      appendIncomingLpnSequence('WRMPM/IN/13010-PMSTK00297-11469', 4),
    ).toBe('WRMPM/IN/13010-PMSTK00297-11469-4');
  });
});

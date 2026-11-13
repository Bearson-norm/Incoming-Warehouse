import { groupReadingsByPo, poNumberFromLabelMetadata } from './po-groups';

describe('po groups', () => {
  it('reads poNumber and falls back to poAdj', () => {
    expect(poNumberFromLabelMetadata(JSON.stringify({ poNumber: ' PO-1 ' }))).toBe('PO-1');
    expect(poNumberFromLabelMetadata(JSON.stringify({ poAdj: 'PO-OLD' }))).toBe('PO-OLD');
    expect(poNumberFromLabelMetadata('')).toBe('');
    expect(poNumberFromLabelMetadata('not-json')).toBe('');
  });

  it('orders groups and rows by newest capturedAt', () => {
    const rows = [
      { id: 1, capturedAt: '2026-11-01T00:00:00.000Z', labelMetadata: JSON.stringify({ poNumber: 'PO-A' }) },
      { id: 2, capturedAt: '2026-11-04T00:00:00.000Z', labelMetadata: JSON.stringify({ poNumber: 'PO-B' }) },
      { id: 3, capturedAt: '2026-11-03T00:00:00.000Z', labelMetadata: JSON.stringify({ poNumber: 'PO-A' }) },
      { id: 4, capturedAt: '2026-11-02T00:00:00.000Z', labelMetadata: null },
    ];
    const groups = groupReadingsByPo(rows, (row) => row.labelMetadata);
    expect(groups.map((group) => group.poNumber)).toEqual(['PO-B', 'PO-A', '']);
    expect(groups[1].items.map((item) => item.id)).toEqual([3, 1]);
    expect(groups[1].latestIncomingAt).toBe('2026-11-03T00:00:00.000Z');
    expect(groups[1].count).toBe(2);
  });
});

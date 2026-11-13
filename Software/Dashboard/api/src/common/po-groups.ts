export const PO_GROUP_FETCH_CAP = 1000;

export interface PoGroup<T> {
  poNumber: string;
  latestIncomingAt: string;
  count: number;
  items: T[];
}

export function poNumberFromLabelMetadata(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '';
  try {
    const meta = JSON.parse(raw) as { poNumber?: unknown; poAdj?: unknown };
    if (typeof meta.poNumber === 'string' && meta.poNumber.trim()) {
      return meta.poNumber.trim();
    }
    if (typeof meta.poAdj === 'string' && meta.poAdj.trim()) {
      return meta.poAdj.trim();
    }
    return '';
  } catch {
    return '';
  }
}

function timestamp(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

/** Groups rows by PO. Empty PO stays an empty string for the client to label. */
export function groupReadingsByPo<T extends { capturedAt: Date | string }>(
  rows: T[],
  metadataOf: (row: T) => unknown,
): PoGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const poNumber = poNumberFromLabelMetadata(metadataOf(row));
    const items = buckets.get(poNumber);
    if (items) items.push(row);
    else buckets.set(poNumber, [row]);
  }

  const groups: PoGroup<T>[] = [];
  for (const [poNumber, items] of buckets) {
    items.sort((a, b) => timestamp(b.capturedAt) - timestamp(a.capturedAt));
    groups.push({
      poNumber,
      latestIncomingAt: toIso(items[0].capturedAt),
      count: items.length,
      items,
    });
  }
  groups.sort((a, b) => timestamp(b.latestIncomingAt) - timestamp(a.latestIncomingAt));
  return groups;
}

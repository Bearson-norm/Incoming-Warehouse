const LPN_REGEX = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;

export type PackageUidParse =
  | { kind: 'empty' }
  | { kind: 'ok'; uid: string }
  | { kind: 'reject'; message: string };

/** Reads a plain LPN or a label QR. SKU and batch QR codes are rejected. */
export function parsePackageUidInput(
  raw: string | null | undefined,
): PackageUidParse {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return { kind: 'empty' };
  }

  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { kind: 'reject', message: 'QR LPN tidak valid.' };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { kind: 'reject', message: 'QR LPN tidak valid.' };
    }
    const record = data as { type?: unknown; uid?: unknown };
    const type = String(record.type ?? '')
      .trim()
      .toLowerCase();
    if (type !== 'lpn') {
      return {
        kind: 'reject',
        message: 'QR ini bukan LPN. Scan QR LPN pada label.',
      };
    }
    const uid = String(record.uid ?? '')
      .trim()
      .toUpperCase();
    if (!uid || uid.length > 64 || !LPN_REGEX.test(uid)) {
      return { kind: 'reject', message: 'QR LPN tidak berisi uid yang valid.' };
    }
    return { kind: 'ok', uid };
  }

  return { kind: 'ok', uid: trimmed.toUpperCase() };
}

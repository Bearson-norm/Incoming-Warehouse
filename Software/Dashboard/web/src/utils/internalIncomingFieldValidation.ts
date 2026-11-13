/**
 * Validasi field wajib incoming metode internal (konfirmasi config, edit dokumen, cetak).
 */
export type InternalIncomingFields = {
  referenceOdoo: string;
  poNumber: string;
  batch: string;
  arrivalAt: string;
  expiredDate: string;
  vendorName?: string;
  skuName?: string;
  /** Jika true, LPN harus sudah ada (mis. sebelum cetak). */
  requireLpn?: boolean;
  lpn?: string;
};

export function getInternalIncomingFieldsError(
  fields: InternalIncomingFields,
): string | null {
  if (!fields.referenceOdoo?.trim()) {
    return 'printNeedsReferenceOdoo';
  }
  if (!fields.poNumber?.trim()) {
    return 'printNeedsPo';
  }
  const batch = fields.batch?.trim();
  if (!batch || batch === '-' || batch === 'N/A') {
    return 'printNeedsBatch';
  }
  if (!fields.vendorName?.trim()) {
    return 'printNeedsVendor';
  }
  if (!fields.skuName?.trim()) {
    return 'printNeedsSku';
  }
  const arrivalAt = fields.arrivalAt?.trim();
  if (!arrivalAt || Number.isNaN(new Date(arrivalAt).getTime())) {
    return 'printNeedsArrivalDate';
  }
  const expiredDate = fields.expiredDate?.trim();
  if (!expiredDate || Number.isNaN(new Date(expiredDate).getTime())) {
    return 'printNeedsExpiredDate';
  }
  if (fields.requireLpn) {
    const lpn = fields.lpn?.trim();
    if (!lpn || lpn === '-' || lpn === 'LPN-N/A' || lpn === 'N/A') {
      return 'printNeedsLpn';
    }
  }
  return null;
}

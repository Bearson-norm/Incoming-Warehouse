import { PrintLabelData } from '../components/PrintLabel';

export function getPrintValidationError(data: PrintLabelData | null): string | null {
  if (!data) {
    return 'printIncomplete';
  }
  const lpn = data.labelProductNumber?.trim();
  if (!lpn || lpn === '-' || lpn === 'LPN-N/A' || lpn === 'N/A') {
    return 'printNeedsLpn';
  }
  const batch = data.batch?.trim();
  if (!batch || batch === '-' || batch === 'BATCH-N/A' || batch === 'N/A') {
    return 'printNeedsBatch';
  }
  if (!data.vendorName?.trim()) {
    return 'printNeedsVendor';
  }
  if (!data.skuName?.trim()) {
    return 'printNeedsSku';
  }
  if (!data.referenceOdoo?.trim()) {
    return 'printNeedsReferenceOdoo';
  }
  const arrivalAt = data.arrivalAt?.trim();
  if (!arrivalAt || Number.isNaN(new Date(arrivalAt).getTime())) {
    return 'printNeedsArrivalDate';
  }
  const expiredDate = data.expiredDate?.trim();
  if (!expiredDate) {
    return 'printNeedsExpiredDate';
  }
  const parsed = new Date(expiredDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'printNeedsExpiredDate';
  }
  return null;
}

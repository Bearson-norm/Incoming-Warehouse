import { PrintLabelData } from '../components/PrintLabel';

export function getPrintValidationError(data: PrintLabelData | null): string | null {
  if (!data) {
    return 'printIncomplete';
  }
  const lpn = data.labelProductNumber?.trim();
  if (!lpn || lpn === '-' || lpn === 'LPN-N/A' || lpn === 'N/A') {
    return 'printNeedsLpn';
  }
  const incoming = data.dateIncoming?.trim();
  if (!incoming) {
    return 'printNeedsIncomingDate';
  }
  const parsed = new Date(incoming);
  if (Number.isNaN(parsed.getTime())) {
    return 'printNeedsIncomingDate';
  }
  return null;
}

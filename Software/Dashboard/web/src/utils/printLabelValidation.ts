import { PrintLabelData } from '../components/PrintLabel';
import { getInternalIncomingFieldsError } from './internalIncomingFieldValidation';

export interface PrintLabelDataWithPo extends PrintLabelData {
  poNumber?: string;
}

export function getPrintValidationError(
  data: PrintLabelDataWithPo | null,
): string | null {
  if (!data) {
    return 'printIncomplete';
  }
  return getInternalIncomingFieldsError({
    referenceOdoo: data.referenceOdoo,
    poNumber: data.poNumber ?? '',
    batch: data.batch,
    arrivalAt: data.arrivalAt ?? '',
    expiredDate: data.expiredDate,
    vendorName: data.vendorName,
    skuName: data.skuName,
    requireLpn: true,
    lpn: data.labelProductNumber,
  });
}

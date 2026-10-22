/** Disimpan di WeighSession.labelMetadata (legacy cetak label). */
export interface SessionLabelMetadata {
  packageUid?: string;
  referenceOdoo?: string;
  vendorName?: string;
  poAdj?: string;
  namaRmPm?: string;
  skuName?: string;
  batch?: string;
  labelProductNumber?: string;
  arrivalAt?: string;
  expiredDate?: string;
  /** Legacy key, read-only compatibility for records created before expiredDate. */
  dateIncoming?: string;
  /** First LPN segment (short token + YYYY), set by server for internal incoming. */
  lpnUniqueSegment?: string;
}

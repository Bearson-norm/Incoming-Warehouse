/** Disimpan di WeighSession.labelMetadata (legacy cetak label). */
export interface SessionLabelMetadata {
  packageUid?: string;
  referenceOdoo?: string;
  /** Nomor PO (internal incoming). */
  poNumber?: string;
  vendorName?: string;
  /** @deprecated use poNumber */
  poAdj?: string;
  namaRmPm?: string;
  skuName?: string;
  batch?: string;
  labelProductNumber?: string;
  arrivalAt?: string;
  expiredDate?: string;
  /** Legacy key, read-only compatibility for records created before expiredDate. */
  dateIncoming?: string;
  /** Legacy unique LPN prefix; not set for new internal LPNs. */
  lpnUniqueSegment?: string;
  /** Incoming Odoo process: inbound | qc_sample | production */
  odooWeighingType?: string;
  qcRecord?: string;
  /** Incoming Odoo QC sample tare, in grams. */
  sampleTareG?: number;
  /** @deprecated kilograms; read-only compatibility before the gram migration. */
  sampleTareKg?: number;
}

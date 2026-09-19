export interface Packaging {
  id: string;
  type: string;
  tareWeight: number;
}

export interface Vendor {
  id: string;
  name: string;
  packagings: Packaging[];
}

export interface WeighingRecord {
  id: string;
  date: string;
  time: string;
  vendorName: string;
  packagingType: string;
  tare: number;
  gross: number;
  net: number;
  referenceOdoo: string;
  batch: string;
  labelProductNumber: string;
}

export interface RecordingConfig {
  vendor: Vendor;
  packaging: Packaging;
  referenceOdoo: string;
  batch: string;
  labelProductNumber: string;
}

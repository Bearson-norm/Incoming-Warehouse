export type WeighingMethod = 'odoo' | 'internal';
export type FlowType = 'incoming' | 'intrans';

export interface RmCode {
  id: number;
  code: string;
  name?: string | null;
}

export interface Vendor {
  id: number;
  name: string;
  packagings?: Packaging[];
}

export interface Packaging {
  id: number;
  vendorId: number;
  name: string;
  tareWeight: number | null;
}

export interface CloudScale {
  id: number;
  name: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CloudWeighReading {
  id: number;
  scaleId: number;
  scaleName: string;
  username: string;
  stationId?: string | null;
  localReadingId?: number | null;
  packageUid?: string | null;
  flowType: FlowType;
  weighingMethod: WeighingMethod;
  weight: number;
  grossWeight?: number | null;
  tareWeight?: number | null;
  netWeight?: number | null;
  unit: string;
  weightStatus?: string | null;
  capturedAt: string;
  syncedAt?: string;
}

export interface CloudStatus {
  serverUrl?: string;
  hasSyncApiKey?: boolean;
  stationId?: string;
  configured?: boolean;
  online?: boolean;
  mode?: string;
  activeScales?: number;
  totalReadings?: number;
  error?: string;
}

export interface WeighSession {
  id: number;
  packageUid?: string | null;
  scaleId?: number | null;
  scaleName?: string | null;
  weighingStarted?: boolean;
  weighingMethod?: WeighingMethod;
  flowType?: FlowType;
  vendorId?: number | null;
  packagingId?: number | null;
  rmCodeId?: number | null;
  labelMetadata?: string | null;
  vendor?: Vendor | null;
  packaging?: Packaging | null;
  rmCode?: RmCode | null;
}

export interface ConfirmResult {
  success: boolean;
  readingId: number;
  packageUid: string;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number | null;
  weightStatus: string | null;
  message?: string | null;
  logId?: number | null;
  packageId?: number | null;
  weighingMethod?: WeighingMethod;
  flowType?: FlowType;
  syncedToOdoo?: boolean;
}

export interface Reading {
  id: number;
  weight: number;
  unit: string;
  stable: boolean;
  capturedAt: string;
  packageUid?: string | null;
  grossWeight?: number | null;
  tareWeight?: number | null;
  netWeight?: number | null;
  weightStatus?: string | null;
  odooLogId?: number | null;
  odooMessage?: string | null;
  session: {
    id: number;
    packageUid?: string | null;
    weighingMethod?: WeighingMethod;
    flowType?: FlowType;
    labelMetadata?: string | null;
    vendor?: { id: number; name: string } | null;
    packaging?: { id: number; name: string; tareWeight: number | null } | null;
    rmCode?: RmCode | null;
    user: { username: string };
  };
}

export function parseLabelMetadata(raw?: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function readingLpn(reading: Reading): string {
  return reading.packageUid || reading.session.packageUid || '';
}

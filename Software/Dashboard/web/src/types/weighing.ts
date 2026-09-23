export type WeighingMethod = "odoo" | "internal";
export type FlowType = "incoming" | "intrans";

export interface RmCode {
  id: number;
  cloudId: string;
  code: string;
  name?: string | null;
  issuedAt: string;
  revision: number;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: number;
  cloudId: string;
  name: string;
  revision: number;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  packagings?: Packaging[];
}

export interface Packaging {
  id: number;
  cloudId: string;
  vendorId: number;
  vendorCloudId?: string;
  name: string;
  tareWeight: number | null;
  metadata?: string | null;
  revision: number;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
  localSessionId?: number | null;
  deviceId?: string | null;
  gatewayId?: string | null;
  packageUid?: string | null;
  vendorCloudId?: string | null;
  vendorSnapshot?: string | null;
  currentVendorName?: string | null;
  packagingCloudId?: string | null;
  packagingSnapshot?: string | null;
  currentPackagingName?: string | null;
  rmCodeCloudId?: string | null;
  rmCodeSnapshot?: string | null;
  currentRmName?: string | null;
  labelMetadata?: string | null;
  odooLogId?: number | null;
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

export type MasterEntityType = "vendor" | "packaging" | "rmCode";

export interface CloudMasterSnapshot {
  vendors: Vendor[];
  packagings: Packaging[];
  rmCodes: RmCode[];
  cursor: string;
  generatedAt: string;
}

export interface MasterDataAuditEvent {
  id: string;
  entityType: MasterEntityType;
  entityCloudId: string;
  action: "create" | "update" | "delete";
  revision: number;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
  reason: string;
  actorUsername: string;
  stationId?: string | null;
  deviceId?: string | null;
  createdAt: string;
}

export interface LpnTraceEvent {
  id: string;
  stationId: string;
  localEventId: string;
  packageUid: string;
  eventType: string;
  username: string;
  deviceId?: string | null;
  gatewayId?: string | null;
  scaleId?: number | null;
  scaleName?: string | null;
  sourceAt: string;
  receivedAt: string;
  payload?: Record<string, unknown> | null;
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
  unsyncedReadings?: number;
  unsyncedTraceEvents?: number;
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

export function parseLabelMetadata(
  raw?: string | null,
): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function readingLpn(reading: Reading): string {
  return reading.packageUid || reading.session.packageUid || "";
}

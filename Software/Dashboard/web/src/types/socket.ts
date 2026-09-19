export interface WeightLivePayload {
  gatewayId: string;
  readingId: string;
  weight: number;
  unit: string;
  stable: boolean;
  grossOrNet?: 'gross' | 'net';
  rawLine: string;
  capturedAt: string;
  sessionId?: number;
  vendorId?: number;
  packagingId?: number;
}

/**
 * Socket.IO Event Types for Gateway ↔ Server Communication
 */

export interface GatewayHelloPayload {
  gatewayId: string;
  hostname: string;
  appVersion: string;
  capabilities: string[];
  ts: number;
}

export interface WeightUpdatePayload {
  gatewayId: string;
  readingId: string;
  weight: number;
  unit: string; // 'kg', 'g', etc.
  stable: boolean;
  grossOrNet?: 'gross' | 'net';
  rawLine: string;
  capturedAt: string; // ISO 8601 timestamp
}

export interface WeightAckPayload {
  readingId: string;
  persisted: boolean;
  error?: string;
}

export interface WeightLivePayload extends WeightUpdatePayload {
  vendorId?: number;
  packagingId?: number;
  sessionId?: number;
}

export interface GatewayConfigUpdatePayload {
  serialPort?: string;
  baudRate?: number;
  parity?: 'none' | 'even' | 'odd';
  dataBits?: number;
  stopBits?: number;
  stableWindowMs?: number;
}

export enum SocketEvents {
  // Gateway → Server
  GATEWAY_HELLO = 'gateway:hello',
  WEIGHT_UPDATE = 'weight:update',
  
  // Server → Gateway
  WEIGHT_ACK = 'weight:ack',
  GATEWAY_CONFIG_UPDATE = 'gateway:config:update',
  
  // Server → Web Client
  WEIGHT_LIVE = 'weight:live',
  AUTO_SAVE_COMPLETE = 'autosave:complete',
  
  // Web Client → Server
  SESSION_START = 'session:start',
  SESSION_END = 'session:end',
}

export interface AutoSaveCompletePayload {
  sessionId: number;
  readingId: number;
  weight: number;
  unit: string;
  vendorId: number;
  packagingId: number;
  vendorName: string;
  packagingName: string;
  tareWeight: number;
  capturedAt: string;
}

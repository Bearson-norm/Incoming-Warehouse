/**
 * Socket.IO Event Types (shared with server)
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
  unit: string;
  stable: boolean;
  grossOrNet?: 'gross' | 'net';
  rawLine: string;
  capturedAt: string;
}

export interface WeightAckPayload {
  readingId: string;
  persisted: boolean;
  error?: string;
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
  GATEWAY_HELLO = 'gateway:hello',
  WEIGHT_UPDATE = 'weight:update',
  WEIGHT_ACK = 'weight:ack',
  GATEWAY_CONFIG_UPDATE = 'gateway:config:update',
}

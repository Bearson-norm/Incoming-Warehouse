#!/usr/bin/env node

import { SerialPort } from 'serialport';
import { io, Socket } from 'socket.io-client';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { WeightUpdatePayload, GatewayHelloPayload, SocketEvents, WeightAckPayload } from './types/socket-events.js';
import { ConfigServer } from './config-server.js';
import { resolveGatewayConfigPath } from './config-path.js';

interface SerialConfig {
  port: string;
  baudRate: number;
  parity: 'none' | 'even' | 'odd';
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 1.5 | 2;
  autoDetect?: boolean;
}

interface ServerConfig {
  url: string;
  apiKey: string;
}

interface StableConfig {
  windowMs: number;
  pattern: string;
  unstablePattern: string;
}

interface Config {
  serial: SerialConfig;
  server: ServerConfig;
  stable: StableConfig;
}

class WeighingGateway {
  private serialPort: SerialPort | null = null;
  private socket: Socket | null = null;
  private config: Config;
  private gatewayId: string;
  private configPath: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = Infinity;
  private reconnectDelay = 1000;
  private offlineBuffer: WeightUpdatePayload | null = null;
  private lastStableWeight: { weight: number; timestamp: number } | null = null;
  private stableWindowTimer: NodeJS.Timeout | null = null;
  private configServer: ConfigServer | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || resolveGatewayConfigPath();
    this.gatewayId = this.loadOrCreateGatewayId();
    this.config = this.loadConfig(this.configPath);
  }

  private loadOrCreateGatewayId(): string {
    const idPath = path.join(os.homedir(), '.incoming-warehouse-gateway-id');
    try {
      if (fs.existsSync(idPath)) {
        return fs.readFileSync(idPath, 'utf-8').trim();
      }
    } catch (error) {
      console.warn('Could not read gateway ID file:', error);
    }

    const newId = uuidv4();
    try {
      fs.writeFileSync(idPath, newId, 'utf-8');
    } catch (error) {
      console.warn('Could not write gateway ID file:', error);
    }
    return newId;
  }

  private loadConfig(configPath: string): Config {
    const configFile = configPath;

    let config: Partial<Config> = {};
    if (fs.existsSync(configFile)) {
      try {
        config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      } catch (error) {
        console.error(`Error reading config file ${configFile}:`, error);
        process.exit(1);
      }
    } else {
      console.warn(`Config file not found: ${configFile}. Using defaults.`);
    }

    return {
      serial: {
        port: config.serial?.port || 'COM3',
        baudRate: config.serial?.baudRate || 9600,
        parity: config.serial?.parity || 'none',
        dataBits: (config.serial?.dataBits || 8) as 5 | 6 | 7 | 8,
        stopBits: (config.serial?.stopBits || 1) as 1 | 1.5 | 2,
        autoDetect: config.serial?.autoDetect ?? true,
      },
      server: {
        // Electron owns the local API URL and authentication key. Prefer its
        // environment values so a stale user config cannot silently prevent
        // the gateway from authenticating with the bundled API.
        url: process.env.SERVER_URL || config.server?.url || 'http://localhost:4123',
        apiKey: process.env.GATEWAY_API_KEY || config.server?.apiKey || '',
      },
      stable: {
        windowMs: config.stable?.windowMs || 1000,
        pattern: config.stable?.pattern || 'ST|STABLE|S',
        unstablePattern: config.stable?.unstablePattern || 'US|UNSTABLE|U',
      },
    };
  }

  async start() {
    console.log('Starting Weighing Gateway...');
    console.log(`Gateway ID: ${this.gatewayId}`);
    console.log(`Config file: ${this.configPath}`);
    console.log(`Server URL: ${this.config.server.url}`);

    // Start config server on port 4124
    this.configServer = new ConfigServer(
      4124,
      this.configPath,
      () => this.config,
      () => {
        console.log('Reloading configuration...');
        this.config = this.loadConfig(this.configPath);
      },
      this.config.server.apiKey || process.env.GATEWAY_API_KEY || '',
    );
    this.configServer.start();

    await this.connectSerial();
    await this.connectSocket();
  }

  private async connectSerial() {
    try {
      if (this.config.serial.autoDetect) {
        await this.autoDetectSerial();
      }

      this.serialPort = new SerialPort({
        path: this.config.serial.port,
        baudRate: this.config.serial.baudRate,
        parity: this.config.serial.parity,
        dataBits: this.config.serial.dataBits,
        stopBits: this.config.serial.stopBits,
      });

      // Buffer untuk mengumpulkan data bytes
      let dataBuffer = Buffer.alloc(0);

      this.serialPort.on('open', () => {
        console.log(`✅ Serial port opened: ${this.config.serial.port}`);
        console.log(`   Baud rate: ${this.config.serial.baudRate}`);
        console.log(`   Waiting for data...`);
      });

      this.serialPort.on('error', (error: any) => {
        console.error('❌ Serial port error:', error.message || error);
        
        // Provide helpful error messages
        if (error.message?.includes('Access denied') || error.code === 'EACCES') {
          console.error('');
          console.error('⚠️  Port access denied. Possible causes:');
          console.error('   1. Port sedang digunakan aplikasi lain');
          console.error('   2. Tutup aplikasi lain yang menggunakan port ini');
          console.error('   3. Restart komputer jika port masih terkunci');
          console.error('   4. Coba port serial lain jika tersedia');
          console.error('');
          console.error('💡 Tips:');
          console.error('   - Cek Device Manager → Ports (COM & LPT)');
          console.error('   - Tutup aplikasi seperti Arduino IDE, Putty, atau aplikasi serial lainnya');
          console.error('   - Tunggu 5 detik, Gateway akan mencoba reconnect...');
        } else if (error.message?.includes('cannot open') || error.message?.includes('not found')) {
          console.error('');
          console.error('⚠️  Port tidak ditemukan atau tidak dapat dibuka');
          console.error('   Pastikan timbangan terhubung dan port serial benar');
        }
        
        this.reconnectSerial();
      });

      this.serialPort.on('close', () => {
        console.log('⚠️  Serial port closed');
        dataBuffer = Buffer.alloc(0); // Reset buffer
      });

      // Passive listener mode
      // Hanya parse data TEKS dengan line ending (\r\n atau \n)
      // Sesuai CARA_KERJA_PARSING_TIMBANGAN.md:
      //   - AND EK-15KL: "ST,+000140.7  g\r\n"
      //   - Vibra: "+000140.7  G  S\r\n"
      // Data non-teks (binary) hanya di-log, TIDAK di-parse
      this.serialPort.on('data', (data: Buffer) => {
        // Append to buffer
        dataBuffer = Buffer.concat([dataBuffer, data]);
        
        // Cari line ending (\r\n atau \n) - format standar timbangan
        const textData = dataBuffer.toString('utf8', 0, Math.min(500, dataBuffer.length));
        const lineEndIndex = textData.indexOf('\r\n');
        const lineEndIndex2 = textData.indexOf('\n');
        const lineEnd = lineEndIndex >= 0 ? lineEndIndex : (lineEndIndex2 >= 0 ? lineEndIndex2 : -1);
        
        if (lineEnd >= 0) {
          // Ada line ending = data teks dari timbangan → parse
          const line = textData.substring(0, lineEnd).trim();
          const bytesConsumed = lineEnd + (lineEndIndex >= 0 ? 2 : 1);
          
          if (line.length > 0) {
            console.log(`📥 Data: ${line}`);
            this.handleSerialData(line);
          }
          
          // Hapus data yang sudah diproses dari buffer
          dataBuffer = dataBuffer.slice(bytesConsumed);
          return;
        }
        
        // Tidak ada line ending — data belum lengkap atau format non-teks
        // Jika buffer sudah cukup besar, log sebagai raw data dan bersihkan
        if (dataBuffer.length > 50) {
          const hexStr = dataBuffer.toString('hex');
          console.log(`📡 Raw data (${dataBuffer.length} bytes): ${hexStr.substring(0, 60)}${hexStr.length > 60 ? '...' : ''}`);
          dataBuffer = Buffer.alloc(0);
        }
      });
    } catch (error: any) {
      if (error.message?.includes('No serial ports found')) {
        console.warn('⚠️  No serial ports found. This is normal if no hardware is connected.');
        console.warn('   Gateway will continue running. Connect a serial device and restart gateway.');
      } else {
        console.error('Failed to connect to serial port:', error.message || error);
      }
      this.reconnectSerial();
    }
  }

  private async autoDetectSerial() {
    const ports = await SerialPort.list();
    console.log('Available serial ports:');
    ports.forEach((port) => {
      console.log(`  - ${port.path} (${port.manufacturer || 'Unknown'})`);
    });

    if (ports.length === 0) {
      throw new Error('No serial ports found');
    }

    const configuredPort = this.config.serial.port;
    const portExists = ports.some((p) => p.path === configuredPort);

    // Auto-select when unset, default placeholder, or configured port is missing
    if (!configuredPort || configuredPort === 'COM3' || !portExists) {
      if (configuredPort && !portExists) {
        console.log(`Configured port ${configuredPort} not found, auto-selecting...`);
      }
      this.config.serial.port = ports[0].path;
      console.log(`Auto-selected port: ${this.config.serial.port}`);
    }
  }

  private reconnectSerial() {
    setTimeout(() => {
      console.log('Reconnecting to serial port...');
      this.connectSerial();
    }, 5000);
  }

  private handleSerialData(data: string) {
    const trimmed = data.trim();
    if (!trimmed) return;

    // Parse menggunakan parseWeightSmart (sesuai CARA_KERJA_PARSING_TIMBANGAN.md)
    const result = this.parseWeightSmart(trimmed);

    if (result !== null) {
      // Berat diterima dalam gram, konversi ke kg untuk payload
      const weightKg = result.unit === 'g' ? result.weight / 1000 : result.weight;
      this.processWeightData(weightKg, result.stable, trimmed);
    }
    // Jika tidak bisa di-parse, tidak log error (passive listener)
  }


  private processWeightData(weight: number, stable: boolean, rawLine: string) {
    console.log(`⚖️  Parsed weight: ${weight} kg (stable: ${stable})`);

    const payload: WeightUpdatePayload = {
      gatewayId: this.gatewayId,
      readingId: uuidv4(),
      weight,
      unit: 'kg',
      stable,
      rawLine,
      capturedAt: new Date().toISOString(),
    };

    // Check if weight is stable for the configured window
    if (stable) {
      if (this.lastStableWeight && this.lastStableWeight.weight === weight) {
        const timeSinceStable = Date.now() - this.lastStableWeight.timestamp;
        if (timeSinceStable >= this.config.stable.windowMs) {
          console.log(`✅ Sending stable weight: ${weight} kg`);
          this.sendWeightUpdate(payload);
        }
      } else {
        this.lastStableWeight = { weight, timestamp: Date.now() };
      }
    } else {
      this.lastStableWeight = null;
      // Send unstable readings immediately
      console.log(`📤 Sending unstable weight: ${weight} kg`);
      this.sendWeightUpdate(payload);
    }
  }


  /**
   * Parser utama sesuai CARA_KERJA_PARSING_TIMBANGAN.md
   * Mendukung:
   *   - AND EK-15KL: "ST,+000140.7  g" atau "ST,+000140.7  g,11:06:00,03/12/2025,36"
   *   - Vibra: "+000140.7  G  S" atau "-000017.0  K  I"
   *   - Generic: angka dengan unit opsional
   * 
   * Return: { weight: gram, unit: 'g', stable: boolean } atau null
   */
  private parseWeightSmart(raw: string): { weight: number; unit: string; stable: boolean; originalUnit?: string } | null {
    try {
      // 1. Pembersihan data
      let cleaned = raw.replace(/[\r\n]/g, '').trim();
      cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      cleaned = cleaned.replace(/\?([A-Za-z0-9\s,.\-+])/g, '$1');
      cleaned = cleaned.replace(/([A-Za-z0-9\s,.\-+])\?/g, '$1');

      if (!cleaned || cleaned.length < 2) return null;

      // 2. Coba parser Vibra: "+000140.7  G  S"
      const VIBRA_REGEX = /^([+-]?)(\d{6}\.\d)\s+([GK])\s+([SI])/i;
      const vibra = VIBRA_REGEX.exec(cleaned);
      if (vibra) {
        const sign = vibra[1] === '-' ? -1 : 1;
        const value = parseFloat(vibra[2]);
        const unit = vibra[3].toUpperCase();
        const stable = vibra[4].toUpperCase() === 'S';

        // Konversi ke gram
        const grams = unit === 'G'
          ? value * sign
          : value * sign * 1000; // kg → gram

        console.log(`⚖️  Vibra: ${cleaned} → ${grams}g (stable: ${stable})`);
        return { weight: grams, unit: 'g', stable, originalUnit: unit };
      }

      // 3. Coba parser AND EK-15KL: "ST,+000140.7  g" atau "ST,+000140.7  g,HH:MM:SS,DD/MM/YYYY,XX"
      const hasAndPrefix = /^(ST|US),/i.test(cleaned);
      if (hasAndPrefix) {
        return this.parseAndEk15kl(cleaned);
      }

      // 4. Fallback: cari angka desimal generik
      const DECIMAL_REGEX = /([+-]?\d+\.?\d*)\s*(kg|g|lb|oz)?/i;
      const decMatch = DECIMAL_REGEX.exec(cleaned);
      if (decMatch) {
        let weight = parseFloat(decMatch[1]);
        const unit = (decMatch[2] || 'g').toUpperCase();
        
        // Jika format 7 digit tanpa titik (001705 = 170.5g)
        if (cleaned.match(/^\d{7}$/)) {
          weight = weight / 10;
        }

        // Konversi ke gram
        let grams = weight;
        if (unit === 'KG') {
          grams = weight * 1000;
        }

        // Validasi
        if (isNaN(grams) || Math.abs(grams) > 100000) return null;

        const stable = this.isStable(cleaned);
        console.log(`⚖️  Generic: ${cleaned} → ${grams}g (stable: ${stable})`);
        return { weight: grams, unit: 'g', stable, originalUnit: unit };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parser khusus AND EK-15KL
   * Format: "ST,+000140.7  g" atau "ST,+000140.7  g,11:06:00,03/12/2025,36"
   */
  private parseAndEk15kl(cleaned: string): { weight: number; unit: string; stable: boolean; originalUnit?: string } | null {
    try {
      const parts = cleaned.split(',');
      if (parts.length < 2) return null;

      const status = parts[0].trim().toUpperCase();
      const stable = status === 'ST';
      const weightRaw = parts[1].trim();

      // Validasi: data tidak lengkap (berakhir dengan titik desimal saja)
      if (/\.\s*$/.test(weightRaw)) return null;

      // Ekstraksi berat
      const weightMatch = weightRaw.match(/([+-]?)(0*\d+\.?\d*)\s*(kg|g|lb|oz)?/i);
      if (!weightMatch) return null;

      const signStr = weightMatch[1];
      let numStr = weightMatch[2];
      let weightUnit = (weightMatch[3] || 'g').toUpperCase();

      let weightValue = parseFloat((signStr || '') + numStr);
      if (isNaN(weightValue)) return null;

      // Deteksi dan perbaikan leading zeros
      const numStrWithoutLeadingZeros = numStr.replace(/^0+/, '') || '0';
      const isSuspiciouslyShort =
        (numStrWithoutLeadingZeros.length < 3 && weightRaw.length > 10) ||
        (numStrWithoutLeadingZeros.length < 2 && weightRaw.length > 15) ||
        (weightValue > 0 && weightValue < 100 && weightRaw.length > 15);

      if (isSuspiciouslyShort) {
        // Coba pattern lebih panjang
        const patterns = [
          /(\d{3,}\.\d+)/,      // 3+ digit dengan decimal
          /(\d{3,})/,           // 3+ digit
          /([1-9]\d{2,}\.?\d*)/, // dimulai 1-9, 2+ digit
        ];
        for (const pattern of patterns) {
          const longerMatch = weightRaw.match(pattern);
          if (longerMatch) {
            const corrected = parseFloat((signStr || '') + longerMatch[1]);
            if (!isNaN(corrected) && corrected > 0 && corrected <= 100000) {
              weightValue = corrected;
              break;
            }
          }
        }
      }

      // Validasi nilai yang masuk akal (max 100kg = 100000g)
      if (Math.abs(weightValue) > 100000) {
        // Coba perbaiki dengan menghapus leading zeros
        const cleanedNum = numStr.replace(/^0+/, '') || '0';
        const reParsed = parseFloat((signStr || '') + cleanedNum);
        if (!isNaN(reParsed) && Math.abs(reParsed) <= 100000) {
          weightValue = reParsed;
        } else {
          return null;
        }
      }

      // Konversi ke gram
      let weightGrams = weightValue;
      if (weightUnit === 'KG' || weightUnit.includes('KG')) {
        weightGrams = weightValue * 1000;
      }

      console.log(`⚖️  AND: ${cleaned} → ${weightGrams}g (stable: ${stable})`);
      return { weight: weightGrams, unit: 'g', stable, originalUnit: weightUnit };
    } catch (error) {
      return null;
    }
  }

  private isStable(data: string): boolean {
    const stableRegex = new RegExp(this.config.stable.pattern, 'i');
    const unstableRegex = new RegExp(this.config.stable.unstablePattern, 'i');

    if (unstableRegex.test(data)) {
      return false;
    }
    return stableRegex.test(data);
  }

  private sendWeightUpdate(payload: WeightUpdatePayload) {
    if (this.socket && this.socket.connected) {
      console.log(`📤 Sending to WebSocket: weight=${payload.weight}kg, stable=${payload.stable}`);
      this.socket.emit(SocketEvents.WEIGHT_UPDATE, payload);
    } else {
      console.warn(`⚠️  Socket not connected. Buffering weight update: ${payload.weight}kg`);
      // Buffer for later
      this.offlineBuffer = payload;
    }
  }

  private async connectSocket() {
    try {
      this.socket = io(this.config.server.url, {
        transports: ['websocket', 'polling'],
        auth: {
          apiKey: this.config.server.apiKey,
        },
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 30000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.reconnectAttempts = 0;
        this.sendGatewayHello();
        this.flushOfflineBuffer();
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      this.socket.on('connect_error', (error) => {
        if (this.reconnectAttempts === 0) {
          console.warn(`⚠️  Cannot connect to server at ${this.config.server.url}`);
          console.warn('   Make sure the API server is running. Gateway will keep retrying...');
        }
        console.error(`Socket connection error (attempt ${this.reconnectAttempts + 1}):`, error.message);
        this.reconnectAttempts++;
      });

      this.socket.on(SocketEvents.WEIGHT_ACK, (ack: WeightAckPayload) => {
        if (ack.persisted) {
          if (this.offlineBuffer?.readingId === ack.readingId) {
            this.offlineBuffer = null;
          }
        }
      });

      this.socket.on(SocketEvents.GATEWAY_CONFIG_UPDATE, (config: any) => {
        console.log('Received config update:', config);
        // Update serial config if provided
        if (config.serialPort) {
          this.config.serial.port = config.serialPort;
        }
        if (config.baudRate) {
          this.config.serial.baudRate = config.baudRate;
        }
        if (config.stableWindowMs) {
          this.config.stable.windowMs = config.stableWindowMs;
        }
      });
    } catch (error) {
      console.error('Failed to connect socket:', error);
    }
  }

  private sendGatewayHello() {
    if (!this.socket || !this.socket.connected) return;

    const payload: GatewayHelloPayload = {
      gatewayId: this.gatewayId,
      hostname: os.hostname(),
      appVersion: '1.0.0',
      capabilities: ['serial', 'websocket', 'auto-reconnect'],
      ts: Date.now(),
    };

    this.socket.emit(SocketEvents.GATEWAY_HELLO, payload);
  }

  private flushOfflineBuffer() {
    if (!this.socket || !this.socket.connected) return;

    if (!this.offlineBuffer) return;

    console.log('Flushing latest buffered reading...');
    this.socket.emit(SocketEvents.WEIGHT_UPDATE, this.offlineBuffer);
    this.offlineBuffer = null;
  }

  stop() {
    console.log('Stopping gateway...');
    if (this.configServer) {
      this.configServer.stop();
    }
    if (this.serialPort && this.serialPort.isOpen) {
      this.serialPort.close();
    }
    if (this.socket) {
      this.socket.disconnect();
    }
    if (this.stableWindowTimer) {
      clearTimeout(this.stableWindowTimer);
    }
  }
}

// Main execution
const gateway = new WeighingGateway();
gateway.start();

// Graceful shutdown
process.on('SIGINT', () => {
  gateway.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  gateway.stop();
  process.exit(0);
});

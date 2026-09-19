/**
 * BASIC PROGRAM: Koneksi Timbangan ke WebSocket
 * 
 * Program ini membaca data dari timbangan via Serial Port (COM Port)
 * dan mengirimkannya ke client melalui WebSocket secara real-time.
 * 
 * Cara menggunakan:
 * 1. Install dependencies: npm install
 * 2. Edit konfigurasi COM Port di bawah ini
 * 3. Jalankan: npm start
 * 4. Client bisa connect ke ws://localhost:3001/ws/scale
 */

const SerialPort = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');
const http = require('http');

// ==========================================
// KONFIGURASI
// ==========================================
const SERIAL_PORT = 'COM3'; // Ganti dengan COM Port timbangan Anda
const BAUD_RATE = 9600; // Sesuaikan dengan baud rate timbangan
const WS_PORT = 3001; // Port untuk WebSocket server

// ==========================================
// SETUP SERIAL PORT
// ==========================================
let serialPort = null;
let parser = null;

function initSerialPort() {
  try {
    console.log(`📡 Membuka Serial Port: ${SERIAL_PORT} (${BAUD_RATE} baud)`);
    
    serialPort = new SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
      autoOpen: false
    });

    // Parser untuk membaca data per baris
    parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    // Event: Port terbuka
    serialPort.on('open', () => {
      console.log('✅ Serial Port terbuka');
    });

    // Event: Data diterima
    parser.on('data', (data) => {
      const weight = parseWeight(data);
      if (weight !== null) {
        console.log(`⚖️  Berat: ${weight.weight}g`);
        broadcastToClients(weight);
      }
    });

    // Event: Error
    serialPort.on('error', (err) => {
      console.error('❌ Serial Port Error:', err.message);
    });

    // Buka port
    serialPort.open((err) => {
      if (err) {
        console.error(`❌ Gagal membuka Serial Port: ${err.message}`);
        console.log('💡 Pastikan:');
        console.log('   1. COM Port sudah benar');
        console.log('   2. Timbangan sudah terhubung');
        console.log('   3. Tidak ada program lain yang menggunakan port ini');
      }
    });

  } catch (error) {
    console.error('❌ Error init Serial Port:', error);
  }
}

// ==========================================
// PARSING DATA TIMBANGAN
// ==========================================
function parseWeight(rawData) {
  try {
    // Contoh format data dari timbangan:
    // - "ST,GS,+00170.5g" (Vibra)
    // - "170.5" (plain number)
    // - "001705" (7 digit, dibagi 10 untuk gram)
    
    // Method 1: Cari angka dengan regex
    const numberMatch = rawData.match(/[\d.]+/);
    if (numberMatch) {
      let weight = parseFloat(numberMatch[0]);
      
      // Jika format 7 digit (contoh: 001705 = 170.5g)
      if (rawData.match(/^\d{7}$/)) {
        weight = weight / 10;
      }
      
      // Validasi berat (0 - 999999 gram)
      if (weight >= 0 && weight <= 999999) {
        return {
          weight: Math.round(weight * 10) / 10, // Round to 0.1g
          unit: 'g',
          raw: rawData,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error parsing weight:', error);
    return null;
  }
}

// ==========================================
// SETUP WEBSOCKET SERVER
// ==========================================
const httpServer = http.createServer();
const wss = new WebSocket.Server({ 
  server: httpServer,
  path: '/ws/scale'
});

let clients = new Set();

// Event: Client connect
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`📡 Client terhubung. Total: ${clients.size}`);
  
  // Kirim konfirmasi koneksi
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to scale data stream',
    timestamp: new Date().toISOString()
  }));
  
  // Event: Client disconnect
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`📡 Client terputus. Total: ${clients.size}`);
  });
  
  // Event: Error
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    clients.delete(ws);
  });
});

// ==========================================
// BROADCAST DATA KE CLIENT
// ==========================================
function broadcastToClients(weightData) {
  if (clients.size === 0) return;
  
  const message = JSON.stringify({
    type: 'scale_data',
    success: true,
    timestamp: new Date().toISOString(),
    weight: weightData.weight,
    unit: weightData.unit,
    raw: weightData.raw
  });
  
  // Kirim ke semua client yang terhubung
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('❌ Error mengirim data ke client:', error);
        clients.delete(client);
      }
    }
  });
}

// ==========================================
// START SERVER
// ==========================================
httpServer.listen(WS_PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${WS_PORT}`);
  console.log(`📡 WebSocket Server berjalan di ws://localhost:${WS_PORT}/ws/scale`);
  console.log('');
  console.log('💡 Untuk test WebSocket, gunakan:');
  console.log('   - Browser: buka console dan ketik:');
  console.log('     const ws = new WebSocket("ws://localhost:3001/ws/scale");');
  console.log('     ws.onmessage = (e) => console.log(JSON.parse(e.data));');
  console.log('');
  
  // Inisialisasi Serial Port
  initSerialPort();
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================
process.on('SIGINT', () => {
  console.log('\n🛑 Menghentikan server...');
  
  // Tutup Serial Port
  if (serialPort && serialPort.isOpen) {
    serialPort.close(() => {
      console.log('✅ Serial Port ditutup');
    });
  }
  
  // Tutup WebSocket
  wss.close(() => {
    console.log('✅ WebSocket server ditutup');
  });
  
  // Tutup HTTP Server
  httpServer.close(() => {
    console.log('✅ HTTP Server ditutup');
    process.exit(0);
  });
});

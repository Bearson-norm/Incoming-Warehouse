# Basic Program: Koneksi Timbangan ke WebSocket

Program dasar untuk membaca data dari timbangan via Serial Port dan mengirimkannya ke client melalui WebSocket secara real-time.

## 📋 Fitur

- ✅ Membaca data dari timbangan via Serial Port (COM Port)
- ✅ Parsing data timbangan (support berbagai format)
- ✅ WebSocket server untuk real-time data streaming
- ✅ Broadcast data ke semua client yang terhubung
- ✅ Error handling dan auto-reconnect
- ✅ Client example (HTML/JavaScript)

## 🚀 Instalasi

```bash
cd basic-programs/scale-websocket
npm install
```

## ⚙️ Konfigurasi

Edit file `server.js` dan sesuaikan:

```javascript
const SERIAL_PORT = 'COM3'; // Ganti dengan COM Port timbangan Anda
const BAUD_RATE = 9600; // Sesuaikan dengan baud rate timbangan
const WS_PORT = 3001; // Port untuk WebSocket server
```

## ▶️ Menjalankan

```bash
npm start
```

Server akan berjalan di:
- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3001/ws/scale`

## 🧪 Testing

### 1. Test dengan Browser Console

Buka browser console dan ketik:

```javascript
const ws = new WebSocket("ws://localhost:3001/ws/scale");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

### 2. Test dengan HTML Client

Buka file `client-example.html` di browser (atau serve via HTTP server).

## 📡 Format Data WebSocket

Data yang dikirim ke client:

```json
{
  "type": "scale_data",
  "success": true,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "weight": 170.5,
  "unit": "g",
  "raw": "ST,GS,+00170.5g"
}
```

## 🔧 Customisasi Parsing

Jika format data timbangan berbeda, edit fungsi `parseWeight()` di `server.js`:

```javascript
function parseWeight(rawData) {
  // Custom parsing logic di sini
  // Return: { weight: number, unit: string, raw: string }
}
```

## 📝 Catatan

- Pastikan COM Port tidak digunakan oleh program lain
- Pastikan baud rate sesuai dengan setting timbangan
- WebSocket akan otomatis broadcast ke semua client yang terhubung

## 🐛 Troubleshooting

**Error: "Gagal membuka Serial Port"**
- Pastikan COM Port sudah benar
- Pastikan timbangan sudah terhubung
- Tutup program lain yang menggunakan port yang sama

**Tidak ada data diterima**
- Cek koneksi kabel timbangan
- Cek baud rate setting
- Cek format data dari timbangan (mungkin perlu custom parsing)

**WebSocket tidak connect**
- Pastikan server sudah running
- Cek firewall settings
- Cek port 3001 tidak digunakan oleh program lain

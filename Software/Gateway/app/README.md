# Gateway App

Gateway untuk membaca data timbangan via Serial Port dan mengirim ke VPS via WebSocket.

## Catatan Penting

**Gateway TIDAK memerlukan PostgreSQL**. Gateway hanya:
- Membaca data dari serial port
- Mengirim data ke server via WebSocket
- Menyimpan konfigurasi lokal menggunakan **SQLite** (atau fallback ke JSON)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build:
```bash
npm run build
```

3. Copy `config.example.json` ke `config.json` (untuk fallback):
```bash
cp config.example.json config.json
```

4. Edit `config.json` dengan konfigurasi serial port dan server yang sesuai.

5. Run:
```bash
npm start
```

## Konfigurasi

Gateway menggunakan **SQLite** untuk menyimpan konfigurasi di `~/.incoming-warehouse-gateway.db`.
Jika SQLite tidak tersedia, akan fallback ke file `config.json`.

### Web UI untuk Konfigurasi

Gateway menyediakan **Web UI** untuk konfigurasi yang mudah. Setelah gateway berjalan:

1. Buka browser dan akses: **http://localhost:4124**
2. UI akan menampilkan form konfigurasi dengan 3 bagian:
   - **Serial Port Settings**: Konfigurasi port serial (COM port, baud rate, dll)
   - **Server Settings**: URL server dan API key
   - **Stable Weight Detection**: Pengaturan deteksi berat stabil

3. Klik **"Reload"** untuk memuat konfigurasi saat ini
4. Edit konfigurasi sesuai kebutuhan
5. Klik **"Save Configuration"** untuk menyimpan

**Catatan**: Setelah menyimpan konfigurasi, restart gateway agar perubahan diterapkan.

### SQLite Database
- Lokasi: `~/.incoming-warehouse-gateway.db` (home directory user)
- Tabel: `config` (konfigurasi saat ini)
- Tabel: `config_history` (riwayat perubahan config)

### Config JSON (Fallback)
File `config.json` berisi:
- `serial`: Konfigurasi serial port (port, baudRate, dll)
- `server`: URL server dan API key
- `stable`: Pattern untuk deteksi stable/unstable

## Environment Variables

- `SERVER_URL`: URL server (default: http://localhost:4123)
- `GATEWAY_API_KEY`: API key untuk autentikasi

## Auto-detect Serial Port

Jika `autoDetect: true`, gateway akan otomatis memilih port serial yang tersedia.

## Database

**Gateway tidak perlu PostgreSQL**. Gateway menggunakan SQLite untuk:
- Menyimpan konfigurasi serial port
- Menyimpan konfigurasi server
- Menyimpan riwayat perubahan konfigurasi
- Logging lokal (opsional)

SQLite database akan otomatis dibuat saat pertama kali gateway dijalankan.

# Electron Standalone Setup Guide

Panduan setup untuk menjalankan Gateway dan Dashboard sebagai aplikasi Electron standalone dengan koneksi database ke VPS.

## Quick Start

### 1. Install Dependencies

Proyek memakai npm workspaces; **electron-app** sudah termasuk workspace.

```bash
npm install
```

Ini menginstal dependensi Dashboard, Gateway, dan Electron sekaligus dari folder root.

### 2. Build Semua Komponen

```bash
# Dari root directory
npm run build:electron
```

Ini akan build:
- Gateway
- Dashboard API (termasuk Prisma client generation)
- Dashboard Web (dengan flag Electron)
- Electron app

### 3. Rebuild Native Modules (Penting!)

Untuk Gateway yang menggunakan `serialport`, perlu rebuild native modules untuk Electron:

```bash
cd electron-app
npm run rebuild:native
```

### 4. Run Development Mode

Electron membutuhkan **Dashboard API yang sudah di-compile** (`Dashboard/api/dist/...`), karena proses API dijalankan dengan `node` terhadap file JS hasil build (bukan `nest start --watch`).

**Sekali saja sebelum dev Electron** (atau setelah perubahan besar di API):

```bash
npm run build:api
npm run prisma:generate --workspace=@incoming-warehouse/api
```

**Menjalankan Vite + Electron** (disarankan — tidak menjalankan API terpisah; Electron yang men-start API):

```bash
# Dari root
npm run dev:electron
```

Di Windows Anda juga bisa memakai `.\start-electron-dev.ps1`.

**Penting:** jangan jalankan `start-dev.ps1` atau `npm run dev:api` bersamaan dengan mode di atas — API akan **dua kali** dan port **4123** bentrok.

**Alternatif** (hanya Electron folder, Anda harus sudah menjalankan `npm run dev:web` di terminal lain):

```bash
cd electron-app
npm run dev
```

## Konfigurasi Database VPS

### Via UI (Recommended)

1. Buka aplikasi Electron
2. Navigate ke **Settings** page
3. Scroll ke bagian **"Konfigurasi Database VPS"**
4. Isi form:
   - **Host**: Alamat VPS (contoh: `vps.example.com` atau IP)
   - **Port**: Port PostgreSQL (default: `5432`)
   - **Database**: Nama database (default: `wis_foom`)
   - **Username**: Username database
   - **Password**: Password database
5. Klik **"Test Koneksi"** untuk validasi
6. Klik **"Simpan Konfigurasi"** untuk menyimpan

API akan otomatis restart dengan konfigurasi baru.

### Via File Config

Edit file: `~/.incoming-warehouse-electron/config.json`

```json
{
  "database": {
    "host": "vps.example.com",
    "port": 5432,
    "database": "wis_foom",
    "username": "admin",
    "password": "your-password",
    "url": "postgresql://admin:your-password@vps.example.com:5432/wis_foom"
  },
  "gateway": {
    "enabled": true,
    "autoStart": false
  },
  "odoo": {
    "baseUrl": "http://IP_ODOO_SERVER:8069",
    "iotApiKey": "your-foom-iot-api-key"
  }
}
```

**Note**: Field `url` akan otomatis di-generate jika tidak ada. Bagian `odoo` juga bisa diatur lewat **Settings** di aplikasi.

## Integrasi Odoo WMS (Recording Action)

Saat operator mengonfirmasi penimbangan, API mengirim data ke Odoo:

- **Endpoint**: `POST {ODOO_BASE_URL}/api/wms/iot/weight`
- **Header**: `X-FOOM-IoT-Key: {ODOO_IOT_API_KEY}`
- **Body**: `{ "package_uid": "<LPN>", "gross_weight": <kg> }`

### Via UI (disarankan — override langsung aktif)

1. **Login** ke aplikasi (browser atau Electron)
2. Buka **Pengaturan / Settings** → **Konfigurasi API Odoo WMS**
3. Isi **Base URL** dan **X-FOOM-IoT-Key** (kosongkan key jika tidak ingin mengubah yang sudah tersimpan)
4. Klik **Simpan Override** — berlaku **segera** tanpa restart API

Override disimpan di `data/odoo-settings.json` (API) dan mengalahkan nilai `.env`.

**Electron (tanpa login):** simpan lewat form yang sama → juga menulis `config.json` + restart API.

### Via file (browser dev / API manual)

Tambahkan ke `Dashboard/api/.env` (salin dari `.env.example`):

```env
ODOO_BASE_URL=http://IP_ODOO_SERVER:8069
ODOO_IOT_API_KEY=your-secret-key-from-odoo-settings
```

Lalu restart proses API (`npm run start:dev` di folder `Dashboard/api`).

API key dikonfigurasi di Odoo: **Settings > Technical > System Parameters** (`foom_wms_iot.api_key`).

### Alur operator (Recording Action)

1. Scan atau ketik **nomor LPN** (barcode UID pada label fisik).
2. Klik **Konfirmasi**.
3. Tunggu berat **stabil** di timbangan, lalu **Mulai Penimbangan**.
4. Klik **Konfirmasi Penimbangan** — data dikirim ke Odoo; tampil hasil **PASS** / **FAIL** (tare/netto dari Odoo).
5. Tidak ada cetak label LPN dari halaman ini.

### Migrasi database

Setelah update schema, jalankan dari root atau folder API:

```bash
cd Dashboard/api
npx prisma migrate deploy
npx prisma generate
```

## Package untuk Distribusi

### Windows

```bash
npm run package:electron:win
```

Output utama:

| Artefak | Keterangan |
|--------|------------|
| `release/* Setup *.exe` | Installer NSIS |
| `release/Incoming Warehouse *.exe` | **Portable** (satu file, tanpa instalasi; bisa disalin ke USB — tetap simpan folder `resources` yang sama jika Anda memakai unpacked layout) |

Build Windows **portable** juga dikonfigurasi di `electron-app/package.json` (`win.target` mencakup `portable`).

#### Apakah PC lain perlu menginstal Node.js?

**Tidak,** jika Anda memaketkan lewat `npm run package:electron:win` (script memanggil `npm run bundle-node` dulu). Build ini mengunduh **Node.js Windows x64** resmi (versi mengikuti `node -v` pada mesin Anda, atau variabel `NODE_BUNDLE_WIN_VERSION`) dan menyertainya di folder **`resources`** aplikasi; `process-manager` memakai **`node.exe` itu**, bukan Node dari PATH.

**Masih Anda perlukan di PC lain:** akses database (PostgreSQL/VPS), koneksi jaringan sesuai konfig — hanya binary Node yang tidak perlu diinstal lagi.

Gunakan struktur **`win-unpacked`** utuh untuk USB/copy folder; satu file **`…Portable.exe`** menyertakan konten yang sama secara praktis untuk pengguna akhir.

**Cadangan:** jika Anda menjalankan `electron-builder` tanpa langkah bundle, aplikasi bisa jatuh ke perintah `node` di PATH — pastikan jalur package resmi atau jalankan manual `npm run bundle-node` di folder `electron-app` sebelum package.

### Mac

```bash
npm run package:electron:mac
```

Output: `release/Incoming Warehouse-1.0.0.dmg`

### Linux

```bash
npm run package:electron:linux
```

Output: `release/Incoming Warehouse-1.0.0.AppImage`

## Struktur Aplikasi

```
electron-app/
├── main/
│   ├── main.ts              # Electron entry point
│   ├── process-manager.ts   # Manajemen API & Gateway processes
│   └── config-manager.ts    # Manajemen konfigurasi database
├── preload/
│   └── preload.ts          # IPC bridge untuk security
├── scripts/
│   ├── build-all.js        # Script build semua komponen
│   └── rebuild-native.js   # Script rebuild native modules
└── package.json
```

## Architecture

```
┌─────────────────────────────────────────┐
│      Electron Main Process              │
│                                         │
│  ┌──────────────────────────────────┐ │
│  │  BrowserWindow                    │ │
│  │  (Dashboard Web UI)               │ │
│  └──────────────────────────────────┘ │
│                                         │
│  ┌──────────────────────────────────┐ │
│  │  Process Manager                  │ │
│  │  ├─ API Process (child)          │ │
│  │  │  └─ Port: 4123                │ │
│  │  └─ Gateway Process (child)      │ │
│  │     └─ Connect to localhost:4123 │ │
│  └──────────────────────────────────┘ │
│                                         │
│  ┌──────────────────────────────────┐ │
│  │  Config Manager                   │ │
│  │  └─ Database Config (VPS)        │ │
│  └──────────────────────────────────┘ │
└─────────────────────────────────────────┘
         │
         │ DATABASE_URL
         ▼
┌─────────────────────────┐
│  VPS PostgreSQL          │
│  (Remote Database)       │
└─────────────────────────┘
```

## Fitur

- ✅ **Standalone Application**: Semua komponen dalam satu aplikasi
- ✅ **Database VPS**: Koneksi ke PostgreSQL di VPS (bukan local)
- ✅ **Process Management**: Auto-restart jika crash
- ✅ **UI Configuration**: Konfigurasi database via Settings page
- ✅ **Gateway Control**: Start/stop Gateway dari UI
- ✅ **Status Monitoring**: Real-time status API dan Gateway

## Troubleshooting

### API Server Tidak Start

**Kemungkinan penyebab:**
1. Database configuration belum di-set
2. Port 4123 sudah digunakan
3. Koneksi ke VPS gagal

**Solusi:**
1. Check Settings page, pastikan database config sudah diisi
2. Check apakah ada aplikasi lain di port 4123
3. Test koneksi database dari Settings page
4. Check log di DevTools (View > Toggle Developer Tools)

### Gateway Tidak Start

**Kemungkinan penyebab:**
1. API server belum running
2. Serial port tidak tersedia
3. Native modules belum di-rebuild

**Solusi:**
1. Pastikan API server sudah running (lihat status di Settings)
2. Check konfigurasi serial port di Gateway
3. Rebuild native modules: `cd electron-app && npm run rebuild:native`

### Native Modules Error

**Error**: `Module not found` atau `Cannot find module 'serialport'`

**Solusi:**
```bash
cd electron-app
npm run rebuild:native
```

### Build Error

**Error**: Build gagal atau file tidak ditemukan

**Solusi:**
1. Pastikan semua dependencies terinstall:
   ```bash
   npm install
   cd Dashboard/api && npm install
   cd ../../Dashboard/web && npm install
   cd ../../Gateway/app && npm install
   cd ../../electron-app && npm install
   ```

2. Build secara manual:
   ```bash
   npm run build:gateway
   npm run build:api
   npm run build:web
   cd electron-app && npm run build
   ```

## Development Notes

### Environment Variables

Electron app menggunakan environment variables untuk:
- `DATABASE_URL`: Set oleh ConfigManager dari config file
- `PORT`: Default 4123 untuk API
- `CORS_ORIGIN`: Set ke `http://localhost:4123`
- `JWT_SECRET`: Default atau dari env
- `GATEWAY_API_KEY`: Default atau dari env

### Path Resolution

- **Development**: Menggunakan relative paths dari project root
- **Production**: Menggunakan `app.getAppPath()` untuk packaged app

### Native Modules

Gateway menggunakan `serialport` yang memerlukan native bindings. Pastikan rebuild untuk Electron target sebelum packaging.

## Next Steps

1. **Icons**: Tambahkan icon files ke `electron-app/resources/`
   - `icon.ico` untuk Windows
   - `icon.icns` untuk Mac
   - `icon.png` untuk Linux

2. **Code Signing**: Setup code signing untuk distribusi (opsional)

3. **Auto Updater**: Implementasi auto-update mechanism (opsional)

4. **Encryption**: Encrypt password di config file untuk security (opsional)

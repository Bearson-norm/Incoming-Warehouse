# Electron Standalone Application

Aplikasi Electron yang menjalankan Gateway dan Dashboard secara standalone dengan koneksi database ke VPS.

## Struktur

```
electron-app/
├── main/                    # Electron main process
│   ├── main.ts              # Entry point
│   ├── process-manager.ts   # Manajemen child processes
│   └── config-manager.ts    # Manajemen konfigurasi
├── preload/                 # Preload scripts
│   └── preload.ts
├── scripts/                 # Build scripts
│   ├── build-all.js
│   └── rebuild-native.js
└── package.json
```

## Fitur

- ✅ Menjalankan Dashboard API sebagai child process
- ✅ Menjalankan Gateway sebagai child process (opsional)
- ✅ Konfigurasi database VPS via UI atau file config
- ✅ Auto-restart processes jika crash
- ✅ Process status monitoring
- ✅ Standalone packaging untuk Windows/Mac/Linux

## Development

### Prerequisites

1. Dari **root** repositori, install semua workspace (termasuk `electron-app`):
   ```bash
   npm install
   ```

2. Build **API** sekali (Electron menjalankan `node` ke `Dashboard/api/dist/...`):
   ```bash
   npm run build:api
   npm run prisma:generate --workspace=@incoming-warehouse/api
   ```

3. (Hanya jika memakai serial / native di Gateway) Rebuild native modules untuk Electron:
   ```bash
   cd electron-app
   npm run rebuild:native
   ```

4. **Disarankan** — jalankan Vite + Electron dari root (jangan jalankan `dev:api` terpisah; port 4123 dipakai oleh child process di dalam Electron):
   ```bash
   # Dari root
   npm run dev:electron
   ```
   Atau hanya proses Electron (Vite harus sudah jalan di `http://127.0.0.1:4234`):
   ```bash
   cd electron-app
   npm run dev
   ```

## Build & Package

### Build Semua Komponen

```bash
# Dari root directory
npm run build:electron
```

Script ini akan:
1. Build Gateway
2. Build Dashboard API
3. Generate Prisma client
4. Build Dashboard Web (dengan flag ELECTRON=true)
5. Build Electron app

### Package untuk Distribusi

Sebelum package **Windows**, runtime Node untuk API/Gateway di-bundle otomatis (`npm run bundle-node` di dalam `package:win`). PC pengguna akhir tidak perlu menginstal Node.js.

```bash
# Windows (menggunakan PowerShell script untuk skip code signing)
cd electron-app
npm run package:win

# Atau dari root directory
npm run package:electron:win

# Mac
npm run package:electron:mac

# Linux
npm run package:electron:linux
```

**Catatan untuk Windows**: Script menggunakan PowerShell untuk melewati code signing dan menghindari error symbolic link. Jika masih ada masalah, jalankan langsung:

```powershell
cd electron-app
.\scripts\package-win-no-sign.ps1
```

Output akan berada di folder `release/`.

## Konfigurasi Database

Anda dapat memilih antara **database lokal** (PostgreSQL di PC ini) atau **database VPS** (PostgreSQL di server). Hanya PostgreSQL diperlukan di VPS — API berjalan di perangkat ini.

### Lokasi File Konfigurasi

Aplikasi mendukung **dua mode** konfigurasi:

| Mode | Lokasi Config | Use Case |
|------|---------------|----------|
| **Standalone/Portable** | `config.json` di folder yang sama dengan exe | USB drive, folder portabel, copy-paste ke PC lain |
| **User** | `C:\Users\<username>\.incoming-warehouse-electron\config.json` | Installasi normal, satu user per PC |

**Prioritas:** Jika `config.json` ada di folder exe, aplikasi akan menggunakannya (portable). Jika tidak, gunakan config di user home.

**Standalone:** Copy **seluruh folder** `win-unpacked` ke USB/Downloads/folder mana saja. **PENTING:** Jangan hanya copy file exe — folder `resources/` harus ikut (berisi API, web, gateway). Struktur minimal:
```
MyFolder/
├── Incoming Warehouse.exe
├── config.json          (opsional, untuk portable config)
└── resources/           ← WAJIB ada
    ├── app.asar
    └── resources/
        ├── api/
        ├── web/
        └── gateway/
```

### Via UI (Recommended)

1. Buka aplikasi Electron
2. Jika muncul error "Database URL not configured", tutup dialog
3. Di halaman Login, klik **"Configure Database"** (atau buka `#/setting` di URL)
4. Pilih mode **Lokal** atau **VPS**, lalu isi form:
   - **Lokal**: Host = localhost, Port = 5432
   - **VPS**: Host = alamat VPS (contoh: `103.31.39.189`), Port = 5432 atau 5433
   - Database: nama database (default: `wis_foom`)
   - Username: username database
   - Password: password database
5. Klik "Test Koneksi" untuk memvalidasi
6. Klik "Simpan Konfigurasi" — API akan restart otomatis
7. Kembali ke Login dan login dengan admin/admin123

Konfigurasi disimpan di: folder exe (portable) atau `~/.incoming-warehouse-electron/config.json` (user).

### Via File Config

Edit `config.json` di folder exe (portable) atau `~/.incoming-warehouse-electron/config.json` (user):

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
  }
}
```

Setelah mengubah file, restart aplikasi.

## Gateway Management

Gateway dapat di-start/stop dari Settings page:
- Status Gateway ditampilkan di Settings
- Tombol Start/Stop untuk mengontrol Gateway
- Gateway akan connect ke local API (localhost:4123)

## Troubleshooting

### Code Signing Error (Symbolic Link)

Jika Anda mendapatkan error tentang symbolic links saat packaging Windows:

```
ERROR: Cannot create symbolic link : A required privilege is not held by the client
```

**Solusi**: Proyek ini menggunakan `electron-builder@24.6.3` yang menghindari bug ini. Jika Anda meng-upgrade electron-builder dan error muncul lagi:

1. **Downgrade ke 24.6.3** (direkomendasikan):
   ```bash
   cd electron-app
   npm install electron-builder@24.6.3 --save-dev
   ```

2. **Atau jalankan sebagai Administrator**:
   ```powershell
   # Run PowerShell as Administrator, then:
   cd electron-app
   npm run package:win
   ```

3. **Hapus cache winCodeSign** sebelum mencoba lagi:
   ```powershell
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
   ```

## Troubleshooting

### API Server Tidak Start

1. Check database configuration
2. Pastikan port 4123 tidak digunakan aplikasi lain
3. Check log di console Electron (DevTools)

### Gateway Tidak Start

1. Pastikan API server sudah running
2. Check serial port configuration di Gateway
3. Pastikan native modules sudah di-rebuild untuk Electron

### Native Modules Error

Rebuild native modules:
```bash
cd electron-app
npm run rebuild:native
```

### Build Error

Pastikan semua dependencies terinstall:
```bash
npm install
cd Dashboard/api && npm install
cd ../../Dashboard/web && npm install
cd ../../Gateway/app && npm install
cd ../../electron-app && npm install
```

## Architecture

```
┌─────────────────────────────────────┐
│     Electron Main Process           │
│  ┌───────────────────────────────┐ │
│  │  BrowserWindow (Dashboard UI) │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │  Process Manager              │ │
│  │  ├─ API Process (child)       │ │
│  │  └─ Gateway Process (child)  │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │  Config Manager               │ │
│  │  └─ Database Config (VPS)     │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
         │
         │ (DATABASE_URL)
         ▼
    ┌─────────────┐
    │  VPS (PostgreSQL) │
    └─────────────┘
```

## Notes

- Database connection selalu ke VPS, bukan local
- API berjalan di `localhost:4123`
- Gateway connect ke local API, bukan langsung ke VPS
- Config file location: `~/.incoming-warehouse-electron/config.json`

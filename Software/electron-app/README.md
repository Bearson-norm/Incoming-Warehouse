# Electron Standalone Application

Aplikasi Electron yang menjalankan Gateway dan Dashboard secara standalone. Data operasional disimpan di **SQLite** di PC timbang; agregasi cloud opsional ke **VPS (PostgreSQL + API)** — lihat [CLOUD_SETUP.md](../CLOUD_SETUP.md).

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
- ✅ SQLite lokal (otomatis) + konfigurasi cloud VPS (Settings → Cloud)
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

## Data lokal & cloud VPS

- **Database operasional**: SQLite di folder data aplikasi (portable: di samping exe; normal: `%USERPROFILE%\.incoming-warehouse-electron\`). Tidak perlu PostgreSQL di PC timbang.
- **Cloud VPS**: Settings → **Cloud Server Configuration** — URL publik VPS + **Cloud Sync API Key** (sama dengan `CLOUD_SYNC_API_KEY` di `Software/infra/.env`). Panduan lengkap: [CLOUD_SETUP.md](../CLOUD_SETUP.md).
- **Admin Cloud Server** (buat timbangan dari Electron): set `jwtSecret` di `config.json` sama dengan `JWT_SECRET` VPS (lihat CLOUD_SETUP).

### Lokasi file konfigurasi

| Mode | Lokasi | Use case |
|------|--------|----------|
| **Portable** | `config.json` di folder exe + folder `data/` | USB / copy folder |
| **User** | `%USERPROFILE%\.incoming-warehouse-electron\config.json` | Instal normal |

**Prioritas:** jika `config.json` ada di folder exe, dipakai mode portable.

Template: [config.example.json](config.example.json)

**Portable:** copy **seluruh folder** `win-unpacked`, jangan hanya exe — `resources/` wajib ada (API, web, gateway).

### Via UI

1. Buka Electron → **Settings** (`#/setting`)
2. **Cloud Server Configuration**: URL VPS + sync key → Test → Simpan
3. Login admin → **Cloud Server** untuk timbangan (setelah JWT/sync key sesuai panduan cloud)

### Via file

Edit `config.json` (lihat `config.example.json`), restart aplikasi.

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
│  BrowserWindow (Dashboard UI)       │
│  Process Manager                    │
│    ├─ API (SQLite, :4123)           │
│    └─ Gateway → local API           │
│  Config: cloud URL + sync key       │
└──────────────┬──────────────────────┘
               │ HTTPS /api/cloud/*
               ▼
        VPS: nginx → API → PostgreSQL
```

## Notes

- SQLite lokal untuk sesi/timbangan; VPS hanya untuk agregasi cloud (opsional)
- API di `localhost:4123`; Gateway tidak langsung ke VPS
- Config: portable folder atau `~/.incoming-warehouse-electron/config.json`

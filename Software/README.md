# Incoming Warehouse - Weighing System

Sistem penimbangan incoming: **Gateway ↔ API lokal**; agregasi multi-stasiun opsional via **VPS cloud API** ([CLOUD_SETUP.md](CLOUD_SETUP.md)).

## Struktur Proyek

- `Dashboard/api/` - NestJS API + WebSocket server (**Menggunakan PostgreSQL**)
- `Dashboard/web/` - React/Vite frontend
- `Gateway/app/` - Node.js Gateway (Serial → WebSocket) (**Menggunakan SQLite untuk config**)
- `infra/` - Docker Compose & Nginx configuration

## Database Requirements

### Dashboard/API
- **Dev / VPS Docker**: PostgreSQL (`wis_foom`, user `admin`)
- **Electron stasiun**: SQLite otomatis (lihat `electron-app/`)

### Gateway
- **SQLite** (otomatis dibuat, tidak perlu setup)
- Lokasi: `~/.incoming-warehouse-gateway.db`
- **TIDAK perlu PostgreSQL**

## 🚀 Quick Start

**Jalankan semua service sekaligus:**

**Windows:**
```powershell
.\start-dev.ps1
```

**Linux/macOS:**
```bash
chmod +x start-dev.sh stop-dev.sh
./start-dev.sh
```

Lihat [QUICK_START.md](QUICK_START.md) untuk detail lengkap.

## Setup Development

### Setup Awal (Hanya Pertama Kali)

```bash
# Install dependencies
npm install

# Setup database PostgreSQL (hanya untuk Dashboard/API)
cd Dashboard/api
npm run prisma:migrate:dev
npm run prisma:seed
```

### Menjalankan Services

**Opsi 1: Script Gabungan (Paling Mudah)**
```bash
# Windows
.\start-dev.ps1

# Linux/macOS
./start-dev.sh
```

**Opsi 2: Manual (3 Terminal Terpisah)**
```bash
# Terminal 1: API server (port 4123)
cd Dashboard/api && npm run start:dev

# Terminal 2: Web UI (port 4234)
cd Dashboard/web && npm run dev

# Terminal 3: Gateway (port 4124, opsional)
cd Gateway/app && npm run dev
```

## Production Deployment

- **VPS cloud (API-only)**: [CLOUD_SETUP.md](CLOUD_SETUP.md) + [infra/README.md](infra/README.md)
- **Electron stasiun**: [electron-app/README.md](electron-app/README.md), [ELECTRON_SETUP.md](ELECTRON_SETUP.md)

## Dokumentasi

- **[CLOUD_SETUP.md](CLOUD_SETUP.md)** - Pairing VPS ↔ Electron, deploy cloud
- **[QUICK_START.md](QUICK_START.md)** - Quick start dev (script gabungan)
- **[SETUP_LOCAL.md](SETUP_LOCAL.md)** - Setup lokal PostgreSQL + Vite
- **[VPS_DATABASE_SETUP.md](VPS_DATABASE_SETUP.md)** - Backup/migrasi Postgres di VPS
- **[IMPLEMENTATION.md](IMPLEMENTATION.md)** - Ringkasan implementasi
- `Gateway/app/README.md` - Dokumentasi Gateway

## Scripts Tersedia

- `start-dev.ps1` / `start-dev.sh` - Jalankan semua service sekaligus
- `stop-dev.ps1` / `stop-dev.sh` - Hentikan semua service
- `Gateway/app/scripts/setup-gateway.ps1` / `setup-gateway.sh` - Setup Gateway otomatis
- `Gateway/app/scripts/detect-ports.js` - Deteksi port serial (via `npm run detect-ports`)

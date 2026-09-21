# Cloud Server Setup Guide

VPS sebagai **penyimpanan cloud** (PostgreSQL + API). Stasiun timbang memakai **Electron + SQLite**; data timbangan disinkronkan ke VPS lewat HTTP API. UI dashboard **hanya di Electron**, bukan di browser VPS.

Lihat juga: [infra/README.md](infra/README.md) (Docker), [electron-app/config.example.json](electron-app/config.example.json) (template stasiun).

## Architecture

```
  ┌─────────────────────────────┐         HTTPS          ┌──────────────────────────┐
  │  PC timbang (Electron)      │   /api/cloud/readings  │  VPS                     │
  │  UI + API lokal (SQLite)    │ ─────────────────────► │  nginx → api → Postgres  │
  │  Settings → Cloud URL+key   │   X-Cloud-Sync-Key     │  (no web UI container)   │
  └─────────────────────────────┘                        └──────────────────────────┘
```

- **Sync**: setelah timbang dikonfirmasi, API lokal memanggil `POST {CLOUD_SERVER_URL}/api/cloud/readings` dengan header `X-Cloud-Sync-Key`.
- **Cloud Server di Electron**: UI memanggil API lokal (`localhost:4123`); API lokal meneruskan ke VPS (`/api/cloud/*`) saat mode *remote* (SQLite + URL cloud terisi).

## Pairing: VPS ↔ stasiun Electron

Isi nilai berikut **berpasangan** antara VPS dan setiap PC timbang.

| Setting | VPS (`Software/infra/.env`) | Stasiun (`config.json` / Settings → Cloud) | Harus sama? |
|--------|-----------------------------|---------------------------------------------|-------------|
| Cloud URL | — (tidak dipakai) | `cloud.serverUrl` → `CLOUD_SERVER_URL` | URL publik VPS, **tanpa** `/` di akhir (mis. `https://wis.moof-set.web.id`) |
| Sync key | `CLOUD_SYNC_API_KEY` | `cloud.syncApiKey` | **Ya** — wajib identik |
| Station ID | — | `cloud.stationId` (auto) | Unik per instalasi PC |
| JWT secret | `JWT_SECRET` | `jwtSecret` di `config.json` | **Ya**, jika admin membuat/mengubah timbangan lewat **Cloud Server** di Electron (lihat di bawah) |
| Gateway key | `GATEWAY_API_KEY` | `gatewayApiKey` (auto lokal) | **Tidak** — Gateway hanya ke API lokal |
| Admin password | `ADMIN_INITIAL_PASSWORD` | `adminInitialPassword` (lokal) | **Tidak** — database user terpisah (SQLite vs Postgres) |

### JWT dan halaman Cloud Server (admin)

Operasi **sinkron data** dan **daftar timbangan** memakai sync key. **Membuat / mengubah / menonaktifkan timbangan** di VPS membutuhkan JWT **admin** yang divalidasi di VPS. Electron meneruskan token login **lokal** ke VPS; signature harus valid dengan `JWT_SECRET` VPS.

**Opsi A (disarankan untuk admin Cloud Server dari Electron):** sebelum pertama kali menjalankan app (atau dengan edit manual), set di `config.json` stasiun:

```json
"jwtSecret": "<nilai persis JWT_SECRET di VPS .env>"
```

Lalu login ulang sebagai admin di Electron. Jika `jwtSecret` sudah pernah di-generate otomatis, ganti nilainya agar sama dengan VPS, simpan, restart app, login ulang.

**Opsi B:** buat timbangan langsung ke VPS (tanpa menyamakan JWT):

```bash
# Login VPS API (ganti URL dan password)
TOKEN=$(curl -s -X POST https://wis.moof-set.web.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_ADMIN_INITIAL_PASSWORD"}' | jq -r .access_token)

curl -s -X POST https://wis.moof-set.web.id/api/cloud/scales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Timbangan 1"}'
```

### Checklist setelah konfigurasi

1. VPS: `docker compose ps` → `postgres`, `api`, `nginx` healthy.
2. `curl -s https://your-vps/` → JSON stub cloud API; `curl -s https://your-vps/api/health` → OK.
3. Electron: Settings → Cloud → URL + sync key → **Test** → sukses.
4. Ada minimal satu timbangan di VPS (Electron Cloud Server atau curl di atas).
5. Timbang + konfirmasi → reading di Electron `cloudSyncedAt` terisi / data muncul di Cloud Server.

## Deploy with GitHub Actions

Push ke `main` (atau **Actions → Deploy cloud server → Run workflow**) mensinkronkan `Software/Dashboard/api` + `Software/infra` ke VPS lalu menjalankan Docker Compose.

### One-time VPS setup

1. Docker + Docker Compose di VPS.
2. Folder deploy (default `/opt/incoming-warehouse`) dan `.env` (tidak ditimpa CI):

```bash
sudo mkdir -p /opt/incoming-warehouse/Software/infra
sudo cp Software/infra/.env.example /opt/incoming-warehouse/Software/infra/.env
sudo nano /opt/incoming-warehouse/Software/infra/.env
```

Contoh isian wajib:

```bash
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-long-random-jwt-secret
GATEWAY_API_KEY=your-gateway-key
CLOUD_SYNC_API_KEY=your-cloud-sync-key
ADMIN_INITIAL_PASSWORD=your-admin-password
# Opsional; hampir tidak dipakai tanpa browser UI di VPS
CORS_ORIGIN=https://wis.moof-set.web.id
```

3. SSH deploy key GitHub Actions di `authorized_keys` untuk user yang menjalankan `docker compose`.

### GitHub secrets

| Name | Purpose |
|------|---------|
| `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` | Deploy SSH |
| `VPS_PORT` | Opsional, default 22 |
| `VPS_DEPLOY_PATH` | Variable, default `/opt/incoming-warehouse` |

Environment Actions: **`cloud`**.

### After deploy

1. Electron: **Settings → Cloud Server Configuration** — URL VPS + sync key (sama dengan `.env`).
2. Samakan `jwtSecret` jika admin mengelola timbangan dari Electron (lihat JWT di atas).
3. Login admin → **Cloud Server** → buat timbangan, atau gunakan curl.

Manual:

```bash
/opt/incoming-warehouse/Software/infra/scripts/deploy-cloud.sh
```

## VPS Setup (Docker, tanpa GitHub)

```bash
cd Software/infra
cp .env.example .env   # edit secrets
docker compose up -d --build
```

## Local Station Setup (Electron)

1. Salin [electron-app/config.example.json](electron-app/config.example.json) ke folder data/portable jika perlu.
2. **Settings → Cloud Server Configuration**:
   - **Cloud Server URL**: `https://your-vps.example.com` (no trailing slash)
   - **Cloud Sync API Key**: sama dengan `CLOUD_SYNC_API_KEY` di VPS
3. **Station ID** otomatis per instalasi.
4. Test connection → Incoming/Intrans → pilih timbangan sebelum konfirmasi sesi.

File config (portable: folder exe; normal: `%USERPROFILE%\.incoming-warehouse-electron\config.json`):

```json
{
  "jwtSecret": "same-as-vps-if-using-cloud-admin-ui",
  "cloud": {
    "serverUrl": "https://your-vps.example.com",
    "syncApiKey": "same-as-CLOUD_SYNC_API_KEY-on-vps",
    "stationId": ""
  }
}
```

## Environment variables (referensi)

| Variable | VPS | Stasiun (API lokal) |
|----------|-----|---------------------|
| `DATABASE_URL` | `postgresql://...postgres...` | `file:...` (SQLite, dari Electron) |
| `CLOUD_SERVER_URL` | — | URL VPS |
| `CLOUD_SYNC_API_KEY` | Validasi ingest + akses scales (sync) | Kirim ke VPS |
| `JWT_SECRET` | Token admin VPS | Token lokal; samakan dengan VPS untuk proxy admin cloud |
| `GATEWAY_API_KEY` | API VPS | Gateway → API lokal saja |
| `STATION_ID` | — | UUID stasiun |
| `CLOUD_SETTINGS_FILE` | Opsional | Default `data/cloud-settings.json` di folder data portable |

## API endpoints (cloud)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/cloud/scales` | JWT atau sync key | Daftar timbangan |
| `POST /api/cloud/scales` | Admin JWT (VPS) | Buat timbangan |
| `POST /api/cloud/readings` | Sync key | Terima hasil timbang |
| `GET /api/cloud/readings` | JWT | Query agregat |
| `GET /api/cloud/status` | JWT / sync (via proxy) | Kesehatan koneksi |
| `POST /api/cloud/sync/retry` | JWT lokal | Retry sync gagal (SQLite) |

## Troubleshooting

| Gejala | Periksa |
|--------|---------|
| Dropdown timbangan kosong | URL cloud, sync key, timbangan sudah dibuat di VPS |
| Test Cloud gagal | DNS/HTTPS, nginx, firewall, API healthy |
| Sync gagal (`cloudSyncError`) | Sync key; log API lokal; `POST /api/cloud/readings` dari VPS |
| Buat timbangan dari Electron gagal (401/403) | Samakan `jwtSecret` dengan VPS + login admin ulang, atau buat timbangan via curl VPS |
| Timbang diblokir | Pilih timbangan; cloud harus reachable |

## Dokumen terkait

- **[VPS_DATABASE_SETUP.md](VPS_DATABASE_SETUP.md)** — backup/restore PostgreSQL di VPS, migrasi (bukan koneksi Postgres langsung dari Electron).
- **[electron-app/README.md](electron-app/README.md)** — packaging dan config stasiun.
- **[ELECTRON_SETUP.md](ELECTRON_SETUP.md)** — dev/build Electron.

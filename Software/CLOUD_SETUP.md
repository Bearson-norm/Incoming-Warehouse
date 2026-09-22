# Cloud Server Setup Guide

VPS sebagai **penyimpanan cloud** (PostgreSQL + API). Stasiun timbang memakai **Electron + SQLite**; data disinkronkan lewat HTTP API. UI **hanya di Electron**.

Lihat: [infra/README.md](infra/README.md), [electron-app/config.example.json](electron-app/config.example.json).

## Architecture

```
  PC timbang (Electron)  ──HTTPS /api/cloud/*──►  VPS: nginx (host) → 127.0.0.1:4123 → api → Postgres
```

- **Sync**: `POST {CLOUD_SERVER_URL}/api/cloud/readings` + header `X-Cloud-Sync-Key`.
- **Docker default**: hanya `postgres` + `api`. **Nginx systemd di host** memakai port 80 (bukan container nginx).

## Nginx di VPS (host vs Docker)

| Situasi | File / langkah |
|---------|----------------|
| **ProductionDashboard** — nginx systemd sudah di `:80` | Pakai **`nginx/wis.moof-set.web.id.host.conf`**, bukan `wis.moof-set.web.id.conf` |
| VPS tanpa web server | `docker compose --profile docker-nginx up -d` + `wis.moof-set.web.id.conf` |

**Penting:** Mengedit `infra/nginx/wis.moof-set.web.id.conf` dengan `nano` **belum** mengaktifkan nginx. File itu untuk container Docker (`server api:4123`). Nginx host harus proxy ke **`127.0.0.1:4123`**.

**Aktifkan nginx host** (path contoh `/opt/Incoming-Warehouse/Software/infra`):

```bash
cd /opt/Incoming-Warehouse/Software/infra
chmod +x scripts/install-host-nginx.sh
sudo ./scripts/install-host-nginx.sh
```

Manual:

```bash
sudo cp nginx/wis.moof-set.web.id.host.conf /etc/nginx/sites-available/wis.moof-set.web.id
sudo ln -sf /etc/nginx/sites-available/wis.moof-set.web.id /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
docker rm -f incoming-warehouse-nginx 2>/dev/null || true
```

Verifikasi:

```bash
curl -s http://127.0.0.1:4123/api/health
curl -s http://wis.moof-set.web.id/api/health
```

**Electron Cloud Server URL:** `http://wis.moof-set.web.id` atau `https://wis.moof-set.web.id` (tanpa `/` di akhir, tanpa `/api`).

Detail: [infra/nginx/README.md](infra/nginx/README.md).

## Pairing: VPS ↔ Electron

| Setting | VPS (`.env`) | Stasiun (Settings / `config.json`) | Sama? |
|--------|--------------|-------------------------------------|-------|
| Cloud URL | — | `cloud.serverUrl` | URL publik, tanpa `/` di akhir |
| Sync key | `CLOUD_SYNC_API_KEY` | `cloud.syncApiKey` | **Ya** |
| JWT | `JWT_SECRET` | `jwtSecret` | **Ya** jika admin kelola timbangan dari Electron Cloud Server |
| Gateway | `GATEWAY_API_KEY` | lokal (auto) | Tidak |

### JWT admin (Cloud Server di Electron)

Buat/ubah timbangan di VPS membutuhkan JWT yang valid di VPS. Set `jwtSecret` di `config.json` **sama** dengan `JWT_SECRET` VPS, restart app, login ulang.

Alternatif: buat timbangan via `POST /api/cloud/scales` setelah login ke API VPS (curl).

### Checklist

1. `docker compose ps` → `postgres`, `api` up; API health OK di `127.0.0.1:4123`.
2. Host nginx: `curl -s https://your-domain/api/health`.
3. Electron: Cloud URL + sync key → Test.
4. Minimal satu timbangan di cloud.
5. Timbang → `cloudSyncedAt` terisi.

## Deploy

### `.env` wajib (VPS)

```bash
POSTGRES_PASSWORD=...
JWT_SECRET=...
GATEWAY_API_KEY=...
CLOUD_SYNC_API_KEY=...
ADMIN_INITIAL_PASSWORD=...
CORS_ORIGIN=https://wis.moof-set.web.id
```

Generate secret: `openssl rand -hex 32` (nilai berbeda per variabel).

### Docker

```bash
cd Software/infra
docker compose up -d --build
```

Setelah ubah Dockerfile/API: `docker compose build --no-cache api && docker compose up -d api`.

GitHub Actions: **Deploy cloud server** — sync `Dashboard/api` + `infra`, jalankan `deploy-cloud.sh`.

### Electron

Settings → **Cloud Server Configuration** → URL + sync key (sama dengan VPS).

## Troubleshooting

| Gejala | Perbaikan |
|--------|-----------|
| `docker compose ps` hanya **postgres**, tidak ada **api** | `docker compose up -d api` lalu `docker compose logs api --tail 50`. Sering karena migrasi Prisma gagal — lihat baris bawah. |
| Migrasi `User already exists` (P3018) | `migrate resolve --rolled-back` + `--applied` untuk `20260917120000_init_postgresql`, lalu `migrate deploy` (lihat chat/docs migrasi legacy). |
| `curl 127.0.0.1:4123` kosong | API container tidak jalan — perbaiki log API dulu; nginx tidak bisa proxy tanpa backend. |
| Domain `/api/health` **404** nginx Ubuntu | (1) API belum up → 502/404 tergantung config. (2) **default site** menang: `sudo rm /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx`. (3) Uji: `curl -s -H "Host: wis.moof-set.web.id" http://127.0.0.1/api/health`. |
| `Bind for 0.0.0.0:80 failed` | Jangan start profile `docker-nginx`; pakai host nginx + `install-host-nginx.sh` |
| `Cannot find module '/app/dist/main'` | Rebuild API image setelah fix `start:prod` → `node dist/src/main`; `docker compose build --no-cache api && docker compose up -d api` |

Diagnosis cepat di VPS:

```bash
cd /opt/Incoming-Warehouse/Software/infra
chmod +x scripts/verify-cloud-stack.sh
./scripts/verify-cloud-stack.sh
```

Urutan perbaikan tipikal (ProductionDashboard):

```bash
cd /opt/Incoming-Warehouse/Software/infra

# 1) Perbaiki migrasi jika API crash (DB lama)
docker compose run --rm api npx prisma migrate resolve --rolled-back 20260917120000_init_postgresql
docker compose run --rm api npx prisma migrate resolve --applied 20260917120000_init_postgresql
docker compose run --rm api npx prisma migrate deploy

# 2) Start API
docker compose up -d api
curl -s http://127.0.0.1:4123/api/health

# 3) Nginx — hapus default jika /api/health 404
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
curl -s http://wis.moof-set.web.id/api/health
```

## Dokumen terkait

- [VPS_DATABASE_SETUP.md](VPS_DATABASE_SETUP.md) — backup/restore Postgres
- [electron-app/README.md](electron-app/README.md)
- [ELECTRON_SETUP.md](ELECTRON_SETUP.md)

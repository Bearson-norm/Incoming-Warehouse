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

| Situasi | Yang dijalankan |
|---------|-----------------|
| Sudah ada **nginx/apache** di `:80` (umum) | `docker compose up -d` + config host → [infra/nginx/wis.moof-set.web.id.host.conf](infra/nginx/wis.moof-set.web.id.host.conf) |
| VPS kosong, belum ada web server | `docker compose --profile docker-nginx up -d` |

**Host nginx (disarankan):**

```bash
sudo cp Software/infra/nginx/wis.moof-set.web.id.host.conf /etc/nginx/sites-available/wis.moof-set.web.id
sudo ln -sf /etc/nginx/sites-available/wis.moof-set.web.id /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
docker rm -f incoming-warehouse-nginx 2>/dev/null || true
```

API harus listen di host: `curl -s http://127.0.0.1:4123/api/health`.

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
| `Bind for 0.0.0.0:80 failed` | Jangan start profile `docker-nginx`; pakai nginx host + `wis.moof-set.web.id.host.conf` |
| `Bind for 5432 failed` | Compose tidak publish Postgres ke host; stop container lama atau postgres OS jika masih map manual |
| API `Exited (1)`, Prisma/OpenSSL | Rebuild API image (Dockerfile memakai `node:18-bookworm-slim` + openssl) |
| `curl 127.0.0.1:4123` gagal | `docker compose logs api --tail 80` |
| 502 dari domain | Host nginx belum proxy ke `127.0.0.1:4123` atau API down |

## Dokumen terkait

- [VPS_DATABASE_SETUP.md](VPS_DATABASE_SETUP.md) — backup/restore Postgres
- [electron-app/README.md](electron-app/README.md)
- [ELECTRON_SETUP.md](ELECTRON_SETUP.md)

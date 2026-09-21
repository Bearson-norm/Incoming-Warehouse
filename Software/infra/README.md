# Infrastructure

Docker Compose untuk **VPS cloud**: `postgres` + `api` (default). **Nginx systemd di host** mem-proxy ke `127.0.0.1:4123`. Pairing Electron: **[CLOUD_SETUP.md](../CLOUD_SETUP.md)**.

## Setup

1. Copy `.env.example` ke `.env` dan isi secret.
2. Start stack (tanpa nginx container):

```bash
docker compose up -d --build
```

3. Konfigurasi **nginx host** (jika belum): lihat `nginx/wis.moof-set.web.id.host.conf`.

4. Verifikasi:

```bash
curl -s http://127.0.0.1:4123/api/health
curl -s http://wis.moof-set.web.id/api/health   # via host nginx
```

Migrasi dan seed admin awal dijalankan otomatis saat container `api` start.

## Services

| Service | Default | Catatan |
|---------|---------|---------|
| **postgres** | Ya | Tanpa publish port ke host (hindari bentrok :5432) |
| **api** | Ya | `127.0.0.1:4123` di host |
| **nginx** (Docker) | Tidak | Profile `docker-nginx` — hanya VPS tanpa nginx host |

### Nginx di Docker (opsional)

Hanya jika **tidak** ada nginx/apache di port 80:

```bash
docker compose --profile docker-nginx up -d --build
```

Pakai `nginx/wis.moof-set.web.id.conf` (upstream `api:4123`).

### Nginx di host (disarankan)

1. Salin `nginx/wis.moof-set.web.id.host.conf` ke `/etc/nginx/sites-available/`.
2. `sudo ln -s .../sites-enabled/`
3. `sudo nginx -t && sudo systemctl reload nginx`

Hapus container nginx lama jika pernah dibuat:

```bash
docker rm -f incoming-warehouse-nginx 2>/dev/null || true
```

## Deploy script

```bash
./scripts/deploy-cloud.sh
```

Menjalankan `docker compose up -d --build --remove-orphans` (postgres + api saja).

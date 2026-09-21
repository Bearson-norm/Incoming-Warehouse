# Infrastructure

Docker Compose untuk **VPS cloud** (`postgres` + `api` + `nginx`, tanpa container web). Pairing dengan stasiun Electron: **[CLOUD_SETUP.md](../CLOUD_SETUP.md)**.

## Setup

1. Copy `.env.example` ke `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` dan set secret keys:
- `JWT_SECRET`: Secret untuk JWT token
- `GATEWAY_API_KEY`: API key untuk gateway authentication
- `POSTGRES_PASSWORD`, `CLOUD_SYNC_API_KEY`, dll.

3. Start services:
```bash
docker compose up -d --build
```

4. Run database migrations (jika belum dijalankan otomatis saat API start):
```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run prisma:seed
```

## Services

- **postgres**: PostgreSQL database (port 5432, bound to localhost on host)
- **api**: NestJS API server (port 4123)
- **nginx**: Reverse proxy (port 80/443)

## Nginx Configuration

Nginx reverse proxy mengarahkan:
- `/api` → API server (port 4123)
- `/socket.io` → WebSocket server (port 4123)
- `/` → JSON stub (cloud API-only; tidak ada web UI di VPS)

## Domain

Domain `wis.moof-set.web.id` dikonfigurasi di `nginx/wis.moof-set.web.id.conf`.

## SSL/HTTPS

Untuk mengaktifkan HTTPS, uncomment bagian SSL di file nginx config dan sediakan sertifikat SSL.

## Deploy script

```bash
./scripts/deploy-cloud.sh
```

Menggunakan `docker compose up -d --build --remove-orphans` sehingga container lama (mis. `web`) ikut dihapus setelah upgrade compose.

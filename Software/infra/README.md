# Infrastructure

Docker Compose setup untuk deployment sistem.

## Setup

1. Copy `.env.example` ke `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` dan set secret keys:
- `JWT_SECRET`: Secret untuk JWT token
- `GATEWAY_API_KEY`: API key untuk gateway authentication

3. Start services:
```bash
docker-compose up -d
```

4. Run database migrations:
```bash
docker-compose exec api npx prisma migrate deploy
docker-compose exec api npm run prisma:seed
```

## Services

- **postgres**: PostgreSQL database (port 5432)
- **api**: NestJS API server (port 4123)
- **web**: React web UI (port 4234)
- **nginx**: Reverse proxy (port 80/443)

## Nginx Configuration

Nginx reverse proxy mengarahkan:
- `/api` → API server (port 4123)
- `/socket.io` → WebSocket server (port 4123)
- `/` → Web UI (port 4234)

## Domain

Domain `wis.moof-set.web.id` dikonfigurasi di `nginx/wis.moof-set.web.id.conf`.

## SSL/HTTPS

Untuk mengaktifkan HTTPS, uncomment bagian SSL di file nginx config dan sediakan sertifikat SSL.

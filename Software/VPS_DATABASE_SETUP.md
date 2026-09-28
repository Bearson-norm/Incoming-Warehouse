# VPS PostgreSQL Database Setup Guide

> **Arsitektur produksi saat ini:** stasiun timbang memakai **Electron + SQLite**; VPS menjalankan **PostgreSQL + API + nginx** untuk cloud sync. Electron **tidak** membuka koneksi PostgreSQL langsung ke VPS. Mulai dari [CLOUD_SETUP.md](CLOUD_SETUP.md) untuk deploy dan pairing URL/sync key.

Panduan ini untuk **administrasi PostgreSQL di VPS** (Docker Compose, backup/restore, migrasi) dan skenario dev yang menjalankan API di VPS dengan `DATABASE_URL=postgresql://...`.

---

## Option A: Docker (Recommended for VPS)

Your project already has Docker Compose configured with PostgreSQL (admin/admin123, database: wis_foom).

### 1. On your VPS, ensure Docker is installed

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose
sudo systemctl enable docker && sudo systemctl start docker
```

### 2. Copy project files to VPS

Copy the `infra` folder and `Dashboard/api` (for migrations) to your VPS. You can also use the helper script `scripts/dump-local-db.ps1` to dump your local DB, then `scripts/vps-setup-db.sh` for native PostgreSQL setup on the VPS.

### 3. Create `.env` in infra folder

```bash
cd infra
cat > .env << 'EOF'
JWT_SECRET=your-secure-random-secret-here
GATEWAY_API_KEY=your-secure-gateway-api-key-here
EOF
```

### 4. Start PostgreSQL only (if you want DB first)

```bash
docker-compose up -d postgres
```

Wait ~10 seconds for PostgreSQL to be ready, then run migrations and seed.

---

## Option B: Native PostgreSQL on VPS

If you prefer PostgreSQL installed directly (not Docker):

### 1. Install PostgreSQL on VPS

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create user and database

```bash
sudo -u postgres psql << 'EOF'
CREATE USER admin WITH PASSWORD 'admin123';
CREATE DATABASE wis_foom OWNER admin;
GRANT ALL PRIVILEGES ON DATABASE wis_foom TO admin;
\c wis_foom
GRANT ALL ON SCHEMA public TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
EOF
```

### 3. Allow remote connections (if API runs on different host)

Edit `postgresql.conf`:
```bash
sudo nano /etc/postgresql/15/main/postgresql.conf
# Set: listen_addresses = '*'  (or your VPS IP)
```

Edit `pg_hba.conf`:
```bash
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Add: host  wis_foom  admin  0.0.0.0/0  md5
```

Restart:
```bash
sudo systemctl restart postgresql
```

---

## Migrating Local Data to VPS (Exact Copy)

To copy your **local database content as-is** to the VPS:

### Step 1: Dump from local database

On your **Windows machine** (where local PostgreSQL runs):

```powershell
# Using pg_dump - creates a full backup including schema and data
pg_dump -U admin -h localhost -d wis_foom --no-owner --no-acl -F c -f wis_foom_backup.dump

# Or as plain SQL (easier to inspect):
pg_dump -U admin -h localhost -d wis_foom --no-owner --no-acl -f wis_foom_backup.sql
```

If you use Docker locally:
```powershell
docker exec incoming-warehouse-db pg_dump -U admin -d wis_foom --no-owner --no-acl -F c > wis_foom_backup.dump
```

### Step 2: Copy dump file to VPS

```bash
scp wis_foom_backup.dump user@your-vps-ip:/home/user/
# or
scp wis_foom_backup.sql user@your-vps-ip:/home/user/
```

### Step 3: Restore on VPS

**If using Docker on VPS:**
```bash
# Copy dump into container
docker cp wis_foom_backup.dump incoming-warehouse-db:/tmp/

# Restore
docker exec -it incoming-warehouse-db pg_restore -U admin -d wis_foom --no-owner --no-acl --clean --if-exists /tmp/wis_foom_backup.dump

# For .sql file instead:
docker exec -i incoming-warehouse-db psql -U admin -d wis_foom < wis_foom_backup.sql
```

**If using native PostgreSQL on VPS:**
```bash
# Custom format (.dump)
pg_restore -U admin -h localhost -d wis_foom --no-owner --no-acl --clean --if-exists wis_foom_backup.dump

# Plain SQL
psql -U admin -h localhost -d wis_foom -f wis_foom_backup.sql
```

---

## Fresh Setup (Schema + Seed Only)

If you don't need to copy existing data, just want schema + default seed:

### 1. Set DATABASE_URL on VPS

```bash
export DATABASE_URL="postgresql://admin:admin123@localhost:5432/wis_foom?schema=public"
# Or if API runs in Docker: postgresql://admin:admin123@postgres:5432/wis_foom?schema=public
```

### 2. Run migrations and seed

From your project (locally, pointing to VPS DB):

```powershell
cd Dashboard/api
$env:DATABASE_URL="postgresql://admin:admin123@YOUR_VPS_IP:5432/wis_foom?schema=public"
npx prisma migrate deploy
npm run prisma:seed
```

Or from inside Docker on VPS:

```bash
docker-compose exec api npx prisma migrate deploy
docker-compose exec api npm run prisma:seed
```

**Di VPS (tanpa Docker):** jalankan sebagai user deploy (`foom`). **Jangan** `sudo npm install` di `/opt/...` — itu membuat folder `root`, user `foom` dapat **EACCES**, dan install **seluruh monorepo** (web + Electron) bisa memenuhi disk (**ENOSPC**).

### Perbaiki hak akses & ruang disk (sekali)

`docker compose build api` gagal dengan **ENOSPC** = disk penuh (sering karena `npm ci` + cache Docker + install monorepo gagal).

```bash
df -h
sudo du -sh /var/lib/docker/* 2>/dev/null | sort -h | tail -5
sudo du -sh /opt/Incoming-Warehouse/Software/node_modules 2>/dev/null || true

# Hapus install npm gagal di host
sudo rm -rf /opt/Incoming-Warehouse/Software/node_modules
sudo chown -R foom:foom /opt/Incoming-Warehouse

# Kosongkan cache (butuh beberapa GB kosong untuk build API)
sudo docker builder prune -af
sudo docker system prune -af   # hapus image/container tidak terpakai — API akan di-build ulang
sudo npm cache clean --force

df -h
```

Target: **≥ 3–4 GB kosong** sebelum `docker compose build api`.

### Migrasi + seed (hanya paket API — disarankan di VPS)

Jangan `npm install` di `Software/` kecuali Anda memang build semua workspace di server. Cukup dependensi **Dashboard/api**:

```bash
cd /opt/Incoming-Warehouse
git pull

cd Software/Dashboard/api
npm run install:vps-api-only
# atau: bash scripts/vps-api-deps.sh

export DATABASE_URL="postgresql://admin:PASSWORD@localhost:5432/wis_foom?schema=public"
npm run prisma:migrate:deploy
npm run seed:products
```

Prisma CLI ada di `Dashboard/api/node_modules/.bin/prisma` (versi **5.22.x**). Jangan jawab **Y** jika `npx` menawarkan **prisma@8.x**.

### Alternatif: Docker (tanpa npm di host)

Setelah `git pull`, **rebuild image** supaya `seed:products` dan CSV ikut masuk container:

```bash
cd /opt/Incoming-Warehouse
git pull
cd Software/infra
docker compose build api
docker compose up -d api
docker compose exec api npm run prisma:migrate:deploy
docker compose exec api npm run seed:products
```

`No pending migrations` = migrasi sudah terpasang. `Missing script: seed:products` = image API lama — jalankan `docker compose build api` lagi.

### Seed tanpa rebuild image (disk penuh / build gagal)

Pakai image API yang **sudah jalan**, mount CSV + script dari `git`:

```bash
cd /opt/Incoming-Warehouse
# Jika git pull gagal karena file script diedit di server:
git checkout -- Software/infra/scripts/seed-products-mount.sh
git pull

chmod +x Software/infra/scripts/seed-products-mount.sh
Software/infra/scripts/seed-products-mount.sh
```

Jika `docker compose build api` gagal **lookup registry-1.docker.io / i/o timeout**, itu masalah DNS/jaringan VPS ke Docker Hub — coba lagi nanti atau perbaiki DNS (`/etc/resolv.conf`). Seed mount **tidak** butuh build/pull image baru.

Script ini menjalankan `npm run install:vps-api-only` + `build:scripts` + `prisma generate` di `Dashboard/api`, lalu import lewat jaringan Docker. **`prisma generate` menulis ke `Software/node_modules`** (npm workspace); script mem-mount folder itu ke `/app/node_modules` di container.

Setelah seed berhasil, **rebuild image API** saat disk cukup — container yang masih lama tidak bisa memakai relasi vendor–RM di runtime sampai di-build ulang dari kode terbaru.

### Development laptop (monorepo penuh)

```bash
cd Software
npm install
npm run prisma:migrate:deploy --workspace=@incoming-warehouse/api
```

---

## Local Device → VPS Database Connection

To connect your **local device** (development or Electron app) to the **VPS database**:

### Development mode (npm run dev:api / dev:web)

Edit `Dashboard/api/.env`:

```
DATABASE_URL="postgresql://admin:admin123@YOUR_VPS_IP:5433/wis_foom?schema=public"
```

Replace `YOUR_VPS_IP` with your VPS IP (e.g. `103.31.39.189`). Use port `5433` if PostgreSQL listens on that port on the VPS.

### Electron app (standalone)

**Option 1 – Via UI:** Open the app → Login page → "Configure Database" → enter Host (VPS IP), Port (5433), Database (wis_foom), Username (admin), Password (admin123).

**Option 2 – Via config file:** Copy `electron-app/config.example.json` to `config.json` (next to the exe for portable) or `~/.incoming-warehouse-electron/config.json` (user install). Update `host` and `port` if needed.

### Firewall

Ensure the VPS firewall allows inbound connections on the PostgreSQL port (5432 or 5433):

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 5433/tcp
sudo ufw reload
```

---

## Connection String Reference

| Scenario | DATABASE_URL |
|----------|--------------|
| Local PostgreSQL | `postgresql://admin:admin123@localhost:5432/wis_foom?schema=public` |
| VPS (API in same Docker network) | `postgresql://admin:admin123@postgres:5432/wis_foom?schema=public` |
| **Local device → VPS** | `postgresql://admin:admin123@VPS_IP:5433/wis_foom?schema=public` |

---

## Verify Setup

```bash
# Test connection
psql "postgresql://admin:admin123@YOUR_VPS_IP:5432/wis_foom" -c "\dt"

# Should list: User, Vendor, Packaging, WeighSession, WeighReading, Gateway
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `pg_restore` fails with "relation does not exist" | Use `--clean --if-exists` or drop/recreate DB first |
| Connection refused | Check firewall (port 5432), `listen_addresses`, `pg_hba.conf` |
| Authentication failed | Verify password, ensure `pg_hba.conf` allows md5 for admin |
| Docker: API can't connect to postgres | Ensure both in same `docker-compose` network; use hostname `postgres` |

---

## Audit, retention, and recovery

Migration `20260923150000_cloud_audit_master_data` adds canonical cloud IDs, revision
control, soft delete, `MasterDataAuditEvent`, and `LpnTraceEvent`. Deploy it before
stations running the matching Electron release begin master-data sync:

```bash
docker compose run --rm api npx prisma migrate deploy
docker compose up -d api
```

Operational guidance:

1. Back up PostgreSQL before migration and test restore on staging.
2. Use a restricted runtime DB role. Only the migration role should own/alter tables.
3. Do not grant application users direct SQL access to audit tables.
4. Back up audit and trace tables on the same schedule as weighing records.
5. Define retention with Finance/Compliance; soft-deleted master records must remain at
   least as long as weigh records that reference their snapshots.
6. After restore, verify counts and sample one LPN across `CloudWeighReading` and
   `LpnTraceEvent`, then verify its exported SHA-256 manifest.

`MasterDataAuditEvent` is append-only by application design. PostgreSQL superusers can
still alter it; for stronger non-repudiation, archive signed exports or database backups
to immutable/WORM storage managed outside the application account.

### Data lineage

- `capturedAt` / trace `sourceAt`: source device time.
- `syncedAt` / trace `receivedAt`: VPS receipt time.
- `stationId + localReadingId`: idempotency key for weighing records.
- `stationId + localEventId`: idempotency key for trace events.
- `*Snapshot`: value used when the transaction occurred.
- `*CloudId`: reference used to resolve the current canonical master-data name.
- `revision`: optimistic-lock version; skipped revisions indicate a defect and should be
  investigated.

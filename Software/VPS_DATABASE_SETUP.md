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

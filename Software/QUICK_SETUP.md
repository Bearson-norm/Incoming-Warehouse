# ⚡ Quick Setup - Incoming Warehouse System

## Status Setup Saat Ini ✅

- ✅ Node.js v22.20.0 terinstall
- ✅ npm 10.9.3 terinstall  
- ✅ Dependencies Dashboard/web terinstall
- ✅ Dependencies Dashboard/api terinstall
- ✅ File `.env` perlu dibuat manual (lihat langkah 2)

## 🚀 Langkah Setup Cepat

### 1. Buat File .env untuk API

Buat file `Dashboard/api/.env` dengan isi berikut:

```env
DATABASE_URL="postgresql://admin:admin123@localhost:5432/wis_foom?schema=public"
PORT=4123
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production-please-use-strong-random-string
JWT_EXPIRES_IN=24h
GATEWAY_API_KEY=your-gateway-api-key-change-in-production
CORS_ORIGIN=http://localhost:4234
```

**Cara membuat:**
```powershell
cd Dashboard/api
New-Item -Path .env -ItemType File -Force
# Lalu edit file .env dan paste isi di atas
```

### 2. Setup PostgreSQL Database

#### Opsi A: Menggunakan Script PowerShell (Paling Mudah)

```powershell
cd Dashboard/api
.\setup-database.ps1
```

#### Opsi B: Menggunakan Docker (Jika PostgreSQL belum terinstall)

```powershell
docker run --name incoming-warehouse-db `
  -e POSTGRES_DB=wis_foom `
  -e POSTGRES_USER=admin `
  -e POSTGRES_PASSWORD=admin123 `
  -p 5432:5432 `
  -d postgres:15-alpine
```

#### Opsi C: Setup Manual

```powershell
# Login ke PostgreSQL
psql -U postgres -h localhost

# Di dalam psql, jalankan:
CREATE USER admin WITH PASSWORD 'admin123';
CREATE DATABASE wis_foom OWNER admin;
GRANT ALL PRIVILEGES ON DATABASE wis_foom TO admin;
\q

# Grant schema privileges
psql -U postgres -h localhost -d wis_foom
GRANT ALL ON SCHEMA public TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
\q
```

### 3. Setup Database Schema

```powershell
cd Dashboard/api

# Generate Prisma Client
npm run prisma:generate

# Run migrations (membuat tables)
npm run prisma:migrate:dev

# Seed database (membuat user admin default)
npm run prisma:seed
```

**User default yang dibuat:**
- Username: `admin`
- Password: `admin123`

### 4. Menjalankan Sistem

#### Cara 1: Menggunakan Script Quick Start (Paling Mudah)

```powershell
# Dari root directory Software/
.\start-dev.ps1
```

Ini akan membuka 2 terminal window:
- Terminal 1: API Server (http://localhost:4123)
- Terminal 2: Web UI (http://localhost:4234)

#### Cara 2: Manual (2 Terminal Terpisah)

**Terminal 1 - API Server:**
```powershell
cd Dashboard/api
npm run start:dev
```

**Terminal 2 - Web UI:**
```powershell
cd Dashboard/web
npm run dev
```

### 5. Akses Sistem

1. **Buka browser:** http://localhost:4234
2. **Login dengan:**
   - Username: `admin`
   - Password: `admin123`

## ✅ Verifikasi Setup

### Cek API Health
```powershell
curl http://localhost:4123/api/health
```

Harus return: `{"status":"ok","timestamp":"..."}`

### Cek Web UI
Buka: http://localhost:4234

## 🔧 Troubleshooting

### Error: "Connection refused" saat migration
**Solusi:**
- Pastikan PostgreSQL service berjalan
- Windows: Buka Services → Start "postgresql-x64-15"
- Atau jalankan: `pg_ctl start` dari bin directory PostgreSQL

### Error: "Database wis_foom does not exist"
**Solusi:**
- Jalankan setup database (langkah 2)
- Atau ubah nama database di `.env` sesuai yang ada

### Error: "Port 4123 already in use"
**Solusi:**
- Tutup aplikasi lain yang menggunakan port 4123
- Atau ubah PORT di `.env`

### Error: "Cannot find module"
**Solusi:**
```powershell
# Hapus node_modules dan install ulang
cd Dashboard/api
Remove-Item -Recurse -Force node_modules
npm install

cd ../web
Remove-Item -Recurse -Force node_modules
npm install
```

## 📝 Next Steps

Setelah setup berhasil:

1. ✅ Login ke Web UI dengan `admin/admin123`
2. ✅ Buat Vendor di halaman Database
3. ✅ Buat Packaging untuk vendor tersebut
4. ✅ Test Dashboard di halaman Home
5. ✅ Test Recording Action di halaman Recording Action

## 📚 Dokumentasi Lengkap

Lihat `SETUP_GUIDE.md` untuk panduan lebih detail.

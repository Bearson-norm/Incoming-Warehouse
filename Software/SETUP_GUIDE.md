# 🚀 Panduan Setup Sistem Incoming Warehouse

## ✅ Prerequisites (Sudah Terpenuhi)
- ✅ Node.js v22.20.0 (sudah terinstall)
- ✅ npm 10.9.3 (sudah terinstall)

## 📋 Langkah-langkah Setup

### 1. Install Dependencies ✅
Dependencies untuk Dashboard/web sudah terinstall.

### 2. Setup PostgreSQL Database

#### Opsi A: Menggunakan PostgreSQL Lokal

1. **Pastikan PostgreSQL sudah terinstall dan berjalan**
   - Windows: Buka Services → Start "postgresql-x64-15" (atau versi Anda)
   - Atau jalankan: `pg_ctl start` dari bin directory PostgreSQL

2. **Setup Database menggunakan script PowerShell:**
   ```powershell
   cd Dashboard/api
   .\setup-database.ps1
   ```

3. **Atau setup manual:**
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

#### Opsi B: Menggunakan Docker (Lebih Mudah)

```powershell
# Jalankan PostgreSQL di Docker
docker run --name incoming-warehouse-db `
  -e POSTGRES_DB=wis_foom `
  -e POSTGRES_USER=admin `
  -e POSTGRES_PASSWORD=admin123 `
  -p 5432:5432 `
  -d postgres:15-alpine

# Cek apakah berjalan
docker ps
```

### 3. Setup Environment Variables ✅
File `.env` sudah dibuat di `Dashboard/api/.env` dengan konfigurasi default.

**Catatan:** Jika menggunakan kredensial database yang berbeda, edit file `.env` tersebut.

### 4. Setup Database Schema

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

### 5. Install Dependencies untuk API (jika belum)

```powershell
cd Dashboard/api
npm install
```

### 6. Menjalankan Sistem

#### Terminal 1: API Server
```powershell
cd Dashboard/api
npm run start:dev
```
API akan berjalan di: http://localhost:4123

#### Terminal 2: Web UI
```powershell
cd Dashboard/web
npm run dev
```
Web akan berjalan di: http://localhost:4234

### 7. Verifikasi Setup

1. **Cek API Health:**
   ```powershell
   curl http://localhost:4123/api/health
   ```
   Harus return: `{"status":"ok","timestamp":"..."}`

2. **Buka Web UI:**
   - Buka browser: http://localhost:4234
   - Login dengan:
     - Username: `admin`
     - Password: `admin123`

## 🔧 Troubleshooting

### Error: "Connection refused" saat migration
- Pastikan PostgreSQL service berjalan
- Cek port 5432 tidak digunakan aplikasi lain
- Cek credentials di `.env` sesuai dengan PostgreSQL

### Error: "Database wis_foom does not exist"
- Buat database terlebih dahulu (lihat Step 2)
- Atau ubah nama database di `.env` sesuai yang ada

### Error: "Port 4123 already in use"
- Tutup aplikasi lain yang menggunakan port 4123
- Atau ubah PORT di `.env`

### Error: "Cannot find module" saat npm install
- Hapus `node_modules` dan `package-lock.json`
- Jalankan `npm install` lagi

## 📝 Next Steps Setelah Setup

1. **Login ke Web UI** dengan `admin/admin123`
2. **Buat Vendor** di halaman Database
3. **Buat Packaging** untuk vendor tersebut
4. **Test Dashboard** di halaman Home
5. **Test Recording Action** di halaman Recording Action

## 🎯 Quick Start Script

Untuk memudahkan, buat file `start-dev.ps1` di root directory:

```powershell
# Start API
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Dashboard/api; npm run start:dev"

# Start Web
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Dashboard/web; npm run dev"

Write-Host "API: http://localhost:4123" -ForegroundColor Green
Write-Host "Web: http://localhost:4234" -ForegroundColor Green
```

Jalankan: `.\start-dev.ps1`

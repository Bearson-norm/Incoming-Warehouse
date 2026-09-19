# Setup Lokal - Incoming Warehouse Weighing System

Panduan lengkap untuk menjalankan sistem di local development.

## Prerequisites (Yang Harus Diinstall)

### 1. Node.js & npm
- **Node.js**: Versi 18 atau lebih tinggi
- **npm**: Versi 9 atau lebih tinggi
- Download: https://nodejs.org/

Cek versi:
```bash
node --version  # Harus >= 18.0.0
npm --version   # Harus >= 9.0.0
```

### 2. PostgreSQL (Hanya untuk Dashboard/API)
- **PostgreSQL**: Versi 15 atau lebih tinggi
- **Hanya diperlukan untuk Dashboard/API**, Gateway tidak perlu PostgreSQL
- Download: https://www.postgresql.org/download/
- Atau gunakan Docker (lebih mudah)

**Windows**: Download installer dari website PostgreSQL
**Linux**: `sudo apt-get install postgresql postgresql-contrib`
**macOS**: `brew install postgresql`

**Catatan**: Gateway menggunakan SQLite untuk menyimpan konfigurasi lokal (tidak perlu PostgreSQL).

### 3. Git (Optional)
- Untuk clone repository jika belum ada

## Step-by-Step Setup

### Step 1: Install Dependencies

```bash
# Dari root directory Software/
npm install
```

Ini akan menginstall dependencies untuk semua workspace (API, Web, Gateway).

### Step 2: Setup PostgreSQL Database

#### Opsi A: Menggunakan PostgreSQL Lokal

1. **Start PostgreSQL service:**
   ```bash
   # Windows (Services)
   # Buka Services → Start "postgresql-x64-15" (atau versi Anda)
   
   # Linux
   sudo systemctl start postgresql
   
   # macOS
   brew services start postgresql
   ```

2. **Buat database dan user:**
   ```bash
   # Login ke PostgreSQL sebagai superuser
   psql -U postgres
   
   # Atau di Windows, gunakan:
   psql -U postgres -h localhost
   ```

3. **Di dalam psql, jalankan:**
   ```sql
   -- Buat user admin (jika belum ada)
   CREATE USER admin WITH PASSWORD 'admin123';
   
   -- Buat database
   CREATE DATABASE wis_foom OWNER admin;
   
   -- Berikan privileges
   GRANT ALL PRIVILEGES ON DATABASE wis_foom TO admin;
   
   -- Exit
   \q
   ```

#### Opsi B: Menggunakan Docker (Lebih Mudah)

```bash
# Jalankan PostgreSQL di Docker
docker run --name incoming-warehouse-db \
  -e POSTGRES_DB=wis_foom \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin123 \
  -p 5432:5432 \
  -d postgres:15-alpine

# Cek apakah berjalan
docker ps
```

### Step 3: Setup Environment Variables

#### API (.env)
File sudah dibuat di `Dashboard/api/.env`, tapi pastikan isinya benar:

```bash
cd Dashboard/api
# Edit .env jika perlu
```

Isi `.env`:
```env
DATABASE_URL="postgresql://admin:admin123@localhost:5432/wis_foom?schema=public"
PORT=4123
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
GATEWAY_API_KEY=your-gateway-api-key-change-in-production
CORS_ORIGIN=http://localhost:4234
```

#### Web (Optional)
Tidak perlu .env untuk development, tapi jika perlu:
```bash
cd Dashboard/web
# Buat .env jika perlu
```

#### Gateway (SQLite untuk config, fallback ke JSON)
Gateway menggunakan SQLite untuk menyimpan konfigurasi (file: `~/.incoming-warehouse-gateway.db`).
Jika SQLite tidak tersedia, akan fallback ke `config.json`.

```bash
cd Gateway/app
cp config.example.json config.json
# Edit config.json sesuai kebutuhan (untuk fallback)
```

**Catatan**: Gateway tidak perlu PostgreSQL. SQLite akan otomatis dibuat di home directory user.

### Step 4: Setup Database Schema

```bash
cd Dashboard/api

# Generate Prisma Client
npm run prisma:generate

# Run migrations (membuat tables)
npm run prisma:migrate:dev

# Seed database (membuat user admin default)
npm run prisma:seed
```

**Catatan:** 
- User default: `admin` / `admin123`
- Jika migration error, pastikan PostgreSQL berjalan dan database `wis_foom` sudah dibuat

### Step 5: Build Projects (Optional untuk Development)

Untuk development, tidak perlu build dulu, tapi jika ingin:

```bash
# Build API
cd Dashboard/api
npm run build

# Build Web
cd Dashboard/web
npm run build

# Build Gateway
cd Gateway/app
npm run build
```

## Menjalankan Sistem

### Terminal 1: API Server
```bash
cd Dashboard/api
npm run start:dev
```
API akan berjalan di: http://localhost:4123

### Terminal 2: Web UI
```bash
cd Dashboard/web
npm run dev
```
Web akan berjalan di: http://localhost:5173 (Vite default) atau http://localhost:4234 (sesuai vite.config.ts)

### Terminal 3: Gateway (Optional - hanya jika ada hardware timbangan)
```bash
cd Gateway/app
npm run dev
```

## Menghubungkan Timbangan dengan Sistem melalui Gateway

### 🚀 Quick Start (Command Cepat)

**Windows:**
```powershell
cd Gateway/app
.\scripts\setup-gateway.ps1    # Setup otomatis
npm run dev                     # Jalankan Gateway
```

**Linux/macOS:**
```bash
cd Gateway/app
chmod +x scripts/*.sh           # Berikan permission (hanya pertama kali)
./scripts/setup-gateway.sh      # Setup otomatis
npm run dev                     # Jalankan Gateway
```

**Deteksi Port Serial:**
```bash
cd Gateway/app
npm run detect-ports            # List semua port serial yang tersedia
```

---

### Step 1: Pastikan Timbangan Terhubung ke Komputer

1. **Hubungkan timbangan ke komputer** via kabel USB/Serial
2. **Cek di Device Manager (Windows)** atau `ls /dev/tty*` (Linux/macOS) untuk melihat port serial yang tersedia
3. **Catat nama port serial** (contoh: `COM3`, `COM9` di Windows, atau `/dev/ttyUSB0` di Linux)

### Step 2: Deteksi Port Serial yang Tersedia

**Windows (PowerShell):**
```powershell
# Gunakan script helper untuk mendeteksi port serial
cd Gateway/app
npm run detect-ports
```

**Atau gunakan Device Manager:**
- Buka Device Manager → Ports (COM & LPT)
- Cari port yang terhubung ke timbangan (biasanya ada nama vendor atau "USB Serial Port")

**Linux/macOS:**
```bash
# List semua serial ports
ls /dev/tty* | grep -E 'USB|ACM|S'

# Atau gunakan script helper (lebih mudah)
cd Gateway/app
npm run detect-ports
```

### Step 3: Konfigurasi Gateway

Ada **2 cara** untuk mengkonfigurasi Gateway:

#### Opsi A: Menggunakan Web UI (Paling Mudah)

1. **Jalankan Gateway terlebih dahulu:**
   ```bash
   cd Gateway/app
   npm run dev
   ```

2. **Buka browser dan akses:** http://localhost:4124

3. **Konfigurasi di Web UI:**
   - **Serial Port Settings:**
     - Port: Pilih port serial yang terdeteksi (contoh: `COM3`, `COM9`)
     - Baud Rate: Biasanya `9600` (cek manual timbangan Anda)
     - Parity: `none` (default)
     - Data Bits: `8` (default)
     - Stop Bits: `1` (default)
     - Auto Detect: `true` (untuk auto-detect port)
   
   - **Server Settings:**
     - URL: `http://localhost:4123` (untuk local) atau URL VPS untuk production
     - API Key: Harus sama dengan `GATEWAY_API_KEY` di file `Dashboard/api/.env`
   
   - **Stable Weight Detection:**
     - Window (ms): `1000` (default, waktu tunggu sebelum mengirim berat stabil)
     - Stable Pattern: `ST|STABLE|S` (pattern yang menandakan berat stabil)
     - Unstable Pattern: `US|UNSTABLE|U` (pattern yang menandakan berat tidak stabil)

4. **Klik "Save Configuration"**

5. **Restart Gateway** agar konfigurasi diterapkan

#### Opsi B: Edit File config.json Manual

1. **Copy file contoh konfigurasi:**
   ```bash
   cd Gateway/app
   cp config.example.json config.json
   ```

2. **Edit file `config.json`:**
   ```json
   {
     "serial": {
       "port": "COM9",           // Ganti dengan port serial timbangan Anda
       "baudRate": 9600,          // Sesuaikan dengan manual timbangan
       "parity": "none",
       "dataBits": 8,
       "stopBits": 1,
       "autoDetect": true         // true = auto-detect port jika tidak ditemukan
     },
     "server": {
       "url": "http://localhost:4123",  // URL API server
       "apiKey": "your-gateway-api-key-change-in-production"  // Harus sama dengan GATEWAY_API_KEY di API .env
     },
     "stable": {
       "windowMs": 1000,          // Waktu tunggu (ms) sebelum mengirim berat stabil
       "pattern": "ST|STABLE|S",   // Pattern untuk berat stabil
       "unstablePattern": "US|UNSTABLE|U"  // Pattern untuk berat tidak stabil
     }
   }
   ```

3. **Pastikan API Key sama dengan di API:**
   - Buka `Dashboard/api/.env`
   - Pastikan `GATEWAY_API_KEY` sama dengan `apiKey` di `config.json`

### Step 4: Pastikan API Server Berjalan

Gateway memerlukan API server untuk mengirim data. Pastikan API server sudah berjalan:

```bash
cd Dashboard/api
npm run start:dev
```

API harus berjalan di: **http://localhost:4123**

### Step 5: Jalankan Gateway

```bash
cd Gateway/app
npm run dev
```

**Output yang diharapkan:**
```
✅ Serial port opened: COM9
   Baud rate: 9600
   Waiting for data...
✅ Connected to server: http://localhost:4123
📡 Gateway ID: <uuid>
```

### Step 6: Test Koneksi Timbangan

1. **Letakkan barang di timbangan**
2. **Perhatikan console Gateway**, harus muncul:
   ```
   📥 Raw data: ST,+00170.5g
   ⚖️  Parsed weight: 0.1705 kg (stable: true)
   ✅ Sending stable weight: 0.1705 kg
   ```

3. **Buka Web UI** dan mulai session penimbangan
4. **Data timbangan akan muncul real-time** di dashboard

### Command Lengkap untuk Setup Gateway

**Windows (PowerShell) - Menggunakan Script Helper (Paling Mudah):**
```powershell
# Masuk ke direktori Gateway
cd Gateway/app

# Jalankan script setup otomatis
.\scripts\setup-gateway.ps1

# Script akan:
# - Install dependencies
# - Build project
# - Detect port serial
# - Create config.json jika belum ada
# - Check API server

# Setelah itu, edit config.json atau gunakan Web UI di http://localhost:4124
# Lalu jalankan Gateway:
npm run dev
```

**Windows (PowerShell) - Manual:**
```powershell
# 1. Masuk ke direktori Gateway
cd Gateway/app

# 2. Install dependencies (jika belum)
npm install

# 3. Build project (jika belum)
npm run build

# 4. Deteksi port serial yang tersedia (menggunakan script helper)
npm run detect-ports

# 5. Copy dan edit config (jika belum ada)
Copy-Item config.example.json config.json
# Edit config.json dengan text editor sesuai port serial Anda
# Atau gunakan Web UI di http://localhost:4124 setelah menjalankan gateway

# 6. Pastikan API server berjalan di terminal lain
# cd Dashboard/api
# npm run start:dev

# 7. Jalankan Gateway
npm run dev
```

**Linux/macOS - Menggunakan Script Helper (Paling Mudah):**
```bash
# Masuk ke direktori Gateway
cd Gateway/app

# Berikan permission execute (hanya pertama kali)
chmod +x scripts/setup-gateway.sh scripts/detect-ports.js

# Jalankan script setup otomatis
./scripts/setup-gateway.sh

# Script akan:
# - Install dependencies
# - Build project
# - Detect port serial
# - Create config.json jika belum ada
# - Check API server

# Setelah itu, edit config.json atau gunakan Web UI di http://localhost:4124
# Lalu jalankan Gateway:
npm run dev
```

**Linux/macOS - Manual:**
```bash
# 1. Masuk ke direktori Gateway
cd Gateway/app

# 2. Install dependencies (jika belum)
npm install

# 3. Build project (jika belum)
npm run build

# 4. Deteksi port serial yang tersedia (menggunakan script helper)
npm run detect-ports

# 5. Copy dan edit config (jika belum ada)
cp config.example.json config.json
# Edit config.json dengan text editor sesuai port serial Anda
# Atau gunakan Web UI di http://localhost:4124 setelah menjalankan gateway

# 6. Pastikan API server berjalan di terminal lain
# cd Dashboard/api
# npm run start:dev

# 7. Jalankan Gateway
npm run dev
```

### Troubleshooting Gateway

#### Error: "Serial port not found" atau "Cannot open port"
- **Pastikan timbangan terhubung** ke komputer
- **Cek port serial** di Device Manager (Windows) atau `ls /dev/tty*` (Linux)
- **Pastikan port tidak digunakan** aplikasi lain (tutup aplikasi lain yang mungkin menggunakan port)
- **Coba ubah `autoDetect: true`** di config.json untuk auto-detect

#### Error: "Access denied" atau "Opening COMX: Access denied"
- **Port sedang digunakan aplikasi lain** - Tutup aplikasi seperti:
  - Arduino IDE
  - Putty / Tera Term
  - Serial Monitor lainnya
  - Aplikasi lain yang menggunakan port serial
- **Cek di Device Manager:**
  - Buka Device Manager → Ports (COM & LPT)
  - Cari port yang bermasalah
  - Jika ada tanda seru (!), klik kanan → Update driver
- **Restart komputer** jika port masih terkunci setelah menutup semua aplikasi
- **Coba port serial lain** jika tersedia (gunakan `npm run detect-ports` untuk melihat semua port)
- **Windows:** Pastikan tidak ada aplikasi yang memonitor port tersebut di background

#### Error: "Connection refused" ke server
- **Pastikan API server berjalan** di `http://localhost:4123`
- **Cek URL server** di config.json sesuai dengan API server
- **Cek firewall** tidak memblokir koneksi

#### Error: "Authentication failed" atau "Invalid API key"
- **Pastikan API key** di `Gateway/app/config.json` sama dengan `GATEWAY_API_KEY` di `Dashboard/api/.env`
- **Restart Gateway** setelah mengubah API key

#### Data timbangan tidak muncul di dashboard
- **Pastikan session penimbangan sudah dimulai** di Web UI
- **Cek console Gateway** apakah data diterima dari timbangan
- **Cek console API server** apakah data diterima dari Gateway
- **Cek format data timbangan** sesuai dengan pattern yang dikonfigurasi

#### Data timbangan tidak stabil atau tidak akurat
- **Sesuaikan `windowMs`** di config.json (semakin besar, semakin lama tunggu sebelum mengirim)
- **Sesuaikan pattern stable/unstable** sesuai format data dari timbangan Anda
- **Cek baud rate** sesuai dengan manual timbangan

### Format Data Timbangan yang Didukung

Gateway mendukung berbagai format data timbangan:
- `ST,+00170.5g` → 0.1705 kg (stable)
- `12.34 kg` → 12.34 kg
- `ST 12.34` → 12.34 kg (stable)
- `001705` → 170.5 g → 0.1705 kg (format 7 digit)

Gateway akan otomatis:
- **Mengkonversi gram ke kilogram** jika terdeteksi unit 'g' atau 'gram'
- **Mendeteksi berat stabil** berdasarkan pattern yang dikonfigurasi
- **Mengirim data real-time** ke API server via WebSocket

## Verifikasi Setup

### 1. Cek API Health
```bash
curl http://localhost:4123/api/health
```
Harus return: `{"status":"ok","timestamp":"..."}`

### 2. Cek Web UI
Buka browser: http://localhost:5173 (atau http://localhost:4234)

### 3. Login
- Username: `admin`
- Password: `admin123`

## Troubleshooting

### Error: "Environment variable not found: DATABASE_URL"
- Pastikan file `.env` ada di `Dashboard/api/`
- Pastikan `DATABASE_URL` sudah diisi dengan benar

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

### Error: "http proxy error: ECONNREFUSED" di Web UI
- **Ini normal** jika terjadi saat pertama kali start
- Terjadi karena Web UI mencoba connect ke API sebelum API server fully ready
- **Tidak perlu dikhawatirkan** - setelah API server ready, error akan hilang dan Web UI akan berfungsi normal
- Refresh browser jika error masih muncul setelah beberapa detik
- Script `start-dev.ps1` / `start-dev.sh` sudah diperbaiki untuk menunggu API ready sebelum start Web UI

### Error: "Cannot find module" saat npm install
- Hapus `node_modules` dan `package-lock.json`
- Jalankan `npm install` lagi
- Pastikan Node.js versi >= 18

### Gateway: "Serial port not found"
- Ini normal jika tidak ada hardware timbangan terhubung
- Gateway bisa tetap berjalan, hanya tidak akan menerima data serial
- Untuk testing, bisa mock data atau skip gateway

## Struktur Port

- **4123**: API Server (NestJS)
- **4234**: Web UI (React/Vite) - sesuai vite.config.ts
- **5173**: Web UI (Vite default) - jika tidak diubah
- **5432**: PostgreSQL Database

## Next Steps Setelah Setup

1. **Login ke Web UI** dengan `admin/admin123`
2. **Buat Vendor** di halaman Database
3. **Buat Packaging** untuk vendor tersebut
4. **Setup Session** di halaman Home
5. **Test penimbangan** (jika ada Gateway)

## Catatan Penting

1. **Database**: Jangan commit file `.env` ke Git (sudah ada di .gitignore)
2. **Development**: Gunakan `npm run start:dev` untuk hot-reload
3. **Production**: Build dulu dengan `npm run build` sebelum deploy
4. **Gateway**: Hanya diperlukan jika ada hardware timbangan. Untuk testing UI, bisa skip gateway.

## 🚀 Quick Start Script (Jalankan Semua Service Sekaligus)

Script gabungan untuk menjalankan **API, Web UI, dan Gateway** dalam satu command!

### Windows (PowerShell)

**Jalankan semua service:**
```powershell
.\start-dev.ps1
```

**Jalankan tanpa Gateway:**
```powershell
.\start-dev.ps1 -NoGateway
```

**Hentikan semua service:**
```powershell
.\stop-dev.ps1
```

Script akan:
- ✅ Membuka window terpisah untuk setiap service
- ✅ Menanyakan apakah ingin menjalankan Gateway
- ✅ Menampilkan URL dan credentials

### Linux/macOS (Bash)

**Berikan permission execute (hanya pertama kali):**
```bash
chmod +x start-dev.sh stop-dev.sh
```

**Jalankan semua service:**
```bash
./start-dev.sh
```

**Jalankan tanpa Gateway:**
```bash
./start-dev.sh --no-gateway
```

**Hentikan semua service:**
```bash
./stop-dev.sh
```

Script akan:
- ✅ Menjalankan semua service di background
- ✅ Menanyakan apakah ingin menjalankan Gateway
- ✅ Menyimpan PID untuk mudah dihentikan
- ✅ Menampilkan URL dan credentials

### Manual (3 Terminal Terpisah)

Jika lebih suka menjalankan manual:

**Terminal 1 - API:**
```bash
cd Dashboard/api
npm run start:dev
```

**Terminal 2 - Web UI:**
```bash
cd Dashboard/web
npm run dev
```

**Terminal 3 - Gateway (opsional):**
```bash
cd Gateway/app
npm run dev
```

## 📋 Ringkasan Command Lengkap

### 🚀 Quick Start (Paling Mudah)

**Windows:**
```powershell
# Jalankan semua service sekaligus
.\start-dev.ps1

# Hentikan semua service
.\stop-dev.ps1
```

**Linux/macOS:**
```bash
# Berikan permission (hanya pertama kali)
chmod +x start-dev.sh stop-dev.sh

# Jalankan semua service sekaligus
./start-dev.sh

# Hentikan semua service
./stop-dev.sh
```

### Setup Awal Sistem
```bash
# 1. Install dependencies
npm install

# 2. Setup database
cd Dashboard/api
npm run prisma:migrate:dev
npm run prisma:seed

# 3. Jalankan sistem (3 terminal terpisah)
# Terminal 1: API
cd Dashboard/api && npm run start:dev

# Terminal 2: Web UI
cd Dashboard/web && npm run dev

# Terminal 3: Gateway (opsional)
cd Gateway/app && npm run dev
```

### Setup Gateway untuk Timbangan

**Windows:**
```powershell
# Setup otomatis
cd Gateway/app
.\scripts\setup-gateway.ps1

# Deteksi port serial
npm run detect-ports

# Edit config atau gunakan Web UI di http://localhost:4124
# Jalankan Gateway
npm run dev
```

**Linux/macOS:**
```bash
# Setup otomatis
cd Gateway/app
chmod +x scripts/*.sh
./scripts/setup-gateway.sh

# Deteksi port serial
npm run detect-ports

# Edit config atau gunakan Web UI di http://localhost:4124
# Jalankan Gateway
npm run dev
```

### Command Berguna Lainnya

```bash
# Cek health API
curl http://localhost:4123/api/health

# List port serial (manual)
# Windows: Device Manager → Ports (COM & LPT)
# Linux: ls /dev/tty* | grep -E 'USB|ACM|S'
# macOS: ls /dev/tty.* | grep -E 'USB|usb'

# Build semua project
cd Dashboard/api && npm run build
cd Dashboard/web && npm run build
cd Gateway/app && npm run build

# Reset database (hati-hati!)
cd Dashboard/api
npm run prisma:migrate:reset
npm run prisma:seed
```

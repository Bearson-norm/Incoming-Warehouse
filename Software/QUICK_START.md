# 🚀 Quick Start - Incoming Warehouse System

Script gabungan untuk menjalankan semua service sekaligus!

## Windows (PowerShell)

### Jalankan Semua Service
```powershell
.\start-dev.ps1
```

Script akan:
- ✅ Membuka window terpisah untuk API Server (port 4123)
- ✅ Membuka window terpisah untuk Web UI (port 4234)
- ✅ Menanyakan apakah ingin menjalankan Gateway (port 4124)
- ✅ Menampilkan URL dan login credentials

### Jalankan Tanpa Gateway
```powershell
.\start-dev.ps1 -NoGateway
```

### Hentikan Semua Service
```powershell
.\stop-dev.ps1
```

## Linux/macOS (Bash)

### Setup Permission (Hanya Pertama Kali)
```bash
chmod +x start-dev.sh stop-dev.sh
```

### Jalankan Semua Service
```bash
./start-dev.sh
```

Script akan:
- ✅ Menjalankan API Server di background (port 4123)
- ✅ Menjalankan Web UI di background (port 4234)
- ✅ Menanyakan apakah ingin menjalankan Gateway (port 4124)
- ✅ Menyimpan PID untuk mudah dihentikan
- ✅ Menampilkan URL dan login credentials

### Jalankan Tanpa Gateway
```bash
./start-dev.sh --no-gateway
```

### Hentikan Semua Service
```bash
./stop-dev.sh
```

## 📍 URL Services

Setelah script dijalankan, akses:

- **API Server**: http://localhost:4123
- **Web UI**: http://localhost:4234
- **Gateway Config UI**: http://localhost:4124 (jika Gateway dijalankan)

## Konfigurasi Odoo WMS (Recording Action)

Penimbangan LPN mengirim data ke Odoo. Atur alamat API:

| Mode | Lokasi konfigurasi |
|------|-------------------|
| **Electron (desktop)** | **Settings** → *Konfigurasi API Odoo WMS* → Simpan & Restart API |
| **Browser + API manual** | `Dashboard/api/.env` → `ODOO_BASE_URL`, `ODOO_IOT_API_KEY` |

Detail: [ELECTRON_SETUP.md](ELECTRON_SETUP.md#integrasi-odoo-wms-recording-action).

## 🔐 Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

## 💡 Tips

1. **Pertama kali setup?** Lihat [SETUP_LOCAL.md](SETUP_LOCAL.md) untuk setup database dan dependencies
2. **Menggunakan timbangan?** Setup Gateway terlebih dahulu:
   ```bash
   cd Gateway/app
   npm run detect-ports        # Deteksi port serial
   ./scripts/setup-gateway.ps1 # Windows
   ./scripts/setup-gateway.sh  # Linux/macOS
   ```
3. **Troubleshooting?** Lihat bagian Troubleshooting di [SETUP_LOCAL.md](SETUP_LOCAL.md)

## Aplikasi Electron (desktop)

Electron **tidak** termasuk dalam `start-dev.ps1`: UI browser memakai API + Vite terpisah, sedangkan Electron menjalankan API sebagai proses anak dari dalam aplikasi.

- **Development (disarankan):** dari folder root jalankan `npm run dev:electron`, atau di Windows `.\start-electron-dev.ps1`. Pastikan API sudah pernah di-build: `npm run build:api` (sekali).
- **Jangan** jalankan `start-dev.ps1` bersamaan dengan mode Electron — port **4123** akan bentrok.

Detail build, paket installer/portable Windows, dan lokasi `config.json` ada di [ELECTRON_SETUP.md](ELECTRON_SETUP.md).

Setelah **`npm run package:electron:win`**, PC lain yang hanya menjalankan installer atau exe portabel **tidak perlu menginstal Node.js** (runtime Node Windows ikut dibundle otomatis).

## Manual Start (Alternatif — browser)

Jika lebih suka menjalankan manual di terminal terpisah (tanpa Electron):

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

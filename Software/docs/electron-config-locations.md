# Lokasi konfigurasi Electron (semua metode distribusi)

Panduan ini menjelaskan **di mana file konfigurasi dan data** disimpan untuk aplikasi **Incoming Warehouse** di PC timbang, untuk setiap cara distribusi Windows: **portable**, **win-unpacked**, dan **NSIS Setup**.

Kode acuan: `electron-app/main/sqlite-path.ts`, `config-manager.ts`, `process-manager.ts`, `Gateway/app/src/config-path.ts`.

---

## Ringkasan cepat

| Jenis data | Portable | win-unpacked | NSIS (setelah instal) |
|------------|----------|--------------|------------------------|
| `config.json`, SQLite, Odoo/cloud JSON | Folder **file portable `.exe`** | Folder **`win-unpacked`** (samping exe) | **`%APPDATA%\Incoming Warehouse`** |
| COM, baud, pattern timbangan (Gateway) | **`%USERPROFILE%\.incoming-warehouse-gateway\`** | **Sama** | **Sama** |
| Kode aplikasi (read-only) | Ekstraksi internal / bundel | Folder instal copy | **`Program Files\Incoming Warehouse\`** |

**Penting:** setting **serial/COM** tidak ada di `config.json` Electron. Hanya `gateway.enabled` dan `gateway.autoStart` yang ada di sana.

---

## 1. Folder data aplikasi (Electron)

Semua file berikut berada di **satu folder data** yang sama (disebut *data directory* di kode):

| File | Isi |
|------|-----|
| `config.json` | Odoo, cloud, `jwtSecret`, `gatewayApiKey`, `adminInitialPassword`, `gateway.enabled` / `autoStart` |
| `incoming-warehouse.db` | Database SQLite operasional |
| `odoo-settings.json` | Salinan setting Odoo untuk API (ditulis dari Settings) |
| `cloud-settings.json` | Salinan setting cloud untuk API |
| `login.txt` | Opsional — kredensial awal; installer NSIS dapat membuatnya |

Template field: [electron-app/config.example.json](../electron-app/config.example.json).

### Cara folder dipilih (urutan)

Saat aplikasi **sudah di-package** (`app.isPackaged`), Electron memilih folder writable dengan urutan:

1. **`PORTABLE_EXECUTABLE_DIR`** — hanya saat menjalankan artefak **portable** (folder tempat file `Incoming Warehouse x.x.x.exe` portable diletakkan).
2. **Folder exe yang sedang berjalan** — `dirname(Incoming Warehouse.exe)` jika bisa ditulis.
3. **`app.getPath('userData')`** — pada Windows biasanya:<br>`%APPDATA%\Incoming Warehouse`<br>Contoh: `C:\Users\<nama>\AppData\Roaming\Incoming Warehouse`

Jika folder (2) tidak writable (typical **NSIS → Program Files**), dipakai (3).

### Per metode distribusi

#### A. Portable (`release\Incoming Warehouse 1.0.0.exe`)

- Letakkan exe di folder yang ingin dipakai (mis. `E:\Timbang\`).
- **Config + DB** muncul di **folder yang sama** dengan file portable exe:
  - `E:\Timbang\config.json`
  - `E:\Timbang\incoming-warehouse.db`
  - dll.
- Cocok untuk USB: satu folder berisi exe + data setelah pertama kali jalan.

#### B. win-unpacked (`release\win-unpacked\Incoming Warehouse.exe`)

- **Config + DB** di dalam folder **`win-unpacked`**, sejajar exe:
  - `...\release\win-unpacked\config.json`
  - `...\release\win-unpacked\incoming-warehouse.db`
- Distribusi: copy **seluruh folder** `win-unpacked` (wajib termasuk `resources\`).

#### C. NSIS Setup (`release\Incoming Warehouse Setup 1.0.0.exe`)

- Exe aplikasi terinstal di lokasi pilihan user (default sering `C:\Program Files\Incoming Warehouse\`).
- Folder instal **read-only** → config **tidak** disimpan di sana.
- **Config + DB** di:
  - `%APPDATA%\Incoming Warehouse\`
- Installer dapat mengisi awal `config.json`, `login.txt`, dan menyalin template DB ke Roaming jika belum ada (`electron-app/installer.nsh`).

---

## 2. Konfigurasi timbangan (COM, baud, stabil)

**Terpisah** dari `config.json` di atas, untuk **semua** metode distribusi.

| File | Lokasi Windows |
|------|----------------|
| `config.json` (serial, baud, parity, stable patterns) | `%USERPROFILE%\.incoming-warehouse-gateway\config.json` |
| ID unik gateway | `%USERPROFILE%\.incoming-warehouse-gateway-id` |

- Diisi dari **Settings** (serial/COM) → disimpan lewat layanan Gateway di port **4124**.
- Electron memaksa `GATEWAY_CONFIG_PATH` ke path user di atas agar tidak menulis ke Program Files.
- `SERVER_URL` dan `GATEWAY_API_KEY` untuk koneksi ke API lokal di-set oleh Electron dari `config.json` utama (env), bukan hanya dari file Gateway.

Template contoh (dev): [Gateway/app/config.example.json](../Gateway/app/config.example.json).

---

## 3. Isi instalasi (bukan tempat edit config)

Setelah package, kode hanya-baca ada di folder aplikasi:

```
<folder aplikasi>\
  Incoming Warehouse.exe
  resources\
    api\
    web\
    gateway\
    … (runtime Node ter-bundle, dll.)
```

Template build (bukan config runtime user): `electron-app/resources/data/` (DB/login untuk seed installer).

---

## 4. Pengaturan di UI (localStorage)

Tidak berupa file JSON di disk; tersimpan di profil Chromium aplikasi:

| Key | Fungsi |
|-----|--------|
| `auth-storage` | Sesi login |
| `language` | Bahasa UI |
| `printLabelConfig` | Preset cetak label |

Hilang jika data aplikasi Electron di-reset.

---

## 5. Mode development (mesin build)

| Komponen | Lokasi |
|----------|--------|
| Electron `config.json` + SQLite | `Software/electron-app/` (root package Electron) |
| API | `Software/Dashboard/api/.env` |
| Gateway standalone | `Software/Gateway/app/config.json` |

---

## 6. VPS cloud (referensi)

Konfigurasi server cloud **bukan** di PC timbang:

- `Software/infra/.env` — lihat [CLOUD_SETUP.md](../CLOUD_SETUP.md).
- Di stasiun: `cloud.serverUrl`, `cloud.syncApiKey`, `jwtSecret` di `config.json` (folder data §1).

---

## 7. Backup & migrasi PC

Untuk memindahkan stasiun lengkap ke PC/user Windows lain:

1. **Folder data Electron** (sesuai metode §1): `config.json`, `incoming-warehouse.db`, `odoo-settings.json`, `cloud-settings.json`.
2. **`%USERPROFILE%\.incoming-warehouse-gateway\`** (COM/baud + file `-id` jika perlu identitas gateway sama).

Portable/USB: item (1) bisa ikut flash; item (2) tetap di **profil user Windows** kecuali folder `.incoming-warehouse-gateway` ikut disalin.

---

## 8. Diagram alur

```
Settings UI
    ├─ Cloud / Odoo / secrets ──► config.json (+ odoo/cloud-settings.json)
    │                              di folder data §1
    └─ Serial / COM / stable ────► %USERPROFILE%\.incoming-warehouse-gateway\config.json

Electron spawn
    ├─ API (:4123)  ◄── env dari config.json + path file settings
    └─ Gateway      ◄── GATEWAY_CONFIG_PATH → folder gateway §2
```

---

## Dokumen terkait

- [ELECTRON_SETUP.md](../ELECTRON_SETUP.md) — build, package, quick start
- [CLOUD_SETUP.md](../CLOUD_SETUP.md) — pairing VPS ↔ stasiun
- [electron-app/README.md](../electron-app/README.md) — packaging Windows

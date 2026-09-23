# Cloud Server Setup Guide

VPS sebagai **penyimpanan cloud** (PostgreSQL + API). Stasiun timbang memakai **Electron + SQLite**; data disinkronkan lewat HTTP API. UI **hanya di Electron**.

Lihat: [infra/README.md](infra/README.md), [electron-app/config.example.json](electron-app/config.example.json).

## Architecture

```
  PC timbang (Electron)  ──HTTPS /api/cloud/*──►  VPS: nginx (host) → 127.0.0.1:4123 → api → Postgres
```

- **Sync**: `POST {CLOUD_SERVER_URL}/api/cloud/readings` + header `X-Cloud-Sync-Key`.
- **Docker default**: hanya `postgres` + `api`. **Nginx systemd di host** memakai port 80 (bukan container nginx).

## Nginx di VPS (host vs Docker)

| Situasi | File / langkah |
|---------|----------------|
| **ProductionDashboard** — nginx systemd sudah di `:80` | Pakai **`nginx/wis.moof-set.web.id.host.conf`**, bukan `wis.moof-set.web.id.conf` |
| VPS tanpa web server | `docker compose --profile docker-nginx up -d` + `wis.moof-set.web.id.conf` |

**Penting:** Mengedit `infra/nginx/wis.moof-set.web.id.conf` dengan `nano` **belum** mengaktifkan nginx. File itu untuk container Docker (`server api:4123`). Nginx host harus proxy ke **`127.0.0.1:4123`**.

**Aktifkan nginx host** (path contoh `/opt/Incoming-Warehouse/Software/infra`):

```bash
cd /opt/Incoming-Warehouse/Software/infra
chmod +x scripts/install-host-nginx.sh
sudo ./scripts/install-host-nginx.sh
```

Manual:

```bash
sudo cp nginx/wis.moof-set.web.id.host.conf /etc/nginx/sites-available/wis.moof-set.web.id
sudo ln -sf /etc/nginx/sites-available/wis.moof-set.web.id /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
docker rm -f incoming-warehouse-nginx 2>/dev/null || true
```

Verifikasi:

```bash
curl -s http://127.0.0.1:4123/api/health
curl -s http://wis.moof-set.web.id/api/health
```

**Electron Cloud Server URL:** `http://wis.moof-set.web.id` atau `https://wis.moof-set.web.id` (tanpa `/` di akhir, tanpa `/api`).

Detail: [infra/nginx/README.md](infra/nginx/README.md).

## Pairing: VPS ↔ Electron

| Setting | VPS (`.env`) | Stasiun (Settings / `config.json`) | Sama? |
|--------|--------------|-------------------------------------|-------|
| Cloud URL | — | `cloud.serverUrl` | URL publik, tanpa `/` di akhir |
| Sync key | `CLOUD_SYNC_API_KEY` | `cloud.syncApiKey` | **Ya** |
| JWT | `JWT_SECRET` | `jwtSecret` | **Ya** jika admin kelola timbangan dari Electron Cloud Server |
| Gateway | `GATEWAY_API_KEY` | lokal (auto) | Tidak |

### JWT admin (Cloud Server di Electron)

Buat/ubah timbangan di VPS membutuhkan JWT yang valid di VPS. Set `jwtSecret` di `config.json` **sama** dengan `JWT_SECRET` VPS, restart app, login ulang.

Alternatif: buat timbangan via `POST /api/cloud/scales` setelah login ke API VPS (curl).

### Checklist

1. `docker compose ps` → `postgres`, `api` up; API health OK di `127.0.0.1:4123`.
2. Host nginx: `curl -s https://your-domain/api/health`.
3. Electron: Cloud URL + sync key → Test.
4. Minimal satu timbangan di cloud.
5. Timbang → `cloudSyncedAt` terisi.

## Deploy

### `.env` wajib (VPS)

```bash
POSTGRES_PASSWORD=...
JWT_SECRET=...
GATEWAY_API_KEY=...
CLOUD_SYNC_API_KEY=...
ADMIN_INITIAL_PASSWORD=...
CORS_ORIGIN=https://wis.moof-set.web.id
```

Generate secret: `openssl rand -hex 32` (nilai berbeda per variabel).

### Docker

```bash
cd Software/infra
docker compose up -d --build
```

Setelah ubah Dockerfile/API: `docker compose build --no-cache api && docker compose up -d api`.

GitHub Actions: **Deploy cloud server** — sync `Dashboard/api` + `infra`, jalankan `deploy-cloud.sh`.

### Electron

Settings → **Cloud Server Configuration** → URL + sync key (sama dengan VPS).

## Troubleshooting

| Gejala | Perbaikan |
|--------|-----------|
| `docker compose ps` hanya **postgres**, tidak ada **api** | `docker compose up -d api` lalu `docker compose logs api --tail 50`. Sering karena migrasi Prisma gagal — lihat baris bawah. |
| Migrasi `User already exists` (P3018) | `migrate resolve --rolled-back` + `--applied` untuk `20260917120000_init_postgresql`, lalu `migrate deploy` (lihat chat/docs migrasi legacy). |
| `curl 127.0.0.1:4123` kosong | API container tidak jalan — perbaiki log API dulu; nginx tidak bisa proxy tanpa backend. |
| Domain `/api/health` **404** nginx Ubuntu | (1) API belum up → 502/404 tergantung config. (2) **default site** menang: `sudo rm /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx`. (3) Uji: `curl -s -H "Host: wis.moof-set.web.id" http://127.0.0.1/api/health`. |
| `Bind for 0.0.0.0:80 failed` | Jangan start profile `docker-nginx`; pakai host nginx + `install-host-nginx.sh` |
| `Cannot find module '/app/dist/main'` | Rebuild API image setelah fix `start:prod` → `node dist/src/main`; `docker compose build --no-cache api && docker compose up -d api` |

Diagnosis cepat di VPS:

```bash
cd /opt/Incoming-Warehouse/Software/infra
chmod +x scripts/verify-cloud-stack.sh
./scripts/verify-cloud-stack.sh
```

Urutan perbaikan tipikal (ProductionDashboard):

```bash
cd /opt/Incoming-Warehouse/Software/infra

# 1) Perbaiki migrasi jika API crash (DB lama)
docker compose run --rm api npx prisma migrate resolve --rolled-back 20260917120000_init_postgresql
docker compose run --rm api npx prisma migrate resolve --applied 20260917120000_init_postgresql
docker compose run --rm api npx prisma migrate deploy

# 2) Start API
docker compose up -d api
curl -s http://127.0.0.1:4123/api/health

# 3) Nginx — hapus default jika /api/health 404
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
curl -s http://wis.moof-set.web.id/api/health
```

## Dokumen terkait

- [VPS_DATABASE_SETUP.md](VPS_DATABASE_SETUP.md) — backup/restore Postgres
- [electron-app/README.md](electron-app/README.md)
- [ELECTRON_SETUP.md](ELECTRON_SETUP.md)

## Audit LPN dan master data terpusat

Cloud Server adalah sumber record lintas station, bukan pengganti database operasional
SQLite saat perangkat offline. Setiap hasil timbang yang tersimpan mengirim:

- LPN, flow/method, berat, status, referensi Odoo, dan waktu pengambilan;
- station/device, gateway, timbangan, operator, local session/reading ID;
- ID canonical serta snapshot nama vendor, kemasan, dan RM pada saat transaksi.

Pencarian **Cloud Server → Tracing LPN** menyusun event dari beberapa perangkat dan
timbangan. `sourceAt` adalah waktu kejadian pada device, sedangkan `receivedAt` adalah
waktu event diterima VPS. Selisih keduanya normal ketika device offline. Retry memakai
`stationId + localEventId`, sehingga tidak membuat event audit ganda.

Nama pada transaksi lama tidak pernah ditulis ulang. UI menampilkan snapshot historis
dan, bila berbeda, nama canonical terbaru. Ini menjaga bukti transaksi sekaligus membantu
operator memakai nama terkini.

### Master data

- Vendor, kemasan, dan RM hanya diedit admin melalui **Cloud Server → Edit Database**.
- Halaman **Database** Electron adalah cache read-only. Cache ditarik saat API mulai,
  setiap lima menit, atau melalui tombol **Sinkronkan**.
- Setiap perubahan wajib memiliki alasan dan `expectedRevision`. Jika admin lain telah
  mengubah record, server menjawab HTTP 409; reload sebelum mengulangi perubahan.
- Hapus berarti soft delete. Record dan audit history tetap ada untuk tracing.
- Tanggal terbit RM adalah `issuedAt`; waktu pembentukan/perubahan memakai
  `createdAt`/`updatedAt`.

### Bukti audit

Ekspor LPN menghasilkan JSON rinci, CSV, dan manifest SHA-256. Simpan ketiganya bersama.
Hash mendeteksi perubahan file setelah ekspor, tetapi audit append-only pada aplikasi
bukan perlindungan absolut terhadap administrator database. Batasi kredensial PostgreSQL,
aktifkan backup, dan tetapkan retention sesuai kebijakan financing/audit perusahaan.

Event audit master data menyimpan actor, waktu, station/device, action, revision, alasan,
serta nilai before/after. API tidak menyediakan update atau delete untuk event audit.

# GitHub Actions Workflows

## CI Workflow

Workflow CI (`ci.yml`) berjalan pada setiap push dan pull request ke branch `main` atau `develop`.

Tugas:
- Build API (NestJS)
- Build Web (React/Vite)
- Build Gateway
- Lint semua package

## CD Workflow

Workflow CD (`cd.yml`) berjalan hanya pada push ke branch `main` atau manual trigger.

Tugas:
1. Build Docker image untuk API (VPS cloud; Web UI via Electron)
2. Copy files ke VPS via SSH
3. Deploy dengan docker-compose
4. Health check
5. Rollback jika health check gagal

## Required Secrets

Set di GitHub repository settings → Secrets:

- `SSH_PRIVATE_KEY`: Private SSH key untuk akses VPS
- `VPS_HOST`: IP atau domain VPS
- `VPS_USER`: Username SSH untuk VPS

## Rollback Mechanism

Jika health check gagal setelah deployment:
1. Stop containers baru
2. Start containers lama (dari docker-compose sebelumnya)
3. Exit dengan error code

File `last_good_tag.txt` disimpan di VPS untuk tracking.

# Cloud Server Setup Guide

The cloud server is a **storage-only** VPS deployment that aggregates weighing data from multiple local Incoming Warehouse stations (Electron + SQLite).

## Architecture

- **Local station**: weighing, sessions, Odoo integration run locally
- **VPS cloud**: stores admin-defined scale names and synced weighing results
- **Sync**: after each confirmed weighing, the local API pushes data to VPS

## Deploy with GitHub Actions

Push to `main` (or run **Actions → Deploy cloud server → Run workflow**) syncs `Software/Dashboard` + `Software/infra` to the VPS and runs Docker Compose. PostgreSQL stays on the VPS. Local Electron stations stay on SQLite.

### One-time VPS setup

1. Install Docker and Docker Compose on the VPS.
2. Create the deploy folder (default `/opt/incoming-warehouse`) and a `.env` that GitHub will **not** overwrite:

```bash
sudo mkdir -p /opt/incoming-warehouse/Software/infra
sudo cp Software/infra/.env.example /opt/incoming-warehouse/Software/infra/.env
sudo nano /opt/incoming-warehouse/Software/infra/.env
```

Required values:

```bash
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
GATEWAY_API_KEY=your-gateway-key
CLOUD_SYNC_API_KEY=your-cloud-sync-key
ADMIN_INITIAL_PASSWORD=your-admin-password
CORS_ORIGIN=https://wis.moof-set.web.id,http://wis.moof-set.web.id
```

3. Add the GitHub Actions SSH public key to `~/.ssh/authorized_keys` for the deploy user. That user needs permission to run `docker compose` in `/opt/incoming-warehouse`.

### GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions**:

| Name | Type | Purpose |
|------|------|---------|
| `VPS_HOST` | Secret | VPS IP or hostname |
| `VPS_USER` | Secret | SSH user |
| `VPS_SSH_KEY` | Secret | Private key (full PEM, including `BEGIN/END` lines) |
| `VPS_PORT` | Secret | SSH port, or omit to use `22` |
| `VPS_DEPLOY_PATH` | Variable | Optional; default `/opt/incoming-warehouse` |

Also create an Actions environment named `cloud` (the workflow uses `environment: cloud`).

### After deploy

1. Open `http://wis.moof-set.web.id` (or your VPS IP).
2. Log in as `admin` / `ADMIN_INITIAL_PASSWORD`.
3. Create scales on the **Cloud Server** page (or `POST /api/cloud/scales`).

Manual deploy on the VPS:

```bash
/opt/incoming-warehouse/Software/infra/scripts/deploy-cloud.sh
```

## VPS Setup (Docker, without GitHub)

1. Copy `Software/infra/` to your VPS and create `.env` as above.

2. Deploy (API image runs `prisma migrate deploy` on start):

```bash
cd Software/infra
docker compose up -d --build
```

3. Create scales as admin via the dashboard **Cloud Server** page (or `POST /api/cloud/scales`).

## Local Station Setup (Electron)

1. Open **Settings → Cloud Server Configuration**
2. Set:
   - **Cloud Server URL**: `https://your-vps.example.com` (no trailing slash)
   - **Cloud Sync API Key**: same value as `CLOUD_SYNC_API_KEY` on VPS
3. **Station ID** is auto-generated per install (used for deduplication)
4. Test connection, then use **Incoming** / **Intrans** — select a scale before confirming config

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `CLOUD_SERVER_URL` | Local API | VPS URL to proxy/sync |
| `CLOUD_SYNC_API_KEY` | Local + VPS | Authenticates sync writes |
| `STATION_ID` | Local API | Unique per weighing PC |
| `CLOUD_SETTINGS_FILE` | Optional | Override file path |

## API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/cloud/scales` | JWT or sync key | List scales |
| `POST /api/cloud/scales` | Admin JWT | Create scale |
| `POST /api/cloud/readings` | Sync key | Ingest weighing result |
| `GET /api/cloud/readings` | JWT | Query aggregated data |
| `GET /api/cloud/status` | JWT | Connection health |
| `POST /api/cloud/sync/retry` | JWT | Retry failed local syncs |

## Troubleshooting

- **Scale dropdown empty**: check cloud URL, API key, and that admin created scales on VPS
- **Weighing blocked**: scale selection is required; cloud must be reachable
- **Data not in cloud**: use Cloud Server → Retry sync; check `cloudSyncError` on local readings

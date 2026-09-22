# Nginx configs

| File | Use when |
|------|----------|
| **`wis.moof-set.web.id.host.conf`** | **nginx systemd on the VPS** (port 80 already in use). Proxies to `127.0.0.1:4123`. |
| **`wis.moof-set.web.id.conf`** | **Docker nginx container only** (`docker compose --profile docker-nginx`). Upstream `api:4123` works inside Compose network. |

Do **not** enable `wis.moof-set.web.id.conf` under `/etc/nginx/sites-enabled/` on the host — `api` is not a valid hostname outside Docker.

## Install on host (ProductionDashboard)

From the VPS, after `docker compose up -d` and API health on `127.0.0.1:4123`:

```bash
cd /opt/Incoming-Warehouse/Software/infra
sudo cp nginx/wis.moof-set.web.id.host.conf /etc/nginx/sites-available/wis.moof-set.web.id
sudo ln -sf /etc/nginx/sites-available/wis.moof-set.web.id /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
curl -s http://wis.moof-set.web.id/api/health
```

Or run: `sudo ./scripts/install-host-nginx.sh`

Electron **Cloud Server URL**: `http://wis.moof-set.web.id` or `https://...` (no trailing slash, no `/api`).

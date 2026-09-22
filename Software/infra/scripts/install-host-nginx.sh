#!/usr/bin/env bash
# Install host nginx site for Incoming Warehouse cloud API (proxy to 127.0.0.1:4123).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SITE_NAME="wis.moof-set.web.id"
SOURCE="${INFRA_DIR}/nginx/wis.moof-set.web.id.host.conf"
TARGET="/etc/nginx/sites-available/${SITE_NAME}"

if [[ ! -f "${SOURCE}" ]]; then
  echo "Missing ${SOURCE}" >&2
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx is not installed on this host." >&2
  exit 1
fi

echo "[install-host-nginx] Copying ${SOURCE} -> ${TARGET}"
sudo cp "${SOURCE}" "${TARGET}"
sudo ln -sf "${TARGET}" "/etc/nginx/sites-enabled/${SITE_NAME}"

if [[ -L /etc/nginx/sites-enabled/default ]] || [[ -f /etc/nginx/sites-enabled/default ]]; then
  echo "[install-host-nginx] Note: /etc/nginx/sites-enabled/default exists."
  echo "  If ${SITE_NAME}/api/health returns 404, disable default:"
  echo "  sudo rm /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx"
fi

echo "[install-host-nginx] Testing nginx configuration..."
sudo nginx -t

echo "[install-host-nginx] Reloading nginx..."
sudo systemctl reload nginx

echo ""
echo "[install-host-nginx] Nginx site installed. Next:"
echo "  1. Start API:  cd ${INFRA_DIR} && docker compose up -d api"
echo "  2. API health: curl -s http://127.0.0.1:4123/api/health"
echo "  3. Via nginx:  curl -s -H \"Host: ${SITE_NAME}\" http://127.0.0.1/api/health"
echo "  4. Public:     curl -s http://${SITE_NAME}/api/health"
echo ""
if ! curl -sf --max-time 2 http://127.0.0.1:4123/api/health >/dev/null 2>&1; then
  echo "[install-host-nginx] WARNING: nothing responding on 127.0.0.1:4123 — start container incoming-warehouse-api first." >&2
fi

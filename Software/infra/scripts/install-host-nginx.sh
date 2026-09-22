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

echo "[install-host-nginx] Testing nginx configuration..."
sudo nginx -t

echo "[install-host-nginx] Reloading nginx..."
sudo systemctl reload nginx

echo "[install-host-nginx] Done. Test:"
echo "  curl -s http://127.0.0.1:4123/api/health"
echo "  curl -s http://${SITE_NAME}/api/health"

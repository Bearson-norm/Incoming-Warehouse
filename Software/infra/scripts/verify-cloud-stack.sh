#!/usr/bin/env bash
# Quick health check for VPS cloud stack (run from Software/infra).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SITE_NAME="${CLOUD_SITE_NAME:-wis.moof-set.web.id}"

cd "${INFRA_DIR}"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose not found." >&2
  exit 1
fi

echo "=== docker compose ps ==="
"${COMPOSE[@]}" ps -a

echo ""
echo "=== API on 127.0.0.1:4123 ==="
if code=$(curl -s -o /tmp/iw-health.json -w "%{http_code}" --max-time 3 http://127.0.0.1:4123/api/health 2>/dev/null); then
  echo "HTTP ${code}: $(cat /tmp/iw-health.json 2>/dev/null || true)"
else
  echo "No response — run: docker compose up -d api && docker compose logs api --tail 40"
fi

echo ""
echo "=== nginx (Host: ${SITE_NAME}) on 127.0.0.1:80 ==="
if code=$(curl -s -o /tmp/iw-nginx.json -w "%{http_code}" --max-time 3 -H "Host: ${SITE_NAME}" http://127.0.0.1/api/health 2>/dev/null); then
  echo "HTTP ${code}: $(cat /tmp/iw-nginx.json 2>/dev/null | head -c 200)"
else
  echo "No response on port 80"
fi

echo ""
echo "=== public URL ==="
curl -s -o /dev/null -w "http://${SITE_NAME}/api/health → HTTP %{http_code}\n" --max-time 5 "http://${SITE_NAME}/api/health" || true

echo ""
echo "=== sites-enabled ==="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true

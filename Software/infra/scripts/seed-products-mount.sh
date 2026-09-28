#!/usr/bin/env bash
# Seed RM CSV using the *existing* API image + files from git (no docker build).
# Use when `docker compose build api` fails with ENOSPC.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INFRA="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/Dashboard/api"

cd "$INFRA"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-admin}"
POSTGRES_DB="${POSTGRES_DB:-wis_foom}"
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "Set POSTGRES_PASSWORD in $INFRA/.env"
  exit 1
fi

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"

if [[ ! -f "$API/data/products-rm.csv" ]]; then
  echo "Missing $API/data/products-rm.csv — run git pull."
  exit 1
fi

if [[ ! -f "$API/dist-scripts/scripts/import-products-csv.js" ]]; then
  echo "[seed] Building dist-scripts on host (API-only npm install)..."
  (cd "$API" && npm run install:vps-api-only && npm run build:scripts)
fi

echo "[seed] Running import inside Docker network (existing api image)..."
docker compose run --rm --no-deps \
  -e DATABASE_URL \
  -v "$API/data:/app/data:ro" \
  -v "$API/dist-scripts:/app/dist-scripts:ro" \
  --entrypoint node \
  api /app/dist-scripts/scripts/import-products-csv.js

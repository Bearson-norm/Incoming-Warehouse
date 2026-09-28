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

if [[ ! -d "$API/node_modules/@prisma/client" ]]; then
  echo "[seed] Installing API dependencies on host..."
  (cd "$API" && npm run install:vps-api-only)
fi

if [[ ! -f "$API/dist-scripts/scripts/import-products-csv.js" ]]; then
  echo "[seed] Compiling import script..."
  (cd "$API" && npm run build:scripts)
fi

echo "[seed] Generating Prisma client from current schema (vendorId, prodArea)..."
(cd "$API" && npx prisma generate)

WS_NODE="$ROOT/node_modules"
PRISMA_BIN="$WS_NODE/.bin/prisma"
if [[ ! -d "$WS_NODE/@prisma/client" ]]; then
  echo "Prisma client not found at $WS_NODE/@prisma/client — run: (cd $API && npm run install:vps-api-only && npx prisma generate)"
  exit 1
fi
if [[ ! -x "$PRISMA_BIN" ]]; then
  echo "Prisma CLI not found at $PRISMA_BIN"
  exit 1
fi

run_in_api_network() {
  # Sibling mounts: avoid nesting volumes under a read-only /app tree.
  docker compose run --rm --no-deps \
    -e DATABASE_URL \
    -e NODE_PATH=/workspace/node_modules \
    -v "$API:/workspace/api:ro" \
    -v "$WS_NODE:/workspace/node_modules:ro" \
    -w /workspace/api \
    "$@"
}

echo "[seed] Applying migrations from git (image API may be outdated)..."
run_in_api_network --entrypoint /workspace/node_modules/.bin/prisma api migrate deploy

echo "[seed] Importing products CSV..."
run_in_api_network --entrypoint node api dist-scripts/scripts/import-products-csv.js

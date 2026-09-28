#!/usr/bin/env bash
# Shared Docker network runner for API scripts (migrate / seed) without rebuilding image.
set -euo pipefail

docker_api_run_prepare() {
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
  INFRA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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

  if [[ ! -d "$API/node_modules/@prisma/client" ]] && [[ ! -d "$ROOT/node_modules/@prisma/client" ]]; then
    echo "[seed] Installing API dependencies on host..."
    (cd "$API" && npm run install:vps-api-only)
  fi

  echo "[seed] Generating Prisma client from current schema..."
  (cd "$API" && npx prisma generate)

  WS_NODE="$ROOT/node_modules"
  if [[ ! -d "$WS_NODE/@prisma/client" ]]; then
    echo "Prisma client not found at $WS_NODE/@prisma/client"
    exit 1
  fi
  if [[ ! -x "$WS_NODE/.bin/prisma" ]]; then
    echo "Prisma CLI not found at $WS_NODE/.bin/prisma"
    exit 1
  fi

  if [[ ! -f "$API/dist-scripts/scripts/import-products-csv.js" ]] \
    || [[ ! -f "$API/dist-scripts/scripts/import-tare-packagings-csv.js" ]]; then
    echo "[seed] Compiling seed scripts..."
    (cd "$API" && npm run build:scripts)
  fi

  export DOCKER_API_ROOT="$ROOT"
  export DOCKER_API_INFRA="$INFRA"
  export DOCKER_API_API="$API"
  export DOCKER_API_WS_NODE="$WS_NODE"
}

run_in_api_network() {
  docker compose run --rm --no-deps \
    -e DATABASE_URL \
    -e NODE_PATH=/workspace/node_modules \
    -v "$DOCKER_API_API:/workspace/api:ro" \
    -v "$DOCKER_API_WS_NODE:/workspace/node_modules:ro" \
    -w /workspace/api \
    "$@"
}

docker_api_migrate_deploy() {
  echo "[seed] Applying migrations from git (image API may be outdated)..."
  run_in_api_network --entrypoint /workspace/node_modules/.bin/prisma api migrate deploy
}

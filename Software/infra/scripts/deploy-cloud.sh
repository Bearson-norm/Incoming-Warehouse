#!/usr/bin/env bash
# Rebuild and start the VPS cloud stack (PostgreSQL + API + web + nginx).
# Run from the repo root or from Software/infra. Does not overwrite .env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ ! -f "${INFRA_DIR}/docker-compose.yml" ]]; then
  echo "docker-compose.yml not found in ${INFRA_DIR}" >&2
  exit 1
fi

if [[ ! -f "${INFRA_DIR}/.env" ]]; then
  echo "Missing ${INFRA_DIR}/.env" >&2
  echo "Copy Software/infra/.env.example to that path on the VPS and fill the secrets." >&2
  exit 1
fi

cd "${INFRA_DIR}"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose is not installed on this host." >&2
  exit 1
fi

echo "[deploy-cloud] Building and starting cloud services..."
"${COMPOSE[@]}" up -d --build

echo "[deploy-cloud] Waiting for API health..."
for _ in $(seq 1 40); do
  if "${COMPOSE[@]}" exec -T api wget --quiet --tries=1 --spider http://localhost:4123/api/health; then
    echo "[deploy-cloud] API is healthy."
    "${COMPOSE[@]}" ps
    exit 0
  fi
  sleep 3
done

echo "[deploy-cloud] API did not become healthy. Recent logs:" >&2
"${COMPOSE[@]}" logs --tail=80 api
exit 1

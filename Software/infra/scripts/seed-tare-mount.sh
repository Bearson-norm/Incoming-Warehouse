#!/usr/bin/env bash
# Seed jerigen tare CSV using existing API image + host git tree (no docker build).
set -euo pipefail
# shellcheck source=lib/docker-api-run.sh
source "$(dirname "$0")/lib/docker-api-run.sh"

docker_api_run_prepare

if [[ ! -f "$DOCKER_API_API/data/standar-tare-jerrycan.csv" ]]; then
  echo "Missing $DOCKER_API_API/data/standar-tare-jerrycan.csv — run git pull."
  exit 1
fi

if [[ ! -f "$DOCKER_API_API/dist-scripts/scripts/import-tare-packagings-csv.js" ]]; then
  (cd "$DOCKER_API_API" && npm run build:scripts)
fi

docker_api_migrate_deploy

echo "[seed] Importing tare / packaging CSV..."
run_in_api_network --entrypoint node api dist-scripts/scripts/import-tare-packagings-csv.js

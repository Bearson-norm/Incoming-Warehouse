#!/usr/bin/env bash
# Seed RM CSV using the *existing* API image + files from git (no docker build).
set -euo pipefail
# shellcheck source=lib/docker-api-run.sh
source "$(dirname "$0")/lib/docker-api-run.sh"

docker_api_run_prepare

if [[ ! -f "$DOCKER_API_API/data/products-rm.csv" ]]; then
  echo "Missing $DOCKER_API_API/data/products-rm.csv — run git pull."
  exit 1
fi

docker_api_migrate_deploy

echo "[seed] Importing products CSV..."
run_in_api_network --entrypoint node api dist-scripts/scripts/import-products-csv.js

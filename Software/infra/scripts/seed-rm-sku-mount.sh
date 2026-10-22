#!/usr/bin/env bash
# Replace RmCode master from data/rm-sku-inbound.csv (soft-delete + upsert, no vendor).
set -euo pipefail
# shellcheck source=lib/docker-api-run.sh
source "$(dirname "$0")/lib/docker-api-run.sh"

docker_api_run_prepare

if [[ ! -f "$DOCKER_API_API/data/rm-sku-inbound.csv" ]]; then
  echo "Missing $DOCKER_API_API/data/rm-sku-inbound.csv — run git pull or sync Dashboard/api."
  exit 1
fi

docker_api_migrate_deploy

echo "[seed] Replacing RM codes from rm-sku-inbound.csv..."
export RM_SKU_FORCE=1
run_in_api_network --entrypoint node api dist-scripts/scripts/replace-rm-codes-csv.js

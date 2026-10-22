#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations..."
npx prisma migrate deploy

sync_rm="${RM_SKU_SYNC_ON_START:-1}"
case "$sync_rm" in
  0|false|FALSE|no|NO|off|OFF) sync_rm=0 ;;
  *) sync_rm=1 ;;
esac

if [ "$sync_rm" = "1" ] && [ -f data/rm-sku-inbound.csv ]; then
  echo "[entrypoint] Checking bundled RM SKU master (data/rm-sku-inbound.csv)..."
  node dist-scripts/scripts/replace-rm-codes-csv.js
else
  echo "[entrypoint] RM SKU auto-sync skipped (RM_SKU_SYNC_ON_START=$sync_rm)."
fi

echo "[entrypoint] Starting API..."
exec npm run start:prod

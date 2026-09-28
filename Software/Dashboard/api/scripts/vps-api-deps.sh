#!/usr/bin/env bash
# Install only Dashboard/api dependencies on VPS (no full monorepo / Electron / web).
# Run as deploy user (e.g. foom), not root.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "[vps-api-deps] Installing API package only (--ignore-workspaces)..."
npm install --ignore-workspaces
echo "[vps-api-deps] Done. Prisma: $(./node_modules/.bin/prisma version 2>/dev/null | head -1 || echo 'run from Dashboard/api')"

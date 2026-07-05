#!/usr/bin/env bash
# Build + release the Oathbound server and client, then restart the service.
# Run on the VPS from a checkout of the repo, as the deploy user (the one that
# owns /srv/oathbound). Assumes setup.sh has already provisioned the box.
#
#   cd /srv/oathbound && git pull && deploy/deploy.sh
#
# What it does:
#   1. npm ci            reproducible install (builds better-sqlite3 native addon)
#   2. npm run build         client → dist/
#   3. npm run server:build  server → dist-server/server.mjs (migrations run at boot)
#   4. systemctl restart oathbound  (graceful: flushes characters on SIGTERM first)
#
# Env: OATHBOUND_SERVICE (default oathbound). Set SKIP_INSTALL=1 to reuse node_modules.
set -euo pipefail

SERVICE="${OATHBOUND_SERVICE:-oathbound}"
cd "$(dirname "$0")/.."                      # repo root, regardless of cwd
echo "[deploy] releasing from $(pwd) @ $(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"

if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  npm ci
fi
npm run build
npm run server:build

# Restart under systemd if available; otherwise tell the operator to run it.
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "^${SERVICE}.service"; then
  echo "[deploy] restarting $SERVICE"
  sudo systemctl restart "$SERVICE"
  sleep 1
  systemctl --no-pager --lines=5 status "$SERVICE" || true
else
  echo "[deploy] built dist/ and dist-server/. systemd unit '$SERVICE' not found —"
  echo "[deploy] install deploy/oathbound.service (see deploy/README.md) then: systemctl restart $SERVICE"
fi
echo "[deploy] done."

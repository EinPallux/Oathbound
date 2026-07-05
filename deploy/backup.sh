#!/usr/bin/env bash
# Nightly Oathbound DB backup: online (WAL-safe) SQLite backup → gzip → rotate.
# Safe to run while the server is live. Installed as a systemd timer by setup.sh
# (or wire it into cron). Manual run:  sudo -u oathbound deploy/backup.sh
#
# Env (all optional — defaults match the production layout):
#   OATHBOUND_DB          source DB            (default /var/lib/oathbound/oathbound.db)
#   OATHBOUND_BACKUP_DIR  backup destination   (default /var/backups/oathbound)
#   OATHBOUND_APP_DIR     app dir w/ node_modules (default /srv/oathbound)
#   OATHBOUND_KEEP_DAILY  daily backups to keep (default 7)
set -euo pipefail

DB="${OATHBOUND_DB:-/var/lib/oathbound/oathbound.db}"
BACKUP_DIR="${OATHBOUND_BACKUP_DIR:-/var/backups/oathbound}"
APP_DIR="${OATHBOUND_APP_DIR:-/srv/oathbound}"
KEEP_DAILY="${OATHBOUND_KEEP_DAILY:-7}"

if [[ ! -f "$DB" ]]; then
  echo "[backup] source DB not found: $DB" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F)"                        # YYYY-MM-DD (one backup per day; re-runs overwrite)
RAW="$BACKUP_DIR/oathbound-$STAMP.db"
GZ="$RAW.gz"

# Online backup via the better-sqlite3 API (falls back to the sqlite3 CLI if present).
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$RAW'"
else
  ( cd "$APP_DIR" && node deploy/sqlite-backup.mjs "$DB" "$RAW" )
fi

gzip -f "$RAW"                              # → $GZ
echo "[backup] wrote $GZ ($(du -h "$GZ" | cut -f1))"

# Rotate: keep the newest $KEEP_DAILY daily archives, delete the rest.
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/oathbound-*.db.gz 2>/dev/null | tail -n +"$((KEEP_DAILY + 1))")
if ((${#OLD[@]})); then
  printf '%s\n' "${OLD[@]}" | xargs -r rm -f
  echo "[backup] rotated out ${#OLD[@]} old backup(s)"
fi

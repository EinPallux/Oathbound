#!/usr/bin/env bash
# Restore an Oathbound DB from a nightly backup. Stops the server (so nothing is
# writing), swaps the DB into place, and restarts. The current DB is kept as a
# .pre-restore copy so a bad restore is itself reversible.
#
#   sudo deploy/restore.sh /var/backups/oathbound/oathbound-2026-07-04.db.gz
#   sudo deploy/restore.sh                # no arg → restores the NEWEST backup
#
# Env: OATHBOUND_DB, OATHBOUND_BACKUP_DIR, OATHBOUND_SERVICE (default oathbound).
set -euo pipefail

DB="${OATHBOUND_DB:-/var/lib/oathbound/oathbound.db}"
BACKUP_DIR="${OATHBOUND_BACKUP_DIR:-/var/backups/oathbound}"
SERVICE="${OATHBOUND_SERVICE:-oathbound}"

SRC="${1:-}"
if [[ -z "$SRC" ]]; then
  SRC="$(ls -1t "$BACKUP_DIR"/oathbound-*.db.gz 2>/dev/null | head -n1 || true)"
  [[ -n "$SRC" ]] || { echo "[restore] no backups in $BACKUP_DIR" >&2; exit 1; }
  echo "[restore] no file given — using newest: $SRC"
fi
[[ -f "$SRC" ]] || { echo "[restore] backup not found: $SRC" >&2; exit 1; }

# Decompress to a temp file and sanity-check it's a valid SQLite DB before swapping.
TMP="$(mktemp "${DB}.restore.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
case "$SRC" in
  *.gz) gunzip -c "$SRC" > "$TMP" ;;
  *)    cp "$SRC" "$TMP" ;;
esac
if ! head -c 16 "$TMP" | grep -q "SQLite format 3"; then
  echo "[restore] $SRC does not look like a SQLite database — aborting" >&2
  exit 1
fi

# Stop the server if systemd manages it (ignore if not installed / not running).
STOPPED=0
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
  echo "[restore] stopping $SERVICE"
  systemctl stop "$SERVICE"
  STOPPED=1
fi

# Preserve the current DB (and drop stale WAL/SHM so SQLite rebuilds them cleanly).
if [[ -f "$DB" ]]; then
  cp -f "$DB" "$DB.pre-restore"
  echo "[restore] current DB saved as $DB.pre-restore"
fi
rm -f "$DB-wal" "$DB-shm"
mkdir -p "$(dirname "$DB")"
mv -f "$TMP" "$DB"
trap - EXIT
echo "[restore] restored $SRC → $DB"

if ((STOPPED)); then
  echo "[restore] starting $SERVICE"
  systemctl start "$SERVICE"
fi
echo "[restore] done."

#!/usr/bin/env bash
# One-time VPS provisioning for an Oathbound friends server on Ubuntu 24.04 LTS.
# Run as root on a fresh box:  sudo bash deploy/setup.sh play.yourdomain.de
#
# It installs Node 22 + Caddy, creates a non-root service user, lays out the
# runtime dirs, opens the firewall, and installs the systemd units + backup timer
# from this deploy/ dir. It is idempotent — safe to re-run. It does NOT build or
# start the game (do that with deploy/deploy.sh once code is in /srv/oathbound).
#
# After it finishes: put the repo in /srv/oathbound, edit /etc/oathbound/server.env
# and /etc/caddy/Caddyfile, then run deploy/deploy.sh. Full walkthrough:
# docs/technical/VPS_HOSTING_GUIDE.md.
set -euo pipefail

[[ "$(id -u)" -eq 0 ]] || { echo "run as root (sudo bash deploy/setup.sh <domain>)" >&2; exit 1; }

DOMAIN="${1:-}"
SERVICE_USER="oathbound"
APP_DIR="/srv/oathbound"
DATA_DIR="/var/lib/oathbound"
BACKUP_DIR="/var/backups/oathbound"
CONF_DIR="/etc/oathbound"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "==> apt base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
# build-essential + python3: better-sqlite3 native build. sqlite3: optional CLI (backup fallback).
apt-get install -y ufw git curl ca-certificates gnupg build-essential python3 sqlite3

echo "==> Node 22 LTS (NodeSource)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "    node $(node -v) · npm $(npm -v)"

echo "==> Caddy (official apt repo)"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> service user + directories"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
mkdir -p "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR" "$CONF_DIR" /var/log/caddy
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR" "$BACKUP_DIR"

echo "==> config file"
if [[ ! -f "$CONF_DIR/server.env" ]]; then
  cp "$HERE/server.env.example" "$CONF_DIR/server.env"
  chown root:"$SERVICE_USER" "$CONF_DIR/server.env"
  chmod 640 "$CONF_DIR/server.env"
  echo "    wrote $CONF_DIR/server.env (edit admins/join password before going live)"
else
  echo "    $CONF_DIR/server.env exists — left untouched"
fi

echo "==> Caddyfile"
if [[ -n "$DOMAIN" ]]; then
  sed "s/play\.yourdomain\.de/$DOMAIN/" "$HERE/Caddyfile" > /etc/caddy/Caddyfile
  echo "    installed /etc/caddy/Caddyfile for $DOMAIN"
else
  [[ -f /etc/caddy/Caddyfile ]] || cp "$HERE/Caddyfile" /etc/caddy/Caddyfile
  echo "    no domain arg given — edit /etc/caddy/Caddyfile and set your domain"
fi

echo "==> systemd units"
cp "$HERE/oathbound.service" /etc/systemd/system/oathbound.service
cp "$HERE/oathbound-backup.service" /etc/systemd/system/oathbound-backup.service
cp "$HERE/oathbound-backup.timer" /etc/systemd/system/oathbound-backup.timer
systemctl daemon-reload
systemctl enable oathbound.service >/dev/null
systemctl enable --now oathbound-backup.timer >/dev/null
echo "    enabled oathbound.service (not started — no build yet) + nightly backup timer"

echo "==> firewall (UFW: SSH + HTTP + HTTPS)"
ufw allow OpenSSH >/dev/null || ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
echo "    ufw active: $(ufw status | head -n1)"

cat <<EOF

==> provisioning complete. Next:
  1. Put the repo at $APP_DIR (git clone … $APP_DIR) owned by you (the deploy user).
  2. Edit $CONF_DIR/server.env  (set OATHBOUND_ADMINS, join password, etc.)
  3. Edit /etc/caddy/Caddyfile   (confirm your domain) then: systemctl reload caddy
  4. Build + launch:  cd $APP_DIR && deploy/deploy.sh
  5. Open https://${DOMAIN:-your-domain} and play.
Guide: docs/technical/VPS_HOSTING_GUIDE.md
EOF

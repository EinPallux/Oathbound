# `deploy/` — Oathbound server ops kit

Everything needed to run an Oathbound friends server on a Linux VPS: provision
once, deploy on every update, and back up nightly. The full narrative walkthrough
(what VPS to buy, DNS, first login) is in
[docs/technical/VPS_HOSTING_GUIDE.md](../docs/technical/VPS_HOSTING_GUIDE.md);
this directory is the concrete, copy-pasteable set of files that guide refers to.

## What's here

| File | Role |
|---|---|
| `setup.sh` | **One-time** provisioning for fresh Ubuntu 24.04: Node 22, Caddy, service user, dirs, firewall, systemd units. Idempotent. |
| `deploy.sh` | **Every update:** `npm ci` → build client + server → `systemctl restart`. Run from the repo checkout on the box. |
| `Caddyfile` | Reverse proxy + static host. Serves `dist/`, proxies `/ws` → `127.0.0.1:8080`, auto-TLS. Copy to `/etc/caddy/Caddyfile`. |
| `oathbound.service` | systemd unit for the game server (auto-restart, graceful SIGTERM flush, sandboxing). → `/etc/systemd/system/`. |
| `oathbound-backup.service` + `.timer` | Nightly backup job (04:00) via systemd timer. → `/etc/systemd/system/`. |
| `server.env.example` | All config knobs with defaults. Copy to `/etc/oathbound/server.env`. |
| `backup.sh` | WAL-safe online SQLite backup → gzip → rotate (keep 7 daily). |
| `restore.sh` | Stop → swap DB from a backup (validated first) → start. Keeps a `.pre-restore` copy. |
| `sqlite-backup.mjs` | Helper: online `.backup()` via better-sqlite3 (no system `sqlite3` needed). |

## Runtime layout on the box

```
/srv/oathbound/                 the repo checkout (built dist/ + dist-server/ live here)
/etc/oathbound/server.env       config (systemd EnvironmentFile)
/etc/caddy/Caddyfile            reverse proxy + TLS
/var/lib/oathbound/oathbound.db SQLite (WAL) — accounts, characters, world state
/var/backups/oathbound/*.db.gz  nightly backups (rotated, keep 7)
```

## First-time setup

```bash
# on a fresh Ubuntu 24.04 VPS, as root
git clone https://github.com/EinPallux/Oathbound /srv/oathbound
cd /srv/oathbound
sudo bash deploy/setup.sh play.yourdomain.de     # installs everything; pass your real domain
# point play.yourdomain.de's DNS A record at the VPS IP first, so Caddy can get a cert

sudo nano /etc/oathbound/server.env               # set OATHBOUND_ADMINS, join password
sudo systemctl reload caddy
deploy/deploy.sh                                  # build + start the server
```

Open `https://play.yourdomain.de` and register. The first login of a name listed
in `OATHBOUND_ADMINS` is auto-promoted to admin (`/admin help` in chat).

## Updating

```bash
cd /srv/oathbound && git pull && deploy/deploy.sh
```

Migrations run automatically at server boot. The restart is graceful — every
in-world character is flushed to SQLite on SIGTERM before the process exits.

## Backups & restore

Backups run nightly via `oathbound-backup.timer`. Run one on demand, or restore:

```bash
sudo -u oathbound deploy/backup.sh                    # make a backup now
systemctl list-timers oathbound-backup.timer          # confirm the schedule
sudo deploy/restore.sh                                 # restore the NEWEST backup
sudo deploy/restore.sh /var/backups/oathbound/oathbound-2026-07-04.db.gz   # a specific one
```

`restore.sh` stops the service, validates the archive is a real SQLite DB, keeps
the current DB as `oathbound.db.pre-restore`, swaps in the backup, and restarts.
The online backup is WAL-safe, so `backup.sh` never needs the server stopped.

## Admin commands (in-game chat, admin flag required)

`/who` · `/admin kick <name>` · `/admin ban <name>` · `/admin broadcast <msg>` ·
`/admin save` · `/admin shutdown [seconds]`. See `server/game.ts`.

## Notes

- The systemd unit sandboxes the service to `/var/lib/oathbound` and
  `/var/backups/oathbound` (`ReadWritePaths`). If you move the DB, update both the
  env file and the unit's `ReadWritePaths`.
- No system `sqlite3` package is required — `backup.sh` uses the better-sqlite3
  driver the server already bundles (it will use the `sqlite3` CLI if present).
- Capacity: the 2 vCPU / 4 GB box is validated by the 20-bot load test
  (`npm run server:loadtest`); see the hosting guide's capacity section.

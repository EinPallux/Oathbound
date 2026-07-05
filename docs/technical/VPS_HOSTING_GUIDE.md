# VPS Hosting Guide — what to buy and how to run the server

Everything the owner needs to pick a VPS, set it up, and run the Oathbound server for friends. Architecture context: [MMO_ARCHITECTURE](./MMO_ARCHITECTURE.md); the ops phase that finalized the scripts referenced here is [M7](../production/MMO_ROADMAP.md#m7--ops--hardening-the-vps-is-a-product-now). **All the scripts and config files below ship in [`deploy/`](../../deploy/README.md)** — this guide is the narrative; that directory is the copy-pasteable source of truth.

## 1. Why the requirements are small

Rendering happens in each player's browser — the server never touches the GPU. It runs one Node process ticking an ECS-lite sim (≈90 enemies + ≤20 players) at 30 Hz and pushes small JSON snapshots (~15–40 kbit/s per player). SQLite is in-process (no database server to run). Almost any modern VPS is enough; the spec below buys comfort, not necessity.

## 2. The exact VPS to get

**Recommended spec (the "buy this" line):**

| Feature | Requirement | Why |
|---|---|---|
| **vCPU** | **2 vCPU** (shared is fine; prefer good single-core, e.g. modern AMD EPYC) | the sim tick is single-threaded → 1 core for the game, 1 for OS/Caddy/backups/builds |
| **RAM** | **4 GB** | Node + world ≈ a few hundred MB; headroom for OS, Caddy, `npm ci`/builds on-box |
| **Disk** | **40 GB NVMe/SSD** | OS + Node + app ≈ <10 GB; SQLite DB is MBs; room for backups/logs |
| **Network** | 1 IPv4 address, ≥1 Gbps port, ≥1 TB/month traffic (any provider's default) | 20 players ≈ <1 Mbit/s sustained — traffic is a rounding error |
| **OS** | **Ubuntu 24.04 LTS** (64-bit) | boring, documented, supported until 2029 |
| **Access** | full **root SSH** (an unmanaged/"cloud" VPS, not shared webhosting) | we install Node/Caddy/systemd services ourselves |
| **Firewall/ports** | ability to open **22, 80, 443** (TCP) | SSH + HTTP(S)/WSS; game traffic rides 443 |
| **Extras worth ticking** | provider **automated backups/snapshots** (~+20% cost) | second safety net under our own nightly SQLite backups |
| **NOT needed** | GPU, Windows, cPanel/Plesk, managed database, multiple IPs, high-frequency/dedicated CPU tiers | rendering is client-side; SQLite is embedded; one process |

**Location:** pick the datacenter closest to your friend group — for a German/EU group, **Germany** (Nuremberg/Falkenstein/Frankfurt) gives everyone ~10–40 ms ping.

**Concrete examples that match (v1 pricing, verify at purchase):**
- **Hetzner Cloud CX22** — 2 vCPU, 4 GB RAM, 40 GB NVMe, 20 TB traffic, ~€4–5/mo, German DCs. **The default recommendation.** (CPX21 if you want dedicated-ish AMD cores.)
- Netcup VPS 1000 / Contabo Cloud VPS S — similar or bigger for similar money.
- DigitalOcean Basic 2 vCPU/4 GB (~$24) or Vultr equivalents — fine, pricier, choose only for non-EU groups.

Absolute minimum that still works for ~5 friends: 1 vCPU / 2 GB / 20 GB (e.g. Hetzner CX11-class) — but the 4 GB tier removes all thought for ~€1–2/mo more.

**Also get (not part of the VPS):** a **domain or subdomain** (~€3–12/yr, e.g. `play.yourdomain.de`) pointed at the VPS IP. It's what makes real TLS (`https://` + `wss://`) automatic via Caddy — browsers require secure WebSockets on secure pages, so this is effectively required for a pleasant setup. (Zero-cost fallback: a free dynamic-DNS name like DuckDNS works with Caddy too.)

## 3. Server layout on the box

```
Internet ──443──► Caddy ──┬── serves /srv/oathbound/dist        (the built client, static)
                          └── proxies /ws ──► 127.0.0.1:8080    (Node game server, ws)
oathbound.service (systemd) ──► node /srv/oathbound/dist-server/server.mjs
/var/lib/oathbound/oathbound.db          SQLite (WAL) — all accounts/characters/world state
/var/backups/oathbound/*.db.gz           nightly backups (rotated)
```

One box serves both the game client (no Vercel needed for online play; Vercel can keep hosting the solo build) and the WebSocket server on the same domain — no CORS, one certificate, one thing to run.

## 4. Initial setup (once, ~30 minutes)

The whole provisioning below is automated by **[`deploy/setup.sh`](../../deploy/setup.sh)** — one idempotent script that installs Node 22 + Caddy, creates the non-root `oathbound` service user, lays out `/var/lib/oathbound` + `/var/backups/oathbound`, opens the firewall, and installs the systemd units + nightly backup timer:

```bash
# as root on a fresh Ubuntu 24.04 VPS, with the repo cloned to /srv/oathbound
# (point your domain's DNS A record at the VPS IP first, so Caddy can get a cert)
git clone https://github.com/EinPallux/Oathbound /srv/oathbound
sudo bash /srv/oathbound/deploy/setup.sh play.yourdomain.de
```

What it installs, and the files it copies into place (edit these, then `sudo systemctl reload caddy`):

- **[`deploy/Caddyfile`](../../deploy/Caddyfile)** → `/etc/caddy/Caddyfile` — auto-TLS, serves `dist/`, proxies `/ws` → `127.0.0.1:8080` (the domain arg to `setup.sh` is substituted in).
- **[`deploy/oathbound.service`](../../deploy/oathbound.service)** → `/etc/systemd/system/` — the game server (auto-restart, graceful SIGTERM flush, `ReadWritePaths` sandboxing).
- **[`deploy/server.env.example`](../../deploy/server.env.example)** → `/etc/oathbound/server.env` — all config knobs (port, map, join password, admins, autosave, seed).
- **[`deploy/oathbound-backup.{service,timer}`](../../deploy/)** → `/etc/systemd/system/` — the nightly backup job.

If you'd rather do it by hand, the script is short and readable — follow it step by step.

## 5. Deploying the game (every update)

M7 ships this as **[`deploy/deploy.sh`](../../deploy/deploy.sh)** — run it from the checkout on the box:

```bash
cd /srv/oathbound && git pull && deploy/deploy.sh
```

It runs `npm ci` → `npm run build` (client → `dist/`) → `npm run server:build` (server → `dist-server/`) → `sudo systemctl restart oathbound`. DB migrations run automatically at server boot; the restart is graceful (every in-world character is flushed to SQLite on SIGTERM first).

(Alternative the guide also supports: build locally / in CI and `rsync` the two dist folders — no toolchain on the box.)

## 6. Server configuration

Config is env-based, read by the systemd unit from `/etc/oathbound/server.env` (copied from **[`deploy/server.env.example`](../../deploy/server.env.example)**): port, map name (`talar` or any AdminTools-built map placed in `public/maps/`), join password (friends-only lock), admin usernames, autosave interval, snapshot rate, RNG seed. Every value has a sensible default (see `server/config.ts`) — uncomment only what you want to change.

## 7. Backups

- **Nightly systemd timer** (installed by `setup.sh`): **[`deploy/backup.sh`](../../deploy/backup.sh)** runs a WAL-safe online SQLite backup → gzip → rotate (keep 7 daily). It uses the better-sqlite3 driver the server already bundles, so no extra `sqlite3` package is required (it will use the `sqlite3` CLI if one is present). WAL mode makes the backup safe while the server runs — nothing is stopped. Run one on demand with `sudo -u oathbound /srv/oathbound/deploy/backup.sh`; check the schedule with `systemctl list-timers oathbound-backup.timer`.
- **Restore drill** (tested in M7, and re-run in the M7 verify): **[`deploy/restore.sh`](../../deploy/restore.sh)** stops the service, validates the archive is a real SQLite DB, keeps the current DB as `oathbound.db.pre-restore`, swaps in the backup (dropping stale WAL/SHM), and restarts — `sudo /srv/oathbound/deploy/restore.sh` restores the newest backup, or pass a specific `*.db.gz`. The drill was verified end-to-end: an online backup taken against a live (WAL-hot) DB, a subsequent write, then a restore that correctly rolled back to the backup's state.
- Optional belt-and-braces: provider snapshots (tick the box at purchase) and/or Litestream replication to any S3-compatible bucket.

## 8. Operating checklist

| Task | How |
|---|---|
| Status / logs | `systemctl status oathbound` · `journalctl -u oathbound -f` |
| Who's online | `/who` in-game, or the admin command channel |
| Update game | `deploy/deploy.sh` (section 5) |
| Backup now / restore | `deploy/backup.sh` · `deploy/restore.sh` (section 7) |
| OS patches | `apt upgrade` monthly; `unattended-upgrades` is fine to enable |
| Disk/RAM glance | `df -h`, `free -h` — the game should never be the problem at this scale |

## 9. Capacity honesty

The 2 vCPU/4 GB box is validated by the M7 bot soak (`npm run server:loadtest`, 20 simulated players moving + fighting). **Measured result** (20/20 bots connected, on a shared dev container — a real VPS core is faster):

| Metric | Measured | Budget / note |
|---|---|---|
| Sim step time | **avg ~0.6 ms · max ~1.85 ms** | 33 ms budget → ~2% used, comfortably under the ≤16 ms gate |
| Downstream per player | **~280 kbit/s** | higher than the sparse ~15–40 kbit/s estimate because snapshots currently carry **all** entities (no interest management yet) |
| Aggregate downstream (20) | **~5.6 Mbit/s** | a rounding error on a 1 Gbps port |
| Snapshot rate per player | ~15/s | matches `OATHBOUND_SNAPSHOT_HZ=15` |

The honest finding: **CPU is a non-issue at friends scale** (the sim barely registers), and **bandwidth is the first thing that would grow** — it scales with players × entities because every player currently gets the whole world each snapshot. It's still trivial here, but that's the lever that moves first. So if the friend group ever outgrows this box, the order is: **interest-radius snapshots** (only send nearby entities — the big win) → delta encoding → a bigger single box (the sim is single-core-bound, so prefer faster cores over more cores). Multi-process sharding is deliberately out of scope.

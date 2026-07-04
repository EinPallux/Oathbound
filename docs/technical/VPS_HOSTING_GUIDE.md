# VPS Hosting Guide — what to buy and how to run the server

Everything the owner needs to pick a VPS, set it up, and run the Oathbound server for friends. Architecture context: [MMO_ARCHITECTURE](./MMO_ARCHITECTURE.md); the ops phase that finalizes the scripts referenced here is [M7](../production/MMO_ROADMAP.md#m7--ops--hardening-the-vps-is-a-product-now).

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

```bash
# as root on the fresh Ubuntu 24.04 VPS
adduser oathbound && usermod -aG sudo oathbound        # non-root admin user; put your SSH key in place
apt update && apt -y upgrade
apt -y install ufw git build-essential python3          # build-essential/python3: better-sqlite3 native build
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# Node 22 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt -y install nodejs

# Caddy (auto-HTTPS reverse proxy) — official apt repo, see caddyserver.com/docs/install
apt -y install debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt -y install caddy
```

`/etc/caddy/Caddyfile` (replace the domain):

```
play.yourdomain.de {
    root * /srv/oathbound/dist
    file_server
    @ws path /ws
    reverse_proxy @ws 127.0.0.1:8080
    encode gzip
}
```

`/etc/systemd/system/oathbound.service`:

```ini
[Unit]
Description=Oathbound game server
After=network-online.target

[Service]
User=oathbound
WorkingDirectory=/srv/oathbound
ExecStart=/usr/bin/node dist-server/server.mjs
Environment=OATHBOUND_DB=/var/lib/oathbound/oathbound.db
Restart=always
RestartSec=3
# graceful shutdown: server flushes all characters to SQLite on SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

## 5. Deploying the game (every update)

M7 ships this as `scripts/deploy.sh`; conceptually:

```bash
git pull                     # on the VPS, /srv/oathbound checkout of the repo
npm ci
npm run build                # client → dist/
npm run server:build         # server → dist-server/
sudo systemctl restart oathbound   # runs DB migrations at boot, then serves
```

(Alternative the guide also supports: build locally / in CI and `rsync` the two dist folders — no toolchain on the box.)

## 6. Server configuration

`server.toml` (or env vars): port, map name (`talar` or any AdminTools-built map placed in `dist/maps/`), max players, join password (friends-only lock), admin usernames, autosave interval, RNG seed. Documented defaults ship in the repo.

## 7. Backups

- **Nightly cron** (installed by M7): `sqlite3 /var/lib/oathbound/oathbound.db ".backup /var/backups/oathbound/$(date +%F).db"` + gzip + rotate (keep 7 daily / 4 weekly). WAL mode makes online backups safe while the server runs.
- Restore drill (tested in M7): stop service → copy backup over the DB path → start service.
- Optional belt-and-braces: provider snapshots (tick the box at purchase) and/or Litestream replication to any S3-compatible bucket.

## 8. Operating checklist

| Task | How |
|---|---|
| Status / logs | `systemctl status oathbound` · `journalctl -u oathbound -f` |
| Who's online | `/who` in-game, or the admin command channel |
| Update game | `scripts/deploy.sh` (section 5) |
| OS patches | `apt upgrade` monthly; `unattended-upgrades` is fine to enable |
| Disk/RAM glance | `df -h`, `free -h` — the game should never be the problem at this scale |

## 9. Capacity honesty

The 2 vCPU/4 GB box is validated by the M7 bot soak (20 simulated players; tick time must stay ≤ ~16 ms of the 33 ms budget). If the friend group ever outgrows it, the levers are, in order: interest-radius snapshots → delta encoding → a bigger single box (the sim is single-core-bound, so prefer faster cores over more cores). Multi-process sharding is deliberately out of scope.

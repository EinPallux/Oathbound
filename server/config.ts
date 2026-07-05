// Server configuration, resolved from environment variables with friends-server-friendly
// defaults. In production these come from the systemd unit / server.toml (see
// docs/technical/VPS_HOSTING_GUIDE.md); in dev, none are required — `npm run server:dev`
// boots the default Talar map on port 8080.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SIM_HZ } from '../src/core/time';

export interface ServerConfig {
  /** TCP port the WebSocket server listens on. */
  port: number;
  /** URL path clients connect to (Caddy proxies wss://host/ws → here in production). */
  wsPath: string;
  /** Map name (without extension), used in the welcome message + logging. */
  mapName: string;
  /** Absolute path to the `.oathbound-map.json` the world is built from. */
  mapPath: string;
  /** Simulation tick rate — fixed to the sim's DT (do not change without rescaling DT). */
  tickHz: number;
  /** Snapshot broadcast rate. */
  snapshotHz: number;
  /** Gameplay RNG seed — the authority for loot/crit/AI rolls. */
  seed: number;
  /** SQLite database file path (accounts, characters, world state). */
  dbPath: string;
  /** Optional server-wide join password (empty = open registration). Checked at register/login. */
  joinPassword: string;
  /** How often (seconds) to flush in-world characters to the DB. */
  saveIntervalS: number;
  /** Message of the day, sent to each player as they enter the world. */
  motd: string;
  /** Usernames (lower-cased) auto-promoted to admin on login (from OATHBOUND_ADMINS, comma-sep). */
  admins: string[];
  /** Max simultaneous connections from one *client* IP (behind Caddy, resolved from
   *  X-Forwarded-For — see server/net.ts). Headroom for a NAT'd household + reconnect overlap;
   *  raise for a local load test. */
  maxConnPerIp: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));
/** The server/ dir sits at the repo root; authored maps live in public/maps. */
const REPO_ROOT = resolve(HERE, '..');

function intEnv(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const mapName = env.OATHBOUND_MAP ?? 'talar';
  const mapDir = env.OATHBOUND_MAP_DIR ?? resolve(REPO_ROOT, 'public', 'maps');
  return {
    port: intEnv(env.OATHBOUND_PORT, 8080),
    wsPath: env.OATHBOUND_WS_PATH ?? '/ws',
    mapName,
    mapPath: resolve(mapDir, `${mapName}.oathbound-map.json`),
    tickHz: SIM_HZ,
    snapshotHz: intEnv(env.OATHBOUND_SNAPSHOT_HZ, 15),
    seed: intEnv(env.OATHBOUND_SEED, 0xc0ffee),
    dbPath: env.OATHBOUND_DB ?? resolve(REPO_ROOT, 'oathbound.db'),
    joinPassword: env.OATHBOUND_JOIN_PASSWORD ?? '',
    saveIntervalS: intEnv(env.OATHBOUND_SAVE_INTERVAL_S, 30),
    motd: env.OATHBOUND_MOTD ?? 'Welcome to Oathbound Online — be excellent to each other.',
    admins: (env.OATHBOUND_ADMINS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s !== ''),
    maxConnPerIp: intEnv(env.OATHBOUND_MAX_CONN_PER_IP, 16),
  };
}

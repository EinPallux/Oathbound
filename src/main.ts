// Entry point. Oathbound is an online-only MMORPG: the client always connects to an
// authoritative Oathbound server (src/game/online.ts drives login → character select → world).
//
// The client renders the same authored "talar" map the server runs (see DEFAULT_MAP), loaded
// from public/maps/talar.oathbound-map.json so terrain/scenery match the server deterministically.
// ?map=<name> loads a different custom map from public/maps/<name>.oathbound-map.json (or a
// path/url); ?map=none (also `off` or empty) renders the procedural world instead.
//
// The server to connect to is same-origin `/ws` by default (Caddy proxies wss://host/ws → the
// Node server in production); ?server=<ws-url|host> overrides it, and in dev it defaults to the
// local game server on :8080 (run `npm run server:dev` alongside `npm run dev`).
import './styles.css';
import { setActiveMap } from './world/active-map';
import { normalizeMap } from './world/map-format';
import { resolveMapUrl, mapNameHint } from './world/map-url';

/** The map loaded when the URL has no ?map= override. */
const DEFAULT_MAP = 'talar';

async function loadRequestedMap(): Promise<void> {
  const requested = new URLSearchParams(location.search).get('map');
  const lower = requested?.toLowerCase();
  // Explicit opt-out (?map=none / off / empty) → boot the procedural world.
  if (lower === '' || lower === 'none' || lower === 'off') return;
  const name = requested ?? DEFAULT_MAP;
  const url = resolveMapUrl(name, import.meta.env.BASE_URL);
  const hint = mapNameHint(name);
  const place = `Put the exported file at public/maps/${hint}.oathbound-map.json and load it with ?map=${hint}.`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Oathbound: map "${name}" not found (HTTP ${res.status}) at ${url}. ${place} Booting the default world.`);
      return;
    }
    // A missing file is often answered with the app's index.html (HTTP 200) on static
    // hosts — which would blow up as JSON. Detect that and explain it clearly.
    const text = await res.text();
    if (text.trimStart().startsWith('<')) {
      console.warn(`Oathbound: "${name}" resolved to a web page, not a map — the server returned HTML from ${url}, which usually means the file isn't there. ${place} Booting the default world.`);
      return;
    }
    setActiveMap(normalizeMap(JSON.parse(text)));
    console.info(`Oathbound: loaded custom map "${name}" from ${url}.`);
  } catch (err) {
    console.warn(`Oathbound: failed to load custom map "${name}" from ${url}; booting the default world.`, err);
  }
}

/**
 * Resolve a `?server=` value into a WebSocket URL. Accepts a full `ws(s)://host/path`, or a
 * bare `host[:port]` (defaults to ws/wss matching the page and the `/ws` path).
 */
function resolveServerUrl(raw: string): string {
  let s = raw.trim();
  if (!/^wss?:\/\//i.test(s)) {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    s = `${scheme}://${s}`;
  }
  try {
    const url = new URL(s);
    if (url.pathname === '' || url.pathname === '/') url.pathname = '/ws';
    return url.toString();
  } catch {
    return s;
  }
}

/** The Oathbound server this client connects to. `?server=` overrides; otherwise same-origin
 *  `/ws` in production (Caddy proxies it), or the local game server on :8080 in dev. */
function defaultServerUrl(): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  if (import.meta.env.DEV) return `ws://${location.hostname || '127.0.0.1'}:8080/ws`;
  return `${scheme}://${location.host}/ws`;
}

async function main(): Promise<void> {
  await loadRequestedMap();
  // Online-only: always connect to an authoritative Oathbound server. ?server=<ws-url|host>
  // overrides the target; ?user=&pass= auto-login and ?char=&class= auto-enter (dev/e2e).
  const params = new URLSearchParams(location.search);
  const server = params.get('server');
  const { bootOnline } = await import('./game/online');
  const cls = params.get('class');
  const charParam = params.get('char');
  const online = bootOnline({
    url: server ? resolveServerUrl(server) : defaultServerUrl(),
    user: params.get('user') ?? undefined,
    pass: params.get('pass') ?? undefined,
    char: charParam != null && charParam !== '' ? Number(charParam) : undefined,
    className: cls === 'hunter' || cls === 'priest' || cls === 'warrior' ? cls : undefined,
  });
  // Keep the teardown handle reachable (e.g. for a future reload-free logout / hot-reload).
  (window as unknown as { __oathboundOnline?: { stop(): void } }).__oathboundOnline = online;
}

void main();

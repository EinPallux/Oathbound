// Entry point. The app shell (src/game/app.ts) runs the onboarding flow — Login →
// Character Select → enter world — and boots the play session when a character is chosen.
//
// The game boots the authored "talar" map by default (see DEFAULT_MAP), loaded from
// public/maps/talar.oathbound-map.json. ?map=<name> loads a different custom map authored in
// the Admin Tools Map Builder from public/maps/<name>.oathbound-map.json (or ?map=<path|url>);
// ?map=none (also `off` or empty) boots the old procedural world instead.
import './styles.css';
import { runApp } from './game/app';
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

async function main(): Promise<void> {
  await loadRequestedMap();
  // Online mode: ?server=<ws-url|host> connects to a running Oathbound server (M1). Without it,
  // the game runs the local single-player experience exactly as before.
  const server = new URLSearchParams(location.search).get('server');
  if (server) {
    const { bootOnline } = await import('./game/online');
    bootOnline({ url: resolveServerUrl(server), name: new URLSearchParams(location.search).get('name') ?? undefined });
    return;
  }
  runApp();
}

void main();

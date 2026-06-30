// Entry point. The app shell (src/game/app.ts) runs the onboarding flow — Login →
// Character Select → enter world — and boots the play session when a character is chosen.
//
// Optional: ?map=<name> loads a custom map authored in the Admin Tools Map Builder from
// public/maps/<name>.oathbound-map.json (or ?map=<path|url>) and builds the world from it
// instead of the procedural generators. With no ?map= the default world boots unchanged.
import './styles.css';
import { runApp } from './game/app';
import { setActiveMap } from './world/active-map';
import { normalizeMap } from './world/map-format';
import { resolveMapUrl, mapNameHint } from './world/map-url';

async function loadRequestedMap(): Promise<void> {
  const name = new URLSearchParams(location.search).get('map');
  if (!name) return;
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

void loadRequestedMap().then(runApp);

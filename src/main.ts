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

async function loadRequestedMap(): Promise<void> {
  try {
    const name = new URLSearchParams(location.search).get('map');
    if (!name) return;
    const url = /[/.]/.test(name) ? name : `${import.meta.env.BASE_URL}maps/${name}.oathbound-map.json`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Oathbound: map "${name}" not found (${res.status}); booting the default world.`);
      return;
    }
    setActiveMap(normalizeMap(await res.json()));
    console.info(`Oathbound: loaded custom map "${name}".`);
  } catch (err) {
    console.warn('Oathbound: failed to load custom map; booting the default world.', err);
  }
}

void loadRequestedMap().then(runApp);

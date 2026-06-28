// Endgame guidance (0.6.0 CP4): the Lv-30 "what now?" data — the target-farming guide
// that turns the existing systems (world bosses, relics, loot identities, bad-luck
// protection, Reinforcement) into a directed chase. Pure data + helpers (no Three.js/
// DOM): the Goal Tracker and minimap read this; tests assert its integrity. See
// docs/design/ENDGAME_FOUNDATION.md (the level-30 loop + the Endgame Foundation Gate).

import { BOSSES, type BossId } from './bosses';
import { RELICS, RELIC_DROPS, type RelicId } from '../loot/relics';

export interface EndgameTarget {
  bossId: BossId;
  /** Boss display name. */
  name: string;
  /** Region id the boss sits in (regions.ts) — kept consistent with its world position. */
  zoneId: string;
  /** Human-readable location for the guidance line. */
  where: string;
  x: number;
  z: number;
  /** This source's loot identity (what you farm it for). */
  theme: string;
  /** Relics this boss can drop (the apex pulls). */
  relics: { id: RelicId; name: string; effect: string }[];
}

const GUIDE: Record<BossId, { zoneId: string; where: string; theme: string }> = {
  emberhorn: {
    zoneId: 'ember',
    where: 'the Emberreach · far west',
    theme: 'fire-themed Epics & Legendaries',
  },
  rimewyrm: {
    zoneId: 'riven',
    where: 'the Riven Peaks · far east',
    theme: 'frost-themed Epics & Legendaries',
  },
  maelgrith: {
    zoneId: 'gravereach',
    where: 'Gravereach, the Hollow Crown · far north',
    theme: 'the best beta loot — Legendaries & two Relics',
  },
};

/** The endgame target board, ordered by boss level (Emberhorn → Rimewyrm → Maelgrith). */
export const ENDGAME_TARGETS: EndgameTarget[] = (Object.keys(BOSSES) as BossId[]).map((id) => ({
  bossId: id,
  name: BOSSES[id].name,
  zoneId: GUIDE[id].zoneId,
  where: GUIDE[id].where,
  x: BOSSES[id].x,
  z: BOSSES[id].z,
  theme: GUIDE[id].theme,
  relics: RELIC_DROPS[id].map((rid) => ({
    id: rid,
    name: RELICS[rid].name,
    effect: RELICS[rid].effectDesc,
  })),
}));

/** Every relic in the game (the full collection set). */
export const ALL_RELIC_IDS = Object.keys(RELICS) as RelicId[];

/** Collection progress for the chase HUD: how many distinct relics obtained, of total. */
export function relicProgress(discovered: readonly string[]): { have: number; total: number } {
  const set = new Set(discovered);
  let have = 0;
  for (const id of ALL_RELIC_IDS) if (set.has(id)) have++;
  return { have, total: ALL_RELIC_IDS.length };
}

/** The first target still holding an uncollected relic (drives "hunt X next"), or null. */
export function nextRelicTarget(discovered: readonly string[]): EndgameTarget | null {
  const set = new Set(discovered);
  for (const t of ENDGAME_TARGETS) {
    if (t.relics.some((r) => !set.has(r.id))) return t;
  }
  return null;
}

/** The relics from a target the player hasn't collected yet. */
export function uncollectedRelics(
  target: EndgameTarget,
  discovered: readonly string[],
): EndgameTarget['relics'] {
  const set = new Set(discovered);
  return target.relics.filter((r) => !set.has(r.id));
}

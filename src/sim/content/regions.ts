// Region atlas (pure data + a point lookup) for the playable world. Drives the HUD zone
// label, the minimap tint, and zone-discovery prompts. Canonical level ranges per
// docs/design/WORLD_AND_ZONES.md (Oathhold hub · Greenmarch 1–5 · Thornwood 6–10 ·
// Sunken Fen 11–15 · Emberreach 16–20 · Riven Peaks 21–25 · Gravereach 26–30).
//
// 0.6.0 map expansion: the world is now large and open. Oathhold + the Greenmarch
// heartland surround the origin; the five higher regions are spread far out, beginning
// at ZONE_THRESHOLD in their cardinal/diagonal directions. The directional layout is
// unchanged from the original greybox — only the scale grew (layout.ts).

import { HUB_RADIUS, ZONE_THRESHOLD } from '../../world/layout';

export interface RegionInfo {
  id: string;
  name: string;
  /** Inclusive level band; the hub uses 0/0 (a safe haven, no band). */
  minLevel: number;
  maxLevel: number;
}

const OATHHOLD: RegionInfo = { id: 'oathhold', name: 'Oathhold', minLevel: 0, maxLevel: 0 };
const GREENMARCH: RegionInfo = { id: 'greenmarch', name: 'The Greenmarch', minLevel: 1, maxLevel: 5 };
const THORNWOOD: RegionInfo = { id: 'thornwood', name: 'Thornwood Vale', minLevel: 6, maxLevel: 10 };
const SUNKEN_FEN: RegionInfo = { id: 'fen', name: 'The Sunken Fen', minLevel: 11, maxLevel: 15 };
const EMBERREACH: RegionInfo = { id: 'ember', name: 'The Emberreach', minLevel: 16, maxLevel: 20 };
const RIVEN_PEAKS: RegionInfo = { id: 'riven', name: 'The Riven Peaks', minLevel: 21, maxLevel: 25 };
const GRAVEREACH: RegionInfo = { id: 'gravereach', name: 'Gravereach', minLevel: 26, maxLevel: 30 };

/**
 * Which region a world position falls in. Directional layout around the hub
 * (per docs/design/WORLD_AND_ZONES.md): NE woods, south bog, west scorch, east
 * frozen peaks, north corrupted ruins. The frontier zones begin at ZONE_THRESHOLD;
 * the Greenmarch heartland fills the area between the hub and the frontier.
 */
export function regionAt(x: number, z: number): RegionInfo {
  const T = ZONE_THRESHOLD;
  if (Math.hypot(x, z) < HUB_RADIUS) return OATHHOLD;
  if (x <= -T) return EMBERREACH; // west — scorched volcanic highlands
  if (z <= -T) return SUNKEN_FEN; // south — the waterlogged bog
  if (x >= T && z >= T) return THORNWOOD; // north-east — dim forest
  if (x >= T) return RIVEN_PEAKS; // east — frozen mountains (Lv 21–25)
  if (z >= T) return GRAVEREACH; // north — the Hollow Crown ruins (Lv 26–30)
  return GREENMARCH;
}

/** Display label: "Oathhold · Safe Haven" for the hub, else "Name · Lv a–b". */
export function regionLabel(r: RegionInfo): string {
  if (r.maxLevel === 0) return `${r.name} · Safe Haven`;
  return `${r.name} · Lv ${r.minLevel}–${r.maxLevel}`;
}

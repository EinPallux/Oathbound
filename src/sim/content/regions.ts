// Region atlas (pure data + a point lookup) for the slice's playable area. Drives the
// HUD zone label, the minimap tint, and zone-discovery prompts. Canonical level ranges
// per docs/design/WORLD_AND_ZONES.md (Oathhold hub · Greenmarch 1–5 · Thornwood 6–10).

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

/** Radius of the central safe hub around the world origin (m). */
const HUB_RADIUS = 6;

/**
 * Which region a world position falls in. Directional layout around the hub
 * (per docs/design/WORLD_AND_ZONES.md): NE woods, south bog, west scorch.
 */
export function regionAt(x: number, z: number): RegionInfo {
  if (Math.hypot(x, z) < HUB_RADIUS) return OATHHOLD;
  if (x <= -22) return EMBERREACH; // west — scorched volcanic highlands
  if (z <= -22) return SUNKEN_FEN; // south — the waterlogged bog
  if (x >= 22 && z >= 22) return THORNWOOD; // north-east — dim forest
  return GREENMARCH;
}

/** Display label: "Oathhold · Safe Haven" for the hub, else "Name · Lv a–b". */
export function regionLabel(r: RegionInfo): string {
  if (r.maxLevel === 0) return `${r.name} · Safe Haven`;
  return `${r.name} · Lv ${r.minLevel}–${r.maxLevel}`;
}

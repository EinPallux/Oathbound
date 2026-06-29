// Oathhold village — the starting town (pure data, no Three.js). Defines the building
// footprints, decorative props, and villager routes/posts for the renderer
// (src/render/village-view.ts), plus the solid colliders the simulation uses. Fresh
// characters spawn in the plaza (origin); a main street runs south, lined with two rows of
// buildings and closed by the Town Hall, leaving the north open for the starter camp.
//
// Everything is hand-authored + deterministic. The village sits on a flattened shelf
// (VILLAGE_FLAT, fed to generateHeightfield) so the streets are level.

import type { BoxCollider, CylinderCollider } from './heightfield';

export type BuildingType =
  | 'cottage'
  | 'house'
  | 'blacksmith'
  | 'tavern'
  | 'hall'
  | 'chapel'
  | 'tower'
  | 'shop'
  | 'barn';

export interface Building {
  type: BuildingType;
  x: number;
  z: number;
  rot: number;
  /** Footprint width (local x) and depth (local z), and wall height. */
  w: number;
  d: number;
  h: number;
}

export type PropType =
  | 'well'
  | 'stall'
  | 'cart'
  | 'lantern'
  | 'crate'
  | 'barrel'
  | 'hay'
  | 'board'
  | 'fence';

export interface VillageProp {
  type: PropType;
  x: number;
  z: number;
  rot: number;
}

export interface Walker {
  /** Closed loop of waypoints the villager strolls between. */
  route: { x: number; z: number }[];
  speed: number;
}

export type StanderKind = 'smith' | 'merchant' | 'elder' | 'idle';
export interface Stander {
  x: number;
  z: number;
  rot: number;
  kind: StanderKind;
}

/** Plaza centre (the player spawns at the origin, just north of here). */
export const VILLAGE_CENTER = { x: 0, z: -6 };
/** Flatten shelf for the heightfield (level ground under the town). */
export const VILLAGE_FLAT = { x: 0, z: -28, r: 42 };
/** Keep scenery (trees/rocks) from growing inside the town. */
export const VILLAGE_CLEARING = { x: 0, z: -28, r: 46 };

const W = Math.PI / 2; // west-row buildings face +x (the street)
const E = -Math.PI / 2; // east-row buildings face -x

export const BUILDINGS: Building[] = [
  // ── West side of the main street (front faces +x) ──
  { type: 'blacksmith', x: -11, z: -9, rot: W, w: 8, d: 7, h: 3.2 },
  { type: 'shop', x: -22, z: -10, rot: W - 0.04, w: 6.5, d: 6.5, h: 3.7 },
  { type: 'cottage', x: -10, z: -19, rot: W + 0.07, w: 5.5, d: 5, h: 2.6 },
  { type: 'house', x: -22, z: -21, rot: W - 0.06, w: 6.5, d: 6, h: 3 },
  { type: 'chapel', x: -11, z: -30, rot: W, w: 6, d: 9, h: 3.6 },
  { type: 'cottage', x: -22, z: -32, rot: W + 0.05, w: 5, d: 5, h: 2.6 },
  { type: 'house', x: -10, z: -40, rot: W - 0.05, w: 6, d: 5.5, h: 2.9 },
  { type: 'barn', x: -23, z: -43, rot: W, w: 8.5, d: 6, h: 3 },
  // ── East side of the main street (front faces -x) ──
  { type: 'tavern', x: 12, z: -9, rot: E, w: 9, d: 8, h: 3.7 },
  { type: 'shop', x: 22, z: -10, rot: E + 0.04, w: 6.5, d: 6.5, h: 3.7 },
  { type: 'house', x: 11, z: -19, rot: E - 0.06, w: 6.5, d: 6, h: 3 },
  { type: 'barn', x: 23, z: -21, rot: E, w: 8, d: 6, h: 3.2 },
  { type: 'cottage', x: 11, z: -30, rot: E + 0.06, w: 5, d: 5, h: 2.6 },
  { type: 'house', x: 22, z: -32, rot: E - 0.05, w: 6, d: 5.5, h: 2.9 },
  { type: 'cottage', x: 10, z: -41, rot: E, w: 5, d: 5, h: 2.6 },
  { type: 'cottage', x: 23, z: -43, rot: E, w: 5, d: 5, h: 2.6 },
  // ── South gate: a watchtower + the Town Hall closing the vista ──
  { type: 'tower', x: 8, z: -50, rot: 0, w: 3.4, d: 3.4, h: 7.0 },
  { type: 'hall', x: -8, z: -51, rot: 0.05, w: 13, d: 9, h: 4.6 },
];

export const PROPS: VillageProp[] = [
  { type: 'well', x: 5, z: -6, rot: 0 },
  { type: 'board', x: -3, z: -1, rot: 0.3 },
  // Market stalls in the plaza (one is the Quartermaster's vendor at (3,-3)).
  { type: 'stall', x: 3, z: -3, rot: -0.4 },
  { type: 'stall', x: -4, z: -5, rot: 0.5 },
  { type: 'stall', x: 4, z: -11, rot: -0.2 },
  { type: 'cart', x: -6, z: -25, rot: 0.9 },
  { type: 'cart', x: 6, z: -36, rot: -0.7 },
  // Lanterns lining the street.
  ...[-8, -16, -24, -32, -40, -47].flatMap((z): VillageProp[] => [
    { type: 'lantern', x: 5, z, rot: 0 },
    { type: 'lantern', x: -5, z, rot: 0 },
  ]),
  { type: 'lantern', x: 2, z: -2, rot: 0 },
  // Workshop / yard clutter.
  { type: 'crate', x: -12, z: -3, rot: 0.4 },
  { type: 'crate', x: -13, z: -6, rot: 1.1 },
  { type: 'crate', x: -19, z: -6, rot: 0.2 },
  { type: 'barrel', x: 13, z: -3, rot: 0 },
  { type: 'barrel', x: 15, z: -6, rot: 0 },
  { type: 'barrel', x: -10, z: -2, rot: 0 },
  { type: 'hay', x: -24, z: -39, rot: 0.6 },
  { type: 'hay', x: 24, z: -25, rot: 0.2 },
  // A few yard fences for structure.
  { type: 'fence', x: -15, z: -16, rot: 0 },
  { type: 'fence', x: 16, z: -15, rot: 0 },
  { type: 'fence', x: -16, z: -37, rot: 0 },
  { type: 'fence', x: 16, z: -38, rot: 0 },
];

export const WALKERS: Walker[] = [
  // Down the main street, both directions.
  { route: [{ x: 3, z: -7 }, { x: 4, z: -46 }, { x: 6, z: -46 }, { x: 5, z: -7 }], speed: 1.5 },
  { route: [{ x: -4, z: -44 }, { x: -3, z: -8 }, { x: -5, z: -8 }, { x: -6, z: -44 }], speed: 1.35 },
  // Around the plaza / well.
  { route: [{ x: 8, z: -8 }, { x: 8, z: -14 }, { x: -7, z: -14 }, { x: -7, z: -7 }], speed: 1.3 },
  // Between the blacksmith and the tavern.
  { route: [{ x: -7, z: -7 }, { x: 8, z: -8 }, { x: 8, z: -5 }, { x: -7, z: -4 }], speed: 1.2 },
  // Cross-lane by the chapel.
  { route: [{ x: -7, z: -29 }, { x: 7, z: -30 }, { x: 7, z: -27 }, { x: -7, z: -26 }], speed: 1.25 },
  // A wanderer among the southern houses.
  { route: [{ x: -7, z: -44 }, { x: 7, z: -45 }, { x: 6, z: -38 }, { x: -6, z: -37 }], speed: 1.15 },
  // Fetching water: a house ↔ the well.
  { route: [{ x: 12, z: -16 }, { x: 6, z: -9 }, { x: 9, z: -20 }], speed: 1.4 },
  // A slow patrol from the hall up the street.
  { route: [{ x: -3, z: -47 }, { x: 7, z: -33 }, { x: 6, z: -12 }, { x: -6, z: -18 }, { x: -7, z: -40 }], speed: 1.45 },
];

export const STANDERS: Stander[] = [
  { x: -7.5, z: -9, rot: -Math.PI / 2, kind: 'smith' }, // at the blacksmith's anvil
  { x: 3, z: -4.4, rot: 0, kind: 'merchant' }, // the Quartermaster at the stall
  { x: 5, z: -8.5, rot: 2.3, kind: 'elder' }, // by the well
  { x: -7.5, z: -26, rot: -0.5, kind: 'elder' }, // a priest by the chapel
  { x: 8.4, z: -6, rot: 1.5, kind: 'idle' }, // by the tavern door
  { x: -9, z: -13, rot: -0.6, kind: 'idle' }, // chatting pair
  { x: -7.4, z: -13.6, rot: Math.PI - 0.6, kind: 'idle' },
  { x: -3, z: -45, rot: 0.1, kind: 'idle' }, // a guard before the hall
];

/** Solid building footprints for the player's movement (oriented boxes). */
export function villageBoxes(): BoxCollider[] {
  return BUILDINGS.map((b) => ({ x: b.x, z: b.z, hw: b.w / 2, hd: b.d / 2, rot: b.rot }));
}

/** Round colliders for the bulky props (well, cart, stalls) — appended to world colliders. */
export function villageCylinders(): CylinderCollider[] {
  const out: CylinderCollider[] = [];
  for (const p of PROPS) {
    if (p.type === 'well') out.push({ x: p.x, z: p.z, radius: 1.5 });
    else if (p.type === 'cart') out.push({ x: p.x, z: p.z, radius: 1.6 });
    else if (p.type === 'stall') out.push({ x: p.x, z: p.z, radius: 1.3 });
  }
  return out;
}

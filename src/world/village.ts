// Oathhold village — the starting town (pure data, no Three.js). Defines the building
// footprints, decorative props, and villager routes/posts for the renderer
// (src/render/village-view.ts), plus the solid colliders the simulation uses. Fresh
// characters spawn in the plaza here; the buildings fan out to the south and sides,
// leaving the north open for the starter camp (the first mob stays within melee of spawn).
//
// Everything is hand-authored + deterministic. The village sits on a flattened shelf
// (VILLAGE_FLAT, fed to generateHeightfield) so houses stand on level ground.

import type { BoxCollider, CylinderCollider } from './heightfield';

export type BuildingType = 'cottage' | 'house' | 'blacksmith' | 'tavern';

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

/** Plaza centre (the player spawns near the origin, just north of here). */
export const VILLAGE_CENTER = { x: 0, z: -4 };
/** Flatten shelf for the heightfield (level ground under the town). */
export const VILLAGE_FLAT = { x: 0, z: -10, r: 30 };
/** Keep scenery (trees/rocks) from growing inside the town. */
export const VILLAGE_CLEARING = { x: 0, z: -10, r: 32 };

export const BUILDINGS: Building[] = [
  // Feature buildings flanking the plaza.
  { type: 'blacksmith', x: -15, z: -3, rot: Math.PI / 2, w: 8, d: 7, h: 3.2 },
  { type: 'tavern', x: 15, z: -4, rot: -Math.PI / 2, w: 8.5, d: 7, h: 3.5 },
  // Inner cottages.
  { type: 'cottage', x: -11, z: -13, rot: 0.88, w: 5.5, d: 5, h: 2.6 },
  { type: 'cottage', x: 11, z: -13, rot: -0.88, w: 5.5, d: 5, h: 2.6 },
  // Mid houses.
  { type: 'house', x: -19, z: -15, rot: 1.05, w: 6.5, d: 6, h: 3 },
  { type: 'house', x: 19, z: -14, rot: -1.08, w: 6.5, d: 6, h: 3 },
  // Southern cottages flanking the road out of town.
  { type: 'cottage', x: -8, z: -23, rot: 0.4, w: 5, d: 5, h: 2.6 },
  { type: 'cottage', x: 8, z: -23, rot: -0.4, w: 5, d: 5, h: 2.6 },
  // Southern houses.
  { type: 'house', x: -16, z: -25, rot: 0.65, w: 6, d: 5.5, h: 2.8 },
  { type: 'house', x: 15, z: -26, rot: -0.6, w: 6, d: 5.5, h: 2.8 },
];

export const PROPS: VillageProp[] = [
  { type: 'well', x: 6, z: -9, rot: 0 },
  { type: 'board', x: -3, z: -1, rot: 0.3 }, // notice board by the spawn
  // Market stalls (one is the Quartermaster's, who stands at the vendor at (3,-3)).
  { type: 'stall', x: 3, z: -3, rot: -0.4 },
  { type: 'stall', x: -4, z: -7, rot: 0.5 },
  { type: 'cart', x: -7, z: -17, rot: 0.9 },
  // Lantern posts lining the street.
  { type: 'lantern', x: 5, z: -13, rot: 0 },
  { type: 'lantern', x: -5, z: -13, rot: 0 },
  { type: 'lantern', x: 6, z: -22, rot: 0 },
  { type: 'lantern', x: -6, z: -22, rot: 0 },
  { type: 'lantern', x: 0, z: -31, rot: 0 },
  { type: 'lantern', x: 2, z: -2, rot: 0 },
  // Clutter around the workplaces.
  { type: 'crate', x: -11, z: -1, rot: 0.4 },
  { type: 'crate', x: -12, z: -6, rot: 1.1 },
  { type: 'barrel', x: 12, z: -2, rot: 0 },
  { type: 'barrel', x: 13, z: -7, rot: 0 },
  { type: 'barrel', x: -10, z: -2, rot: 0 },
  { type: 'hay', x: 10, z: -19, rot: 0.6 },
  { type: 'hay', x: -13, z: -20, rot: 0.2 },
];

export const WALKERS: Walker[] = [
  // Stroll around the plaza / well.
  { route: [{ x: 8, z: -10 }, { x: 8, z: -18 }, { x: -7, z: -18 }, { x: -7, z: -9 }], speed: 1.3 },
  // Up and down the main street (kept off the very centre so it doesn't sit on the road).
  { route: [{ x: 3, z: -7 }, { x: 4, z: -27 }, { x: 6, z: -27 }, { x: 5, z: -7 }], speed: 1.5 },
  // Between the blacksmith and the tavern.
  { route: [{ x: -10, z: -7 }, { x: 11, z: -8 }, { x: 11, z: -5 }, { x: -10, z: -4 }], speed: 1.2 },
  // A wanderer among the southern cottages.
  { route: [{ x: -6, z: -21 }, { x: -14, z: -23 }, { x: -10, z: -28 }, { x: -3, z: -25 }], speed: 1.1 },
  // Someone fetching water: cottage ↔ well.
  { route: [{ x: 12, z: -16 }, { x: 7, z: -11 }, { x: 8, z: -20 }], speed: 1.35 },
  // A slow perimeter patrol.
  { route: [{ x: 13, z: -11 }, { x: 6, z: -29 }, { x: -12, z: -27 }, { x: -18, z: -10 }, { x: -9, z: -3 } ], speed: 1.45 },
];

export const STANDERS: Stander[] = [
  { x: -11.5, z: -3, rot: -Math.PI / 2, kind: 'smith' }, // at the blacksmith's anvil
  { x: 3, z: -4.4, rot: 0, kind: 'merchant' }, // the Quartermaster at the stall
  { x: 6, z: -11, rot: 2.3, kind: 'elder' }, // by the well
  { x: -9, z: -10, rot: -0.6, kind: 'idle' }, // chatting pair
  { x: -7.4, z: -10.6, rot: Math.PI - 0.6, kind: 'idle' },
  { x: 13, z: -9, rot: 1.4, kind: 'idle' }, // by the tavern door
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

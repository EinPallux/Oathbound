// Scenery (pure, no Three.js): deterministic, biome-aware placement of the world's
// decorative dressing — trees, boulders, pebbles, bushes, grass, flowers, ferns,
// mushrooms, fallen logs, lily pads — plus river and road paths. The renderer
// (src/render/scenery-view.ts) builds instanced meshes/ribbons from this data; the
// simulation ignores it entirely.
//
// Design note: scenery is purely visual (it adds NO colliders). Physical obstacles stay
// exactly as before — the rock cylinders from generateColliders — so collision, line of
// sight, aggro and projectiles are unchanged. Keeping the data pure + seeded means the
// world dresses identically every run and stays testable.

import { Rng } from '../core/rng';
import { dominantBiome, type BiomeId } from './biomes';
import { WORLD_LAKES, inLakeWater, lakeZone } from './lakes';

export interface SceneryInstance {
  x: number;
  z: number;
  scale: number;
  rot: number;
  /** Variant index — meaning is per-layer (see the Scenery field docs). */
  variant: number;
}

export interface SceneryPath {
  points: { x: number; z: number }[];
  width: number;
}

export interface Scenery {
  /** variant: 0 broadleaf · 1 pine · 2 dead/charred · 3 birch · 4 great oak · 5 willow. */
  trees: SceneryInstance[];
  /** variant: 0 grey · 1 ember-red · 2 snow/ice · 3 mossy. */
  boulders: SceneryInstance[];
  pebbles: SceneryInstance[];
  /** variant: 0 leafy · 1 dry/bramble · 2 fungal · 3 flowering. */
  bushes: SceneryInstance[];
  /** variant: 0 grass tuft · 1 fen reed. */
  grass: SceneryInstance[];
  /** variant: 0 red · 1 yellow · 2 purple · 3 white. */
  flowers: SceneryInstance[];
  /** Forest/fen ferns (fanned fronds). */
  ferns: SceneryInstance[];
  /** variant: 0 red toadstool · 1 brown cap · 2 pale glowcap. */
  mushrooms: SceneryInstance[];
  /** Fallen mossy logs (forest floor). */
  logs: SceneryInstance[];
  /** Lily pads floating on lake water. */
  lilies: SceneryInstance[];
  rivers: SceneryPath[];
  roads: SceneryPath[];
}

export interface Clearing {
  x: number;
  z: number;
  r: number;
}

export interface SceneryOptions {
  /** Areas to keep clear of large props (camps, the hub) — trees/boulders avoid these. */
  clearings?: Clearing[];
  /** Road destinations (e.g. frontier Oathstones); a road runs from the hub to each. */
  roadTargets?: { x: number; z: number }[];
  seed?: number;
}

const HUB_CLEAR = 16; // no scenery inside the town plaza

function inClearing(x: number, z: number, clearings: Clearing[] | undefined): boolean {
  if (Math.hypot(x, z) < HUB_CLEAR) return true;
  if (!clearings) return false;
  for (const c of clearings) {
    if (Math.hypot(x - c.x, z - c.z) < c.r) return true;
  }
  return false;
}

/** Scatter `count` candidate points across the world, keeping accepted instances. */
function scatter(
  rng: Rng,
  count: number,
  half: number,
  accept: (x: number, z: number, biome: BiomeId, rng: Rng) => SceneryInstance | null,
): SceneryInstance[] {
  const out: SceneryInstance[] = [];
  for (let i = 0; i < count; i++) {
    const x = rng.range(-half, half);
    const z = rng.range(-half, half);
    const inst = accept(x, z, dominantBiome(x, z), rng);
    if (inst) out.push(inst);
  }
  return out;
}

/** Weighted pick from [value, weight] pairs. */
function pick<T>(rng: Rng, choices: [T, number][]): T {
  let total = 0;
  for (const [, w] of choices) total += w;
  let r = rng.next() * total;
  for (const [v, w] of choices) {
    r -= w;
    if (r <= 0) return v;
  }
  return choices[0][0];
}

/**
 * Generate the world's scenery. Deterministic for a given seed + options. Densities are
 * tuned per biome so each region reads distinctly: Thornwood is thick mixed forest with a
 * mushroomy floor, the Riven Peaks are pine + boulders + snow, Emberreach is charred and
 * rocky, the Fen is reeds, willows and dead trees around its meres, the Greenmarch is
 * open fields with copses, wildflowers and ponds.
 */
export function generateScenery(size: number, opts: SceneryOptions = {}): Scenery {
  const seed = opts.seed ?? 4242;
  const half = size / 2 - 4;
  const clearings = opts.clearings;
  const blocked = (x: number, z: number): boolean =>
    inClearing(x, z, clearings) || inLakeWater(x, z, 1);

  // ── Trees (one instanced mesh per variant; baked trunk/canopy colours) ───────
  const trees = scatter(new Rng(seed + 1), 9000, half, (x, z, biome, rng) => {
    if (blocked(x, z)) return null;
    let chance = 0;
    let variant = 0;
    let scale = 1;
    switch (biome) {
      case 'greenmarch':
        chance = 0.13;
        variant = pick(rng, [[0, 6], [4, 3], [3, 2]]); // broadleaf, oak, birch
        scale = variant === 4 ? rng.range(2.2, 3.4) : rng.range(1.4, 2.5);
        break;
      case 'thornwood':
        chance = 0.62; // dense mixed forest
        variant = pick(rng, [[0, 6], [4, 3], [1, 2], [2, 1]]);
        scale = variant === 4 ? rng.range(2.4, 3.6) : rng.range(1.8, 3.2);
        break;
      case 'riven':
        chance = 0.32;
        variant = pick(rng, [[1, 8], [2, 2]]); // pines + a few snags
        scale = rng.range(1.6, 3.0);
        break;
      case 'fen': {
        const z2 = lakeZone(x, z);
        chance = z2 === 'shore' ? 0.5 : 0.17;
        variant = pick(rng, [[2, 5], [5, 4], [0, 2]]); // dead, willow, broadleaf
        scale = variant === 5 ? rng.range(1.8, 2.8) : rng.range(1.3, 2.4);
        break;
      }
      case 'ember':
        chance = 0.07;
        variant = 2; // charred snags
        scale = rng.range(1.2, 2.3);
        break;
      case 'gravereach':
        chance = 0.13;
        variant = pick(rng, [[2, 7], [1, 3]]); // dead + windbent pines
        scale = rng.range(1.4, 2.6);
        break;
      default:
        return null; // hub
    }
    if (rng.next() > chance) return null;
    return { x, z, scale, rot: rng.range(0, Math.PI * 2), variant };
  });

  // ── Boulders (visual; the collidable rocks are generateColliders) ────────────
  const boulders = scatter(new Rng(seed + 2), 3200, half, (x, z, biome, rng) => {
    if (blocked(x, z)) return null;
    let chance = 0.05;
    let variant = 0;
    if (biome === 'riven') {
      chance = 0.42;
      variant = rng.next() < 0.5 ? 2 : 0;
    } else if (biome === 'ember') {
      chance = 0.34;
      variant = 1;
    } else if (biome === 'gravereach') {
      chance = 0.2;
      variant = 0;
    } else if (biome === 'thornwood' || biome === 'greenmarch') {
      chance = 0.09;
      variant = 3;
    } else if (biome === 'hub') {
      return null;
    }
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.7, 2.6), rot: rng.range(0, Math.PI * 2), variant };
  });

  // ── Pebbles (small ground stones, everywhere; denser in rocky biomes) ────────
  const pebbles = scatter(new Rng(seed + 3), 4600, half, (x, z, biome, rng) => {
    if (Math.hypot(x, z) < HUB_CLEAR || inLakeWater(x, z, 0)) return null;
    let chance = 0.25;
    if (biome === 'riven' || biome === 'ember') chance = 0.6;
    else if (biome === 'fen') chance = 0.15;
    else if (biome === 'hub') return null;
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.18, 0.5), rot: rng.range(0, Math.PI * 2), variant: 0 };
  });

  // ── Bushes / shrubs (incl. flowering) ────────────────────────────────────────
  const bushes = scatter(new Rng(seed + 4), 4400, half, (x, z, biome, rng) => {
    if (blocked(x, z)) return null;
    let chance = 0;
    let variant = 0;
    if (biome === 'greenmarch') {
      chance = 0.2;
      variant = pick(rng, [[0, 5], [3, 3]]); // leafy + flowering
    } else if (biome === 'thornwood') {
      chance = 0.34;
      variant = pick(rng, [[0, 7], [3, 2]]);
    } else if (biome === 'fen') {
      chance = 0.24;
      variant = 2; // fungal
    } else if (biome === 'gravereach') {
      chance = 0.13;
      variant = 1; // dry bramble
    } else if (biome === 'ember') {
      chance = 0.07;
      variant = 1;
    } else {
      return null;
    }
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.6, 1.4), rot: rng.range(0, Math.PI * 2), variant };
  });

  // ── Grass tufts + Fen reeds ──────────────────────────────────────────────────
  const grass = scatter(new Rng(seed + 5), 7500, half, (x, z, biome, rng) => {
    if (Math.hypot(x, z) < HUB_CLEAR || inLakeWater(x, z, 0)) return null;
    let chance = 0;
    let variant = 0;
    const z2 = lakeZone(x, z);
    if (z2 === 'shore') {
      chance = 0.7;
      variant = 1; // reeds crowd every shoreline
    } else if (biome === 'greenmarch') chance = 0.52;
    else if (biome === 'thornwood') chance = 0.4;
    else if (biome === 'fen') {
      chance = 0.5;
      variant = 1; // reeds
    } else if (biome === 'gravereach') chance = 0.12;
    else return null;
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.5, 1.15), rot: rng.range(0, Math.PI * 2), variant };
  });

  // ── Wildflowers (Greenmarch fields, Thornwood glades, lake shores) ───────────
  const flowers = scatter(new Rng(seed + 6), 4000, half, (x, z, biome, rng) => {
    if (Math.hypot(x, z) < HUB_CLEAR || inLakeWater(x, z, 0)) return null;
    let chance = 0;
    if (biome === 'greenmarch') chance = 0.32;
    else if (biome === 'thornwood') chance = 0.12;
    else if (lakeZone(x, z) === 'shore') chance = 0.25;
    else return null;
    if (rng.next() > chance) return null;
    return {
      x,
      z,
      scale: rng.range(0.32, 0.62),
      rot: rng.range(0, Math.PI * 2),
      variant: Math.floor(rng.range(0, 4)),
    };
  });

  // ── Ferns (shaded forest + fen floor) ────────────────────────────────────────
  const ferns = scatter(new Rng(seed + 7), 2800, half, (x, z, biome, rng) => {
    if (blocked(x, z)) return null;
    let chance = 0;
    if (biome === 'thornwood') chance = 0.34;
    else if (biome === 'fen') chance = 0.26;
    else if (biome === 'greenmarch') chance = 0.08;
    else return null;
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.6, 1.2), rot: rng.range(0, Math.PI * 2), variant: 0 };
  });

  // ── Mushrooms (damp Thornwood + Fen floor) ───────────────────────────────────
  const mushrooms = scatter(new Rng(seed + 8), 1800, half, (x, z, biome, rng) => {
    if (blocked(x, z)) return null;
    let chance = 0;
    let variant = 0;
    if (biome === 'thornwood') {
      chance = 0.16;
      variant = pick(rng, [[0, 5], [1, 4]]);
    } else if (biome === 'fen') {
      chance = 0.2;
      variant = pick(rng, [[2, 5], [1, 3]]); // pale glowcaps
    } else if (biome === 'gravereach') {
      chance = 0.06;
      variant = 2;
    } else return null;
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.5, 1.2), rot: rng.range(0, Math.PI * 2), variant };
  });

  // ── Fallen logs (forest floor) ───────────────────────────────────────────────
  const logs = scatter(new Rng(seed + 9), 700, half, (x, z, biome, rng) => {
    if (blocked(x, z)) return null;
    let chance = 0;
    if (biome === 'thornwood') chance = 0.18;
    else if (biome === 'greenmarch' || biome === 'fen') chance = 0.06;
    else if (biome === 'riven') chance = 0.05;
    else return null;
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.85, 1.7), rot: rng.range(0, Math.PI * 2), variant: 0 };
  });

  // ── Lily pads (floating on the open water of each lake) ───────────────────────
  const lilies: SceneryInstance[] = [];
  const lilyRng = new Rng(seed + 10);
  for (const lk of WORLD_LAKES) {
    const n = Math.round(lk.r * lk.r * 0.07);
    for (let i = 0; i < n; i++) {
      const a = lilyRng.next() * Math.PI * 2;
      const rad = Math.sqrt(lilyRng.next()) * lk.r * 0.7;
      const x = lk.x + Math.cos(a) * rad;
      const z = lk.z + Math.sin(a) * rad;
      if (lilyRng.next() > 0.5) continue; // thin them out so the water still reads
      lilies.push({ x, z, scale: lilyRng.range(0.5, 1.1), rot: lilyRng.range(0, Math.PI * 2), variant: 0 });
    }
  }

  return {
    trees,
    boulders,
    pebbles,
    bushes,
    grass,
    flowers,
    ferns,
    mushrooms,
    logs,
    lilies,
    rivers: buildRivers(half),
    roads: buildRoads(opts.roadTargets ?? []),
  };
}

/**
 * Rivers winding through the lowlands. The main river meanders down the heartland and
 * empties into the Fen Mere (south lake); a tributary joins it from the west, and a
 * northern brook drains off the Gravereach plateau. None reach the eastern peaks.
 */
function buildRivers(half: number): SceneryPath[] {
  const main: { x: number; z: number }[] = [];
  const zStart = Math.min(half - 10, 150);
  const zEnd = -150; // flows south toward the Fen Mere
  for (let z = zStart; z >= zEnd; z -= 6) {
    const x = -22 + Math.sin(z * 0.018) * 40 + Math.sin(z * 0.05) * 8;
    main.push({ x, z });
  }
  main.push({ x: 46, z: -170 }); // empties into the Fen Mere

  // Western tributary, joining the main river around z≈30.
  const trib: { x: number; z: number }[] = [];
  for (let z = 96; z >= 30; z -= 6) {
    const x = -86 + (z - 30) * 0.0 + Math.sin(z * 0.04) * 10 + (96 - z) * 0.55;
    trib.push({ x, z });
  }

  // Northern brook off the plateau, draining toward the heartland.
  const brook: { x: number; z: number }[] = [];
  for (let z = 150; z >= 70; z -= 6) {
    const x = 60 + Math.sin(z * 0.05) * 12 - (150 - z) * 0.18;
    brook.push({ x, z });
  }

  return [
    { points: main, width: 7.5 },
    { points: trib, width: 4.5 },
    { points: brook, width: 4 },
  ];
}

/** Straight-ish roads from the hub out to each frontier destination (gentle curve). */
function buildRoads(targets: { x: number; z: number }[]): SceneryPath[] {
  const roads: SceneryPath[] = [];
  for (const t of targets) {
    const dist = Math.hypot(t.x, t.z);
    if (dist < 1) continue;
    const steps = Math.max(2, Math.round(dist / 10));
    // Perpendicular unit vector for a slight sinusoidal bend.
    const px = -t.z / dist;
    const pz = t.x / dist;
    const bend = Math.min(18, dist * 0.12);
    const points: { x: number; z: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const curve = Math.sin(s * Math.PI) * bend;
      points.push({ x: t.x * s + px * curve, z: t.z * s + pz * curve });
    }
    roads.push({ points, width: 4.5 });
  }
  return roads;
}

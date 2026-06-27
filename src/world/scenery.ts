// Scenery (pure, no Three.js): deterministic, biome-aware placement of the world's
// decorative dressing — trees, boulders, pebbles, bushes, grass tufts, flowers — plus
// river and road paths. The renderer (src/render/scenery-view.ts) builds instanced
// meshes/ribbons from this data; the simulation ignores it entirely.
//
// Design note: scenery is purely visual (it adds NO colliders). Physical obstacles stay
// exactly as before — the rock cylinders from generateColliders — so collision, line of
// sight, aggro and projectiles are unchanged by the 0.6.0 map expansion. Keeping the
// data pure + seeded means the world dresses identically every run and stays testable.

import { Rng } from '../core/rng';
import { dominantBiome, type BiomeId } from './biomes';

export interface SceneryInstance {
  x: number;
  z: number;
  scale: number;
  rot: number;
  /** Variant index — meaning is per-layer (e.g. tree: 0 broadleaf, 1 pine, 2 dead). */
  variant: number;
}

export interface SceneryPath {
  points: { x: number; z: number }[];
  width: number;
}

export interface Scenery {
  /** variant: 0 broadleaf · 1 pine · 2 dead/charred (no canopy). */
  trees: SceneryInstance[];
  /** variant: 0 grey · 1 ember-red · 2 snow/ice · 3 mossy. */
  boulders: SceneryInstance[];
  pebbles: SceneryInstance[];
  /** variant: 0 leafy · 1 dry/bramble · 2 fungal. */
  bushes: SceneryInstance[];
  /** variant: 0 grass tuft · 1 fen reed. */
  grass: SceneryInstance[];
  flowers: SceneryInstance[];
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

/**
 * Generate the world's scenery. Deterministic for a given seed + options. Densities are
 * tuned per biome so each region reads distinctly: Thornwood is thick forest, the Riven
 * Peaks are pine + boulders + snow, Emberreach is charred and rocky, the Fen is reeds
 * and dead trees, the Greenmarch is open fields with copses and wildflowers.
 */
export function generateScenery(size: number, opts: SceneryOptions = {}): Scenery {
  const seed = opts.seed ?? 4242;
  const half = size / 2 - 4;
  const clearings = opts.clearings;

  // ── Trees ──────────────────────────────────────────────────────────────────
  const trees = scatter(new Rng(seed + 1), 9000, half, (x, z, biome, rng) => {
    if (inClearing(x, z, clearings)) return null;
    let chance = 0;
    let variant = 0;
    let scale = 1;
    switch (biome) {
      case 'greenmarch':
        chance = 0.12;
        variant = 0;
        scale = rng.range(1.4, 2.4);
        break;
      case 'thornwood':
        chance = 0.62; // dense forest
        variant = rng.next() < 0.85 ? 0 : 2;
        scale = rng.range(1.8, 3.2);
        break;
      case 'riven':
        chance = 0.3;
        variant = 1; // pines
        scale = rng.range(1.6, 3.0);
        break;
      case 'fen':
        chance = 0.16;
        variant = rng.next() < 0.6 ? 2 : 0; // dead + a few stubborn broadleaf
        scale = rng.range(1.3, 2.4);
        break;
      case 'ember':
        chance = 0.06;
        variant = 2; // charred snags
        scale = rng.range(1.2, 2.2);
        break;
      case 'gravereach':
        chance = 0.14;
        variant = 2; // dead
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
    if (inClearing(x, z, clearings)) return null;
    let chance = 0.05;
    let variant = 0;
    if (biome === 'riven') {
      chance = 0.4;
      variant = rng.next() < 0.5 ? 2 : 0;
    } else if (biome === 'ember') {
      chance = 0.32;
      variant = 1;
    } else if (biome === 'gravereach') {
      chance = 0.16;
      variant = 0;
    } else if (biome === 'thornwood' || biome === 'greenmarch') {
      chance = 0.08;
      variant = 3;
    } else if (biome === 'hub') {
      return null;
    }
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.7, 2.4), rot: rng.range(0, Math.PI * 2), variant };
  });

  // ── Pebbles (small ground stones, everywhere; denser in rocky biomes) ────────
  const pebbles = scatter(new Rng(seed + 3), 5200, half, (x, z, biome, rng) => {
    if (Math.hypot(x, z) < HUB_CLEAR) return null;
    let chance = 0.25;
    if (biome === 'riven' || biome === 'ember') chance = 0.6;
    else if (biome === 'fen') chance = 0.15;
    else if (biome === 'hub') return null;
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.18, 0.5), rot: rng.range(0, Math.PI * 2), variant: 0 };
  });

  // ── Bushes / shrubs ──────────────────────────────────────────────────────────
  const bushes = scatter(new Rng(seed + 4), 4200, half, (x, z, biome, rng) => {
    if (inClearing(x, z, clearings)) return null;
    let chance = 0;
    let variant = 0;
    if (biome === 'greenmarch') {
      chance = 0.18;
      variant = 0;
    } else if (biome === 'thornwood') {
      chance = 0.32;
      variant = 0;
    } else if (biome === 'fen') {
      chance = 0.22;
      variant = 2; // fungal
    } else if (biome === 'gravereach') {
      chance = 0.12;
      variant = 1; // dry bramble
    } else if (biome === 'ember') {
      chance = 0.06;
      variant = 1;
    } else {
      return null;
    }
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.6, 1.3), rot: rng.range(0, Math.PI * 2), variant };
  });

  // ── Grass tufts + Fen reeds ──────────────────────────────────────────────────
  const grass = scatter(new Rng(seed + 5), 8000, half, (x, z, biome, rng) => {
    if (Math.hypot(x, z) < HUB_CLEAR) return null;
    let chance = 0;
    let variant = 0;
    if (biome === 'greenmarch') chance = 0.5;
    else if (biome === 'thornwood') chance = 0.4;
    else if (biome === 'fen') {
      chance = 0.5;
      variant = 1; // reeds
    } else if (biome === 'gravereach') chance = 0.12;
    else return null;
    if (rng.next() > chance) return null;
    return { x, z, scale: rng.range(0.5, 1.1), rot: rng.range(0, Math.PI * 2), variant };
  });

  // ── Wildflowers (Greenmarch heartland, a few in Thornwood glades) ────────────
  const flowers = scatter(new Rng(seed + 6), 3600, half, (x, z, biome, rng) => {
    if (Math.hypot(x, z) < HUB_CLEAR) return null;
    let chance = 0;
    if (biome === 'greenmarch') chance = 0.28;
    else if (biome === 'thornwood') chance = 0.1;
    else return null;
    if (rng.next() > chance) return null;
    return {
      x,
      z,
      scale: rng.range(0.3, 0.6),
      rot: rng.range(0, Math.PI * 2),
      variant: Math.floor(rng.range(0, 3)),
    };
  });

  return {
    trees,
    boulders,
    pebbles,
    bushes,
    grass,
    flowers,
    rivers: buildRivers(half),
    roads: buildRoads(opts.roadTargets ?? []),
  };
}

/** A meandering river through the lowland heartland (kept off the eastern peaks). */
function buildRivers(half: number): SceneryPath[] {
  const main: { x: number; z: number }[] = [];
  const zStart = Math.min(half - 10, 210);
  const zEnd = Math.max(-half + 10, -210);
  for (let z = zStart; z >= zEnd; z -= 8) {
    // West of town; gently winding so it never climbs the Riven mountains (east).
    const x = -34 + Math.sin(z * 0.018) * 26 + Math.sin(z * 0.05) * 6;
    main.push({ x, z });
  }
  return [{ points: main, width: 6 }];
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
    roads.push({ points, width: 3.4 });
  }
  return roads;
}

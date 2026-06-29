// Biome field (pure, no Three.js): a smooth, deterministic description of which biome
// a world position belongs to, plus the biome-shaped elevation offset added on top of
// the base rolling hills. Shared by:
//   - src/world/heightfield.ts (gameplay terrain height — mountains, bog, plateau),
//   - src/render/terrain-mesh.ts (vertex tint per biome),
//   - src/world/scenery.ts (what vegetation/props to scatter where).
//
// The crisp gameplay region lookup (level bands, HUD labels) lives in
// src/sim/content/regions.ts; this module is the *smooth* visual/elevation layer.
// Both use the same directional layout and the ZONE_THRESHOLD knob from layout.ts.

import { ZONE_THRESHOLD } from './layout';

export type BiomeId =
  | 'hub'
  | 'greenmarch'
  | 'thornwood'
  | 'fen'
  | 'ember'
  | 'riven'
  | 'gravereach';

/** Smooth Hermite ramp: 0 below `a`, 1 above `b`, eased in between. */
export function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Cheap deterministic value-noise in [-1, 1] from sine hashing (pure, seed-free). */
function noise(x: number, z: number): number {
  return (
    Math.sin(x * 0.045 + z * 0.021) * 0.6 +
    Math.sin(x * 0.017 - z * 0.039) * 0.3 +
    Math.sin((x + z) * 0.013) * 0.1
  );
}

/** Sharp ridge noise in [0, 1] for mountain spines. */
function ridge(x: number, z: number): number {
  const n = Math.sin(x * 0.03) * Math.cos(z * 0.028) + Math.sin((x - z) * 0.02) * 0.5;
  return 1 - Math.abs(n) / 1.5;
}

/** A second, finer ridge octave (higher frequency) for jagged peak detail. */
function ridge2(x: number, z: number): number {
  const n = Math.sin(x * 0.075 + 11) * Math.cos(z * 0.07 - 7) + Math.sin((x + z) * 0.05) * 0.5;
  return 1 - Math.abs(n) / 1.5;
}

export interface BiomeFactors {
  /** Direction memberships in [0, 1] — how strongly a point belongs to each frontier. */
  west: number; // Emberreach (scorched highlands)
  east: number; // Riven Peaks (frozen mountains)
  south: number; // Sunken Fen (bog depression)
  north: number; // Gravereach (broken plateau)
  ne: number; // Thornwood Vale (forested hills) — the +x/+z corner
  /** Greenmarch heartland weight (1 near the hub, fading as a frontier takes over). */
  greenmarch: number;
}

const T = ZONE_THRESHOLD; // 120

/**
 * Domain warp: nudge the lookup position by low-frequency noise so biome borders are
 * organic and wiggly instead of straight axis-aligned lines. The warp amplitude grows
 * with distance from the hub (≈0 within the heartland), so the spawn stays flat and a
 * small field (the unit-test 100 m world) is unwarped. Pure → deterministic.
 */
function warped(x: number, z: number): [number, number] {
  const amt = smoothstep(40, 180, Math.hypot(x, z)) * 42;
  if (amt < 0.001) return [x, z];
  const nx = (Math.sin(z * 0.012 + 1.7) + 0.5 * Math.sin(z * 0.031 - 0.6)) / 1.5;
  const nz = (Math.sin(x * 0.012 + 4.2) + 0.5 * Math.sin(x * 0.028 + 1.1)) / 1.5;
  return [x + nx * amt, z + nz * amt];
}

/**
 * Smooth directional biome membership at a world position. Ramps start a little inside
 * ZONE_THRESHOLD so terrain/colour transition naturally rather than snapping at the
 * crisp region border, and the lookup is domain-warped so the borders are organic. The
 * NE (Thornwood) corner suppresses the pure east/north mountains/plateau so it reads as
 * forest hills, not peaks.
 */
export function biomeFactors(x: number, z: number): BiomeFactors {
  const [wx, wz] = warped(x, z);
  const west = smoothstep(T * 0.55, T * 1.5, -wx);
  const east = smoothstep(T * 0.55, T * 1.5, wx);
  const south = smoothstep(T * 0.55, T * 1.4, -wz);
  const north = smoothstep(T * 0.6, T * 1.5, wz);
  const ne = smoothstep(T * 0.55, T * 1.35, Math.min(wx, wz));
  const frontier = Math.min(1, Math.max(west, east, south, north, ne));
  return { west, east, south, north, ne, greenmarch: 1 - frontier };
}

/** The single strongest biome at a position (for scenery placement / discrete checks). */
export function dominantBiome(x: number, z: number): BiomeId {
  if (Math.hypot(x, z) < 8) return 'hub';
  const f = biomeFactors(x, z);
  const entries: [BiomeId, number][] = [
    ['greenmarch', f.greenmarch],
    ['thornwood', f.ne],
    ['fen', f.south],
    ['ember', f.west],
    ['riven', f.east * (1 - f.ne)],
    ['gravereach', f.north * (1 - f.ne)],
  ];
  let best: BiomeId = 'greenmarch';
  let bestW = -1;
  for (const [id, w] of entries) {
    if (w > bestW) {
      bestW = w;
      best = id;
    }
  }
  return best;
}

// Elevation magnitudes (m). The frontiers are now far more dramatic — giant Riven Peaks,
// raised Emberreach highlands, a cliff-edged Gravereach plateau — while the heartland and
// any small field (the 100 m unit-test world) stay flat because every ramp is ~0 there.
const MOUNTAIN = 56; // Riven Peaks — the world's giant skyline
const HIGHLAND = 15; // Emberreach scorched highlands (rough mesas)
const PLATEAU = 17; // Gravereach broken plateau (steep escarpment edge)
const BOG = 5; // Sunken Fen depression (deeper — feeds the meres/lakes)
const FOREST = 6; // Thornwood rolling forested hills

/**
 * Biome-shaped elevation offset (m) added on top of the base hills. ~0 near the hub
 * (keeps the spawn flat) and within a small world (the heightfield unit tests sample a
 * 100 m field, where all ramps are still 0). Pure function of position → deterministic.
 */
export function biomeElevation(x: number, z: number): number {
  const f = biomeFactors(x, z);
  const eastM = f.east * (1 - f.ne);
  const northM = f.north * (1 - f.ne);

  let h = 0;
  // East: the Riven Peaks — giant jagged skyline. Two ridge octaves stack into sharp
  // spines, and a foothill term ramps the rise so the climb from the heartland reads.
  const r1 = ridge(x, z);
  const peak = 0.28 + 0.52 * r1 + 0.3 * r1 * ridge2(x, z);
  h += eastM * MOUNTAIN * peak;
  // West: Emberreach highlands — rough raised mesas with broken steps.
  h += f.west * HIGHLAND * (0.6 + 0.4 * Math.abs(noise(x * 1.3, z))) + f.west * 4 * ridge(x * 1.6, z * 1.4);
  // North: Gravereach plateau — raised and broken, with a steep escarpment where it
  // meets the heartland (the `edge` term sharpens the lower half of the ramp into a cliff).
  const edge = smoothstep(0.12, 0.5, northM);
  h += northM * PLATEAU * (0.7 + 0.3 * noise(x, z * 1.2)) + edge * 7;
  // NE: Thornwood forested hills (gentle, rolling).
  h += f.ne * FOREST * (0.6 + 0.4 * noise(x * 0.7, z * 0.7));
  // South: the Sunken Fen sinks below the heartland into a broad wetland basin.
  h -= f.south * BOG * (0.7 + 0.3 * Math.abs(noise(x, z)));
  return h;
}

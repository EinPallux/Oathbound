// Lakes (pure data, no Three.js): a handful of deterministic water bodies. Each lake
// flattens a shallow basin (removing the local rolling hills) and carves a bowl into it,
// so it reliably holds water regardless of the surrounding terrain; the renderer
// (scenery-view.ts) draws a flat translucent disc at the water level. The basin level is
// taken from the biome's base elevation (seed-independent), so the heightfield carve and
// the renderer always agree without a chicken-and-egg dependency on the generated field.
//
// All lakes sit well away from the origin, so the spawn and the 100 m unit-test field are
// untouched (the carve is a no-op beyond each lake's outer radius).

import { biomeElevation, smoothstep } from './biomes';

export interface Lake {
  /** Centre (world XZ). */
  x: number;
  z: number;
  /** Open-water (shoreline) radius (m). */
  r: number;
}

export const WORLD_LAKES: Lake[] = [
  { x: 46, z: -170, r: 38 }, // the Fen Mere — a broad wetland lake (deep south)
  { x: -88, z: 72, r: 22 }, // Stillwater Pond — west of the heartland
  { x: 68, z: 112, r: 16 }, // a forest tarn near the Thornwood fringe (north)
  { x: -150, z: -120, r: 18 }, // a crater pool on the Emberreach march (south-west)
];

const BANK = 1.22; // outer basin radius = r * BANK (the flattened shore ring)
const BED_DROP = 3.2; // how far the bed is carved below the basin level (m)
const WATER_BELOW = 0.4; // water surface sits this far below the basin rim

/** The flat basin level for a lake — the biome base elevation at its centre. */
function basinLevel(lk: Lake): number {
  return biomeElevation(lk.x, lk.z);
}

/**
 * Shape the terrain height at (x, z) for any lake covering it: flatten the basin toward
 * its level, then carve a bowl below it. A no-op outside every lake's outer radius.
 */
export function carveLakes(x: number, z: number, h: number): number {
  let out = h;
  for (const lk of WORLD_LAKES) {
    const d = Math.hypot(x - lk.x, z - lk.z);
    const outer = lk.r * BANK;
    if (d >= outer) continue;
    const ref = basinLevel(lk);
    // Flatten the basin (and its bank ring) toward the reference level.
    out += (ref - out) * smoothstep(outer, lk.r, d);
    // Inside the shoreline, carve a smooth bowl below the basin level.
    if (d < lk.r) out += (ref - BED_DROP - out) * smoothstep(lk.r, lk.r * 0.2, d);
  }
  return out;
}

/** Water-surface height of the lake containing (x, z), or null on land. */
export function lakeWaterY(x: number, z: number): number | null {
  for (const lk of WORLD_LAKES) {
    if (Math.hypot(x - lk.x, z - lk.z) < lk.r) return basinLevel(lk) - WATER_BELOW;
  }
  return null;
}

/** Water-surface height for a known lake (used when drawing its disc). */
export function waterLevel(lk: Lake): number {
  return basinLevel(lk) - WATER_BELOW;
}

/** True if (x, z) is within a lake's open water (used to keep big props out of the water). */
export function inLakeWater(x: number, z: number, margin = 0): boolean {
  for (const lk of WORLD_LAKES) {
    if (Math.hypot(x - lk.x, z - lk.z) < lk.r * 0.92 + margin) return true;
  }
  return false;
}

/**
 * Classify (x, z) relative to the nearest lake: 'water' (open water, for lily pads),
 * 'shore' (the reed/cattail band around the waterline), or 'land'.
 */
export function lakeZone(x: number, z: number): 'water' | 'shore' | 'land' {
  for (const lk of WORLD_LAKES) {
    const d = Math.hypot(x - lk.x, z - lk.z);
    if (d < lk.r * 0.78) return 'water';
    if (d < lk.r * 1.08) return 'shore';
  }
  return 'land';
}

// World layout constants — the single source of truth for how big the world is and
// where the frontier zones begin. Pure data (no Three.js) so the sim, the region
// atlas, the biome field, and the renderer all agree on one coordinate space.
//
// 0.6.0 map expansion: Oathbound's world was grown from a 100 m greybox into a large
// open world. Oathhold + the Greenmarch heartland sit around the origin; the five
// frontier regions are spread far out in their cardinal/diagonal directions (see
// docs/design/WORLD_AND_ZONES.md and src/sim/content/regions.ts). Keeping these knobs
// here means the world can be retuned in one place without touching content or render.

/** World extent (square, centred on the origin): playable area is ±WORLD_SIZE/2. */
export const WORLD_SIZE = 680;

/** Heightfield grid resolution (samples per side). ~1.57 m per cell at WORLD_SIZE. */
export const WORLD_RES = 433;

/**
 * Radius of the central safe hub (Oathhold) around the origin, in metres. Kept small
 * so the Greenmarch starter camp sits just outside town (the first mob is within
 * melee range of spawn — onboarding + the boot e2e rely on this).
 */
export const HUB_RADIUS = 6;

/**
 * Distance from the origin at which the frontier regions begin. Inside this radius is
 * the Greenmarch heartland (Lv 1–5) around the hub; beyond it, the higher zones fan
 * out by direction. Region boundaries (regions.ts) and the biome field (biomes.ts)
 * both key off this value.
 */
export const ZONE_THRESHOLD = 120;

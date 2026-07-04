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

/** Heightfield grid resolution (samples per side). ~1.57 m per cell at WORLD_SIZE.
 *  This drives gameplay sampling (ground-snap, collision) and stays high-res. */
export const WORLD_RES = 433;

/**
 * Terrain *render* tessellation (vertices per side) — decoupled from WORLD_RES so the
 * draw mesh isn't forced to the gameplay sampling density. The single world-spanning
 * terrain mesh is the largest fixed triangle cost (never frustum-culled), so we draw it
 * at ~half the heightfield density: ~3.1 m cells, 2·216² ≈ 93k triangles instead of
 * 2·432² ≈ 373k — a ~4× cut with no visible loss at the low-poly art scale (heights are
 * still sampled from the full-res field at every vertex, so the landforms are identical).
 */
export const TERRAIN_RENDER_RES = 217;

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

/**
 * "Cube World" voxel collision grid. When a heightfield's `voxelCube`/`voxelStep` are set
 * to these, {@link Heightfield.sample} snaps to a fixed grid of `VOXEL_CUBE`-metre cells and
 * quantizes height to `VOXEL_STEP`, so the cubes you *see* are the cubes you *stand on*.
 * These live here (not in the renderer) because collision (src/sim/systems/movement.ts) reads
 * them, so the sim — including a headless server — must agree with the renderer on one value.
 * The render *view distance* for the voxel bubble (`VOXEL_VIEW`) stays in the renderer; it's
 * purely visual and the sim never needs it.
 */
export const VOXEL_CUBE = 3;
export const VOXEL_STEP = 2;

// Pure-data terrain: a heightfield grid plus static cylinder colliders.
// No Three.js here so the simulation/collision can use it and be unit-tested.
// The renderer builds meshes from the same data (src/render/terrain-mesh.ts).

import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { biomeElevation, smoothstep } from './biomes';
import { carveLakes } from './lakes';

export interface CylinderCollider {
  x: number;
  z: number;
  radius: number;
}

/** An oriented (rotatable) box footprint on the XZ plane — used for buildings. */
export interface BoxCollider {
  x: number;
  z: number;
  /** Half-extents along the box's local x / z before rotation. */
  hw: number;
  hd: number;
  /** Y rotation (radians). */
  rot: number;
}

/** A spot to level into a flat shelf (boss arenas, the starting village). */
export interface FlatSpot {
  x: number;
  z: number;
  r: number;
}

export class Heightfield {
  /** World size (square), centred at the origin. */
  readonly size: number;
  /** Grid samples per side. */
  readonly res: number;
  /** Row-major heights, length res*res. */
  readonly heights: Float32Array;
  private readonly cell: number;

  /**
   * Voxel / "Cube World" collision grid. When `voxelCube > 0`, {@link sample} snaps to a fixed
   * world grid of `voxelCube`-metre cells and quantizes the height to `voxelStep`, so the player,
   * enemies and placed assets all stand on the exact flat cube tops the renderer draws (no more
   * clipping through the smooth surface). 0 = smooth terrain (default). Set by the renderer/boot.
   */
  voxelCube = 0;
  /** Vertical quantization (m) for the voxel grid; 0 = no vertical stepping. */
  voxelStep = 0;

  constructor(size: number, res: number, heights: Float32Array) {
    this.size = size;
    this.res = res;
    this.heights = heights;
    this.cell = size / (res - 1);
  }

  /** Raw bilinear terrain height at world (x, z) — the smooth surface; clamps to edges. */
  private raw(x: number, z: number): number {
    const half = this.size / 2;
    const fx = (x + half) / this.cell;
    const fz = (z + half) / this.cell;
    const x0 = clamp(Math.floor(fx), 0, this.res - 1);
    const z0 = clamp(Math.floor(fz), 0, this.res - 1);
    const x1 = Math.min(this.res - 1, x0 + 1);
    const z1 = Math.min(this.res - 1, z0 + 1);
    const tx = clamp(fx - x0, 0, 1);
    const tz = clamp(fz - z0, 0, 1);
    const h00 = this.heights[z0 * this.res + x0];
    const h10 = this.heights[z0 * this.res + x1];
    const h01 = this.heights[z1 * this.res + x0];
    const h11 = this.heights[z1 * this.res + x1];
    const a = h00 + (h10 - h00) * tx;
    const b = h01 + (h11 - h01) * tx;
    return a + (b - a) * tz;
  }

  /**
   * Ground height for collision & placement. Smooth (bilinear) by default; in voxel mode it
   * returns the flat top of the cube containing (x, z) — snapped to the fixed cube grid and
   * quantized — so gameplay sits exactly on the rendered cubes.
   */
  sample(x: number, z: number): number {
    return this.voxelCube > 0 ? this.voxelHeightAt(x, z) : this.raw(x, z);
  }

  /**
   * Flat top height of the voxel cube containing (x, z): snap to the fixed `voxelCube` grid
   * (cell centres at (k+0.5)·cube), sample there, quantize to `voxelStep`. The renderer builds
   * its cubes from this exact function, so collision and the visible cubes always agree.
   */
  voxelHeightAt(x: number, z: number): number {
    if (this.voxelCube <= 0) return this.raw(x, z);
    const cx = (Math.floor(x / this.voxelCube) + 0.5) * this.voxelCube;
    const cz = (Math.floor(z / this.voxelCube) + 0.5) * this.voxelCube;
    const h = this.raw(cx, cz);
    return this.voxelStep > 0 ? Math.round(h / this.voxelStep) * this.voxelStep : h;
  }
}

/**
 * Open-world terrain: gentle layered hills as a base, plus a biome-shaped elevation
 * offset (Riven mountains, the Fen depression, the Gravereach plateau…), with a
 * flattened spawn area near the origin. Deterministic for a given seed — the biome
 * offset is a pure function of position, so the simulation and renderer agree.
 *
 * The biome ramps only kick in well beyond the hub (see biomes.ts), so a small field
 * (e.g. the 100 m unit-test field) is just the rolling hills + flat spawn as before.
 */
export function generateHeightfield(
  size: number,
  res: number,
  seed = 1,
  flats: readonly FlatSpot[] = [],
): Heightfield {
  const rng = new Rng(seed);
  const ox = rng.range(0, 100);
  const oz = rng.range(0, 100);
  const heights = new Float32Array(res * res);
  const half = size / 2;
  const cell = size / (res - 1);

  // Base rolling hills: a few sine octaves for natural, varied terrain (a broad
  // continental swell + mid rolls + finer undulation). Kept moderate so it's traversable.
  const base = (wx: number, wz: number): number =>
    Math.sin((wx + ox) * 0.06) * Math.cos((wz + oz) * 0.05) * 2.4 +
    Math.sin(wx * 0.13 + oz) * 0.7 +
    Math.cos(wz * 0.11 + ox) * 0.7 +
    Math.sin((wx - wz) * 0.025 + ox) * 1.5 +
    Math.sin(wx * 0.014 - oz) * Math.cos(wz * 0.013 + ox) * 3.0;

  // Natural height = base hills + biome landforms, with lake bowls carved in.
  const natural = (wx: number, wz: number): number =>
    carveLakes(wx, wz, base(wx, wz) + biomeElevation(wx, wz));

  // Each flat spot levels to its own centre height, so arenas/the village sit on a shelf.
  const flatTargets = flats.map((s) => ({ ...s, y: natural(s.x, s.z) }));

  for (let zi = 0; zi < res; zi++) {
    for (let xi = 0; xi < res; xi++) {
      const wx = -half + xi * cell;
      const wz = -half + zi * cell;
      let h = natural(wx, wz);

      // Level flat shelves (boss arenas / village) toward their centre height.
      for (const s of flatTargets) {
        const d = Math.hypot(wx - s.x, wz - s.z);
        if (d < s.r) h += (s.y - h) * smoothstep(s.r, s.r * 0.55, d);
      }

      // Flatten a clear spawn area within ~8 units of the origin.
      const d0 = Math.hypot(wx, wz);
      h *= 1 - Math.max(0, 1 - d0 / 8);
      heights[zi * res + xi] = h;
    }
  }
  return new Heightfield(size, res, heights);
}

/** Scattered rock colliders, kept clear of the spawn. Deterministic per seed. */
export function generateColliders(size: number, count = 24, seed = 2): CylinderCollider[] {
  const rng = new Rng(seed);
  const limit = size / 2 - 6;
  const cols: CylinderCollider[] = [];
  for (let i = 0; i < count; i++) {
    let x = rng.range(-limit, limit);
    let z = rng.range(-limit, limit);
    if (Math.hypot(x, z) < 10) {
      x += 14 * Math.sign(x || 1);
      z += 14 * Math.sign(z || 1);
    }
    cols.push({ x, z, radius: rng.range(0.8, 1.8) });
  }
  return cols;
}

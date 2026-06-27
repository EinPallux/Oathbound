// Pure-data terrain: a heightfield grid plus static cylinder colliders.
// No Three.js here so the simulation/collision can use it and be unit-tested.
// The renderer builds meshes from the same data (src/render/terrain-mesh.ts).

import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { biomeElevation } from './biomes';

export interface CylinderCollider {
  x: number;
  z: number;
  radius: number;
}

export class Heightfield {
  /** World size (square), centred at the origin. */
  readonly size: number;
  /** Grid samples per side. */
  readonly res: number;
  /** Row-major heights, length res*res. */
  readonly heights: Float32Array;
  private readonly cell: number;

  constructor(size: number, res: number, heights: Float32Array) {
    this.size = size;
    this.res = res;
    this.heights = heights;
    this.cell = size / (res - 1);
  }

  /** Bilinearly sample the terrain height at world (x, z); clamps to edges. */
  sample(x: number, z: number): number {
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
export function generateHeightfield(size: number, res: number, seed = 1): Heightfield {
  const rng = new Rng(seed);
  const ox = rng.range(0, 100);
  const oz = rng.range(0, 100);
  const heights = new Float32Array(res * res);
  const half = size / 2;
  const cell = size / (res - 1);

  for (let zi = 0; zi < res; zi++) {
    for (let xi = 0; xi < res; xi++) {
      const wx = -half + xi * cell;
      const wz = -half + zi * cell;
      let h =
        Math.sin((wx + ox) * 0.06) * Math.cos((wz + oz) * 0.05) * 2.2 +
        Math.sin(wx * 0.13 + oz) * 0.6 +
        Math.cos(wz * 0.11 + ox) * 0.6;
      h += biomeElevation(wx, wz);
      // Flatten a clear spawn area within ~8 units of the origin.
      const d = Math.hypot(wx, wz);
      const flat = Math.max(0, 1 - d / 8);
      h *= 1 - flat;
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

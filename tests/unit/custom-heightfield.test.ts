import { describe, it, expect } from 'vitest';
import { buildCustomHeightfield } from '../../src/world/custom-map';
import { Heightfield } from '../../src/world/heightfield';
import { TERRAIN_RENDER_RES } from '../../src/world/layout';
import { blankMap } from '../../src/world/map-format';

// The surface the terrain MESH draws: the field sampled at the render-grid vertices
// (buildCustomTerrainMesh tessellates at min(res-1, TERRAIN_RENDER_RES-1) and samples there).
function drawnSurface(full: Heightfield, size: number, res: number): Heightfield {
  const half = size / 2;
  const cell = size / (res - 1);
  const grid = new Float32Array(res * res);
  for (let z = 0; z < res; z++) {
    for (let x = 0; x < res; x++) grid[z * res + x] = full.sample(-half + x * cell, -half + z * cell);
  }
  return new Heightfield(size, res, grid);
}

describe('buildCustomHeightfield — collision matches the rendered terrain', () => {
  it('resamples a finer-than-render field to the render grid so the player stands on the drawn surface', () => {
    const size = 600;
    const res = 2 * TERRAIN_RENDER_RES - 1; // 433 — finer than the render cap
    const half = size / 2;
    const map = blankMap('detail', size, res);
    const heights = new Array(res * res);
    for (let z = 0; z < res; z++) {
      for (let x = 0; x < res; x++) {
        const wx = -half + (x * size) / (res - 1);
        const wz = -half + (z * size) / (res - 1);
        // Smooth hills + a ~3 m-wavelength ripple the full grid resolves but the coarse mesh aliases.
        heights[z * res + x] = 10 * Math.sin(wx * 0.03) * Math.cos(wz * 0.03) + 3 * Math.sin(wx * 2.094);
      }
    }
    map.heights = heights;

    const full = new Heightfield(size, res, Float32Array.from(heights)); // the OLD collision (full res)
    const drawn = drawnSurface(full, size, TERRAIN_RENDER_RES);          // what the mesh actually shows
    const collision = buildCustomHeightfield(map);                       // the NEW collision

    // Collision now lives on the render grid (the same one the mesh tessellates).
    expect(collision.res).toBe(TERRAIN_RENDER_RES);

    let maxNew = 0;
    let maxOld = 0;
    for (let i = 1; i <= 500; i++) {
      const x = -half + ((i * 137.51) % size); // arbitrary probe points (between grid lines)
      const z = -half + ((i * 89.27) % size);
      maxNew = Math.max(maxNew, Math.abs(collision.sample(x, z) - drawn.sample(x, z)));
      maxOld = Math.max(maxOld, Math.abs(full.sample(x, z) - drawn.sample(x, z)));
    }
    // New collision sits on the drawn surface (no sinking); the old full-res field diverged from it.
    expect(maxNew).toBeLessThan(0.05);
    expect(maxOld).toBeGreaterThan(1);
  });

  it('leaves a map at/below the render resolution exactly as authored', () => {
    const map = blankMap('small', 260, 53); // like the sample map — well under the cap
    expect(buildCustomHeightfield(map).res).toBe(53);
  });
});

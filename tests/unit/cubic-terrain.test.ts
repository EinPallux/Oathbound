import { describe, it, expect } from 'vitest';
import { cubicTerrainGeometry } from '../../src/world/map-format';

// A colorAt that writes a fixed top colour, so we can check tops vs darkened sides.
const solid = (r: number, g: number, b: number) =>
  (_x: number, _z: number, _h: number, out: [number, number, number]): void => {
    out[0] = r; out[1] = g; out[2] = b;
  };

describe('cubicTerrainGeometry (voxel terrain)', () => {
  it('flat ground → one top quad per tile, no side walls', () => {
    const cells = 3;
    const g = cubicTerrainGeometry(6, cells, 2, () => 4, solid(0.2, 0.4, 0.6));
    // 9 tiles × 4 verts × 3 coords, all tops (no cliffs anywhere).
    expect(g.positions.length).toBe(cells * cells * 4 * 3);
    expect(g.indices.length).toBe(cells * cells * 6);
    // Every vertex is a top: y is the quantized height (4) and the normal points up.
    for (let i = 0; i < g.positions.length / 3; i++) {
      expect(g.positions[i * 3 + 1]).toBe(4);
      expect(g.normals[i * 3 + 1]).toBe(1);
    }
    // Indices stay in range.
    const verts = g.positions.length / 3;
    for (const idx of g.indices) expect(idx).toBeLessThan(verts);
  });

  it('quantizes heights to the step', () => {
    const flat = cubicTerrainGeometry(4, 2, 1, () => 3.2, solid(1, 1, 1));
    expect(flat.positions[1]).toBe(3); // 3.2 → nearest 1 m → 3
    const off = cubicTerrainGeometry(4, 2, 0, () => 3.7, solid(1, 1, 1));
    expect(off.positions[1]).toBeCloseTo(3.7, 6); // step 0 disables quantization
  });

  it('emits vertical side walls at a cliff, darker than the tops', () => {
    // Left half low (0), right half high (8): a cliff down the middle.
    const cells = 4;
    const g = cubicTerrainGeometry(8, cells, 1, (x) => (x >= 0 ? 8 : 0), solid(0.5, 0.5, 0.5));
    // More geometry than tops-only (walls added).
    expect(g.positions.length).toBeGreaterThan(cells * cells * 4 * 3);
    // At least one wall vertex: a horizontal outward normal.
    let wallVerts = 0;
    let sawDarkSide = false;
    for (let i = 0; i < g.positions.length / 3; i++) {
      const nx = g.normals[i * 3], nz = g.normals[i * 3 + 2];
      if (Math.abs(nx) === 1 || Math.abs(nz) === 1) {
        wallVerts++;
        // Side colour is the top colour darkened (0.5 * 0.7 = 0.35).
        if (Math.abs(g.colors[i * 3] - 0.35) < 1e-6) sawDarkSide = true;
      }
    }
    expect(wallVerts).toBeGreaterThan(0);
    expect(sawDarkSide).toBe(true);
  });

  it('produces finite positions/normals/colors and Uint32 indices', () => {
    const g = cubicTerrainGeometry(10, 5, 2, (x, z) => Math.sin(x * 0.3) * 4 + z * 0.1, solid(0.3, 0.6, 0.2));
    expect(g.indices).toBeInstanceOf(Uint32Array);
    for (const v of g.positions) expect(Number.isFinite(v)).toBe(true);
    for (const v of g.normals) expect(Number.isFinite(v)).toBe(true);
    for (const v of g.colors) expect(v).toBeGreaterThanOrEqual(0);
  });
});

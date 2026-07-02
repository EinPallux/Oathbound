import { describe, it, expect } from 'vitest';
import { Heightfield } from '../../src/world/heightfield';

// A linear ramp rising along +x at 1 m per metre. With a 4 m cube grid the cube centres sit at
// even x (2, 6, 10, …) → even heights → clean quantization (no half-step rounding ambiguity).
function ramp(size = 100, res = 11): Heightfield {
  const h = new Float32Array(res * res);
  const cell = size / (res - 1), half = size / 2;
  for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) h[z * res + x] = -half + x * cell;
  return new Heightfield(size, res, h);
}

describe('Heightfield voxel snapping (collision hook)', () => {
  it('is smooth bilinear when voxelCube = 0', () => {
    const f = ramp();
    expect(f.sample(0, 0)).toBeCloseTo(0, 5);
    expect(f.sample(10, 0)).toBeCloseTo(10, 5);
    expect(f.sample(5, 0)).toBeCloseTo(5, 5); // interpolated, not stepped
  });

  it('snaps to flat cube tops on a fixed grid + quantizes vertically in voxel mode', () => {
    const f = ramp();
    f.voxelCube = 4;
    f.voxelStep = 2;
    // Two points inside the same 4 m cube [0,4) share one flat height.
    const a = f.sample(0.5, 0.5);
    const b = f.sample(3.4, 0.5);
    expect(a).toBe(b);
    expect(a % 2).toBeCloseTo(0, 6); // a multiple of the vertical step
    // A cube several cells away up the ramp is a clearly higher flat height.
    const c = f.sample(24.5, 0.5);
    expect(c).toBeGreaterThan(a);
    expect(c % 2).toBeCloseTo(0, 6);
  });

  it('voxelHeightAt equals sample in voxel mode, so render + collision agree', () => {
    const f = ramp();
    f.voxelCube = 4;
    f.voxelStep = 2;
    for (const [x, z] of [[1, 1], [6, -3], [-7, 2], [12.3, 4.4]]) {
      expect(f.sample(x, z)).toBe(f.voxelHeightAt(x, z));
    }
  });
});

import { describe, it, expect } from 'vitest';
import { packWater, unpackWaterPacked, hasWater, waterSurfaceGeometry } from '../../src/world/map-format';

describe('water packing', () => {
  it('round-trips finite levels and preserves dry (NaN) cells', () => {
    const grid = new Float32Array([NaN, 4.25, NaN, -3.5, 12.0, NaN]);
    const back = unpackWaterPacked(packWater(grid));
    expect(back.length).toBe(grid.length);
    expect(Number.isNaN(back[0])).toBe(true);
    expect(back[1]).toBeCloseTo(4.25, 2);
    expect(Number.isNaN(back[2])).toBe(true);
    expect(back[3]).toBeCloseTo(-3.5, 2);
    expect(back[4]).toBeCloseTo(12.0, 2);
    expect(Number.isNaN(back[5])).toBe(true);
  });

  it('hasWater detects any wet cell', () => {
    expect(hasWater(new Float32Array([NaN, NaN, NaN]))).toBe(false);
    expect(hasWater(new Float32Array([NaN, 2, NaN]))).toBe(true);
  });
});

describe('waterSurfaceGeometry', () => {
  const RES = 8;
  const SIZE = 70;

  function flat(h: number): Float32Array {
    return new Float32Array(RES * RES).fill(h);
  }
  function dry(): Float32Array {
    return new Float32Array(RES * RES).fill(NaN);
  }

  it('emits a surface where painted water sits above the terrain', () => {
    const heights = flat(0);
    const water = dry();
    // Paint a 3×3 block of vertices wet at level 5 (well above the flat ground).
    for (let z = 2; z <= 4; z++) for (let x = 2; x <= 4; x++) water[z * RES + x] = 5;
    const { positions, indices } = waterSurfaceGeometry(water, heights, RES, SIZE);
    expect(positions.length).toBeGreaterThan(0);
    expect(indices.length).toBeGreaterThan(0);
    // Every emitted vertex sits at the painted level (5 m).
    for (let i = 1; i < positions.length; i += 3) expect(positions[i]).toBeCloseTo(5, 5);
  });

  it('shows nothing when the water level is at/below the ground', () => {
    const heights = flat(10); // ground above the water
    const water = dry();
    for (let z = 2; z <= 4; z++) for (let x = 2; x <= 4; x++) water[z * RES + x] = 5;
    const { positions } = waterSurfaceGeometry(water, heights, RES, SIZE);
    expect(positions.length).toBe(0);
  });

  it('emits nothing for a fully dry grid', () => {
    expect(waterSurfaceGeometry(dry(), flat(0), RES, SIZE).positions.length).toBe(0);
  });

  it('clips water to the submerged part of a slope (fills a basin to the level)', () => {
    // Ground ramps from -10 (west) to +10 (east); flood the whole grid to y=0.
    const heights = new Float32Array(RES * RES);
    for (let z = 0; z < RES; z++) for (let x = 0; x < RES; x++) heights[z * RES + x] = -10 + (20 * x) / (RES - 1);
    const water = new Float32Array(RES * RES).fill(0);
    const { positions } = waterSurfaceGeometry(water, heights, RES, SIZE);
    // Some cells (the low west side) flood; the high east side stays dry → partial coverage.
    const cells = positions.length / 12; // 4 verts (12 floats) per emitted cell-quad
    expect(cells).toBeGreaterThan(0);
    expect(cells).toBeLessThan((RES - 1) * (RES - 1)); // not the whole grid
  });
});

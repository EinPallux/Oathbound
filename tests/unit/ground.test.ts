import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { colorForBiome } from '../../src/render/custom-map-view';
import { BIOME_IDS } from '../../src/world/map-format';

const col = (biome: number, h = 0, x = 0, z = 0): THREE.Color => colorForBiome(biome, h, x, z, new THREE.Color());

describe('ground colours', () => {
  it('every ground index maps to a finite colour', () => {
    for (let i = 0; i < BIOME_IDS.length; i++) {
      const c = col(i);
      for (const ch of [c.r, c.g, c.b]) expect(Number.isFinite(ch)).toBe(true);
    }
    expect(BIOME_IDS.length).toBeGreaterThanOrEqual(20); // the new ground surfaces exist
  });

  it('reads grass as green and the new surfaces with their expected character', () => {
    const grass = col(0);
    expect(grass.g).toBeGreaterThan(grass.r);
    expect(grass.g).toBeGreaterThan(grass.b);

    // City (7) — desaturated grey stone (channels close together), NOT green.
    const city = col(7);
    const maxc = Math.max(city.r, city.g, city.b);
    const minc = Math.min(city.r, city.g, city.b);
    expect(maxc - minc).toBeLessThan(0.08); // near-grey
    expect(city.g).toBeLessThan(grass.g);    // clearly not grassy

    // Desert (8) — warm sand: red ≳ green > blue.
    const desert = col(8);
    expect(desert.r).toBeGreaterThan(desert.b);
    expect(desert.g).toBeGreaterThan(desert.b);

    // Mesa (9) — red rock: red dominates.
    const mesa = col(9);
    expect(mesa.r).toBeGreaterThan(mesa.g);
    expect(mesa.r).toBeGreaterThan(mesa.b);

    // Basalt (19) — very dark.
    const basalt = col(19);
    expect(Math.max(basalt.r, basalt.g, basalt.b)).toBeLessThan(0.25);
  });

  it('gives city/cobblestone a position-varying paved pattern (slabs + seams)', () => {
    // Sample many spots; a flat colour would give one unique value, paving gives several.
    const shades = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const c = col(7, 0, i * 3.1, i * 5.7);
      shades.add(`${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)}`);
    }
    expect(shades.size).toBeGreaterThan(5); // slab-to-slab + seam variation

    // A non-paved ground (desert) is uniform regardless of position.
    const flat = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const c = col(8, 0, i * 3.1, i * 5.7);
      flat.add(`${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)}`);
    }
    expect(flat.size).toBe(1);
  });
});

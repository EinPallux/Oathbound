import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { colorForBiome } from '../../src/render/custom-map-view';
import { BIOME_IDS, pavedSurfaceGeometry } from '../../src/world/map-format';

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
    expect(city.g - city.r).toBeLessThan(0.03); // green doesn't dominate → not grassy

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

    // Mountains (20) — rocky grey-brown low down, snow-capped on the peaks.
    const mtnLow = col(20, 2);
    expect(mtnLow.r).toBeGreaterThanOrEqual(mtnLow.b); // warm grey-brown, not blue
    expect(mtnLow.g).toBeLessThan(grass.g); // rock, not grass
    const mtnHigh = col(20, 60);
    const brightLow = Math.max(mtnLow.r, mtnLow.g, mtnLow.b);
    const brightHigh = Math.max(mtnHigh.r, mtnHigh.g, mtnHigh.b);
    expect(brightHigh).toBeGreaterThan(brightLow); // snow makes the peaks brighter
  });

  it('paints city & cobblestone as flat vertex colours (fine paving is a texture overlay)', () => {
    // The paved look now comes from a repeat-tiled texture mesh, so the underlying terrain
    // vertex colour is uniform — sampling many positions yields exactly one colour.
    for (const g of [7, 15]) {
      const shades = new Set<string>();
      for (let i = 0; i < 60; i++) {
        const c = col(g, 0, i * 3.1, i * 5.7);
        shades.add(`${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)}`);
      }
      expect(shades.size).toBe(1);
    }
  });

  it('builds a paving overlay mesh only where city/cobblestone is painted', () => {
    const res = 4;
    const size = 30;
    const heights = new Float32Array(res * res); // flat ground
    const grass = new Uint8Array(res * res); // all grass (0) → no paving
    expect(pavedSurfaceGeometry(grass, heights, res, size).positions.length).toBe(0);

    const city = new Uint8Array(res * res);
    city[0] = 7; // one city cell
    const g1 = pavedSurfaceGeometry(city, heights, res, size);
    expect(g1.positions.length).toBeGreaterThan(0);
    expect(g1.uvs.length).toBeGreaterThan(0);
    expect(g1.indices.length).toBeGreaterThan(0);

    const cobble = new Uint8Array(res * res);
    cobble[5] = 15; // cobblestone counts too
    expect(pavedSurfaceGeometry(cobble, heights, res, size).positions.length).toBeGreaterThan(0);
  });
});

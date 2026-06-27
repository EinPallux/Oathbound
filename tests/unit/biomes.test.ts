import { describe, it, expect } from 'vitest';
import { smoothstep, biomeElevation, dominantBiome, biomeFactors } from '../../src/world/biomes';
import { ZONE_THRESHOLD } from '../../src/world/layout';

const FAR = ZONE_THRESHOLD + 60;

describe('biomes', () => {
  it('smoothstep ramps 0 → 1 across [a, b]', () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
    expect(smoothstep(0, 10, 15)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5);
    expect(smoothstep(0, 10, 2)).toBeLessThan(smoothstep(0, 10, 8));
  });

  it('biome elevation is ~flat near the hub (keeps the spawn + small fields tame)', () => {
    // Within the heartland the biome ramps are still 0 — the unit-test 100 m field
    // (sampled within ±50) must stay just rolling hills.
    for (const [x, z] of [
      [0, 0],
      [40, 0],
      [0, -40],
      [-50, 30],
    ]) {
      expect(Math.abs(biomeElevation(x, z))).toBeLessThan(0.5);
    }
  });

  it('raises the eastern Riven Peaks and sinks the southern Fen', () => {
    expect(biomeElevation(FAR, 0)).toBeGreaterThan(8); // mountains
    expect(biomeElevation(0, -FAR)).toBeLessThan(0); // bog depression
  });

  it('assigns the dominant biome by direction', () => {
    expect(dominantBiome(0, 0)).toBe('hub');
    expect(dominantBiome(FAR, 0)).toBe('riven'); // east
    expect(dominantBiome(-FAR, 0)).toBe('ember'); // west
    expect(dominantBiome(0, -FAR)).toBe('fen'); // south
    expect(dominantBiome(0, FAR)).toBe('gravereach'); // north
    expect(dominantBiome(FAR, FAR)).toBe('thornwood'); // NE corner
    expect(dominantBiome(50, 30)).toBe('greenmarch'); // heartland
  });

  it('factor memberships are bounded in [0, 1]', () => {
    for (const [x, z] of [
      [FAR, FAR],
      [-FAR, -FAR],
      [0, 0],
      [200, -50],
    ]) {
      const f = biomeFactors(x, z);
      for (const v of Object.values(f)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

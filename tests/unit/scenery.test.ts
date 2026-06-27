import { describe, it, expect } from 'vitest';
import { generateScenery, type Clearing } from '../../src/world/scenery';
import { WORLD_SIZE } from '../../src/world/layout';

describe('scenery generation', () => {
  it('is deterministic for a given seed + options', () => {
    const a = generateScenery(WORLD_SIZE, { seed: 123 });
    const b = generateScenery(WORLD_SIZE, { seed: 123 });
    expect(a.trees.length).toBe(b.trees.length);
    expect(a.boulders.length).toBe(b.boulders.length);
    expect(JSON.stringify(a.trees[0])).toBe(JSON.stringify(b.trees[0]));
    // A different seed produces a different scattering.
    const c = generateScenery(WORLD_SIZE, { seed: 999 });
    expect(JSON.stringify(c.trees[0])).not.toBe(JSON.stringify(a.trees[0]));
  });

  it('populates every decorative layer', () => {
    const s = generateScenery(WORLD_SIZE, { seed: 7 });
    expect(s.trees.length).toBeGreaterThan(50);
    expect(s.boulders.length).toBeGreaterThan(20);
    expect(s.pebbles.length).toBeGreaterThan(20);
    expect(s.bushes.length).toBeGreaterThan(20);
    expect(s.grass.length).toBeGreaterThan(50);
    expect(s.flowers.length).toBeGreaterThan(10);
    expect(s.rivers.length).toBeGreaterThan(0);
  });

  it('mixes tree variants (broadleaf, pine, dead) across the biomes', () => {
    const variants = new Set(generateScenery(WORLD_SIZE, { seed: 7 }).trees.map((t) => t.variant));
    expect(variants.has(0)).toBe(true); // broadleaf
    expect(variants.has(1)).toBe(true); // pine (Riven)
    expect(variants.has(2)).toBe(true); // dead/charred
  });

  it('keeps large props clear of the hub and of provided clearings (camps/waypoints)', () => {
    const clearings: Clearing[] = [{ x: 132, z: 132, r: 10 }];
    const s = generateScenery(WORLD_SIZE, { seed: 7, clearings });
    for (const t of s.trees) {
      expect(Math.hypot(t.x, t.z)).toBeGreaterThan(15); // outside the town plaza
      expect(Math.hypot(t.x - 132, t.z - 132)).toBeGreaterThan(10); // outside the camp
    }
    for (const b of s.bushes) {
      expect(Math.hypot(b.x - 132, b.z - 132)).toBeGreaterThan(10);
    }
  });

  it('builds one road per target, from the hub out to each destination', () => {
    const targets = [
      { x: 132, z: 6 },
      { x: 0, z: -132 },
    ];
    const s = generateScenery(WORLD_SIZE, { seed: 7, roadTargets: targets });
    expect(s.roads.length).toBe(2);
    for (let i = 0; i < targets.length; i++) {
      const pts = s.roads[i].points;
      expect(pts.length).toBeGreaterThanOrEqual(2);
      expect(Math.hypot(pts[0].x, pts[0].z)).toBeLessThan(2); // starts at the hub
      const end = pts[pts.length - 1];
      expect(Math.hypot(end.x - targets[i].x, end.z - targets[i].z)).toBeLessThan(2);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { Heightfield, generateHeightfield, generateColliders } from '../../src/world/heightfield';

describe('Heightfield', () => {
  // 2x2 grid over a 2-unit square: corners at world -1 and +1.
  const corners = () => new Heightfield(2, 2, new Float32Array([0, 10, 20, 30]));

  it('samples the exact grid corners', () => {
    const f = corners();
    expect(f.sample(-1, -1)).toBeCloseTo(0);
    expect(f.sample(1, -1)).toBeCloseTo(10);
    expect(f.sample(-1, 1)).toBeCloseTo(20);
    expect(f.sample(1, 1)).toBeCloseTo(30);
  });

  it('bilinearly interpolates the centre', () => {
    expect(corners().sample(0, 0)).toBeCloseTo((0 + 10 + 20 + 30) / 4);
  });

  it('clamps out-of-bounds samples to the edges (no NaN)', () => {
    const f = corners();
    expect(f.sample(-100, -100)).toBeCloseTo(0);
    expect(f.sample(100, 100)).toBeCloseTo(30);
  });

  it('generateHeightfield is deterministic and finite, with a flat spawn', () => {
    const a = generateHeightfield(100, 65, 7);
    const b = generateHeightfield(100, 65, 7);
    expect(a.heights).toEqual(b.heights);
    for (const h of a.heights) expect(Number.isFinite(h)).toBe(true);
    expect(Math.abs(a.sample(0, 0))).toBeLessThan(0.5);
  });

  it('generateColliders is deterministic and keeps the spawn clear', () => {
    const a = generateColliders(100, 24, 99);
    const b = generateColliders(100, 24, 99);
    expect(a).toEqual(b);
    expect(a).toHaveLength(24);
    for (const c of a) expect(Math.hypot(c.x, c.z)).toBeGreaterThan(9);
  });
});

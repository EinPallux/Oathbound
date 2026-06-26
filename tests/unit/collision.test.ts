import { describe, it, expect } from 'vitest';
import { resolveCircleVsCylinders } from '../../src/sim/collision';

describe('resolveCircleVsCylinders', () => {
  const col = [{ x: 0, z: 0, radius: 1 }];

  it('pushes an overlapping circle to exactly the surface', () => {
    const r = resolveCircleVsCylinders(0.5, 0, 0.4, col); // minDist 1.4 > dist 0.5
    expect(Math.hypot(r.x, r.z)).toBeCloseTo(1.4, 5);
  });

  it('leaves a non-overlapping circle unchanged', () => {
    const r = resolveCircleVsCylinders(5, 0, 0.4, col);
    expect(r.x).toBeCloseTo(5);
    expect(r.z).toBeCloseTo(0);
  });

  it('handles the exact-centre degenerate case without NaN', () => {
    const r = resolveCircleVsCylinders(0, 0, 0.5, col);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.z)).toBe(true);
    expect(Math.hypot(r.x, r.z)).toBeCloseTo(1.5, 5);
  });

  it('resolves against the nearer of multiple colliders', () => {
    const cols = [
      { x: 0, z: 0, radius: 1 },
      { x: 10, z: 0, radius: 1 },
    ];
    const r = resolveCircleVsCylinders(0.6, 0, 0.4, cols);
    expect(Math.hypot(r.x, r.z)).toBeCloseTo(1.4, 5);
  });
});

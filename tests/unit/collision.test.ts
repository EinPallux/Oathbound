import { describe, it, expect } from 'vitest';
import { resolveCircleVsCylinders, resolveCircleVsBoxes } from '../../src/sim/collision';

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

describe('resolveCircleVsBoxes', () => {
  const box = [{ x: 0, z: 0, hw: 2, hd: 1, rot: 0 }];

  it('pushes a circle out to the nearest face', () => {
    const r = resolveCircleVsBoxes(2.2, 0, 0.4, box); // closest face x=2, dist 0.2 < r
    expect(r.x).toBeCloseTo(2.4, 5);
    expect(r.z).toBeCloseTo(0, 5);
  });

  it('leaves a non-overlapping circle unchanged', () => {
    const r = resolveCircleVsBoxes(5, 0, 0.4, box);
    expect(r.x).toBeCloseTo(5);
    expect(r.z).toBeCloseTo(0);
  });

  it('ejects a circle inside the box along the shallow axis', () => {
    const r = resolveCircleVsBoxes(0, 0, 0.5, box); // penZ(1) < penX(2) → push along z
    expect(r.x).toBeCloseTo(0, 5);
    expect(Math.abs(r.z)).toBeCloseTo(1.5, 5);
  });

  it('respects the box rotation (oriented box)', () => {
    // Rotated 90°: the box now spans ±2 in z and ±1 in x. A circle at (1.2, 0) is past
    // the (now ±1) x face and gets pushed to x = 1 + 0.4.
    const rot = [{ x: 0, z: 0, hw: 2, hd: 1, rot: Math.PI / 2 }];
    const r = resolveCircleVsBoxes(1.2, 0, 0.4, rot);
    expect(r.x).toBeCloseTo(1.4, 5);
    expect(r.z).toBeCloseTo(0, 5);
  });
});

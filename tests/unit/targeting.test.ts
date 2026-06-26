import { describe, it, expect } from 'vitest';
import {
  hostilesInCone,
  nearestInCone,
  cycleTarget,
  segmentBlockedByCylinders,
  type Candidate,
} from '../../src/sim/combat/targeting';

const CONE_HALF = (50 * Math.PI) / 180; // 100° cone

// yaw 0 → forward is +Z.
const candidates: Candidate[] = [
  { entity: 1, x: 0, z: 5 }, // straight ahead, dist 5
  { entity: 2, x: 2, z: 5 }, // ahead-right ~21.8°, dist 5.39
  { entity: 3, x: 0, z: -5 }, // directly behind
  { entity: 4, x: 8, z: 0 }, // 90° to the side
];

describe('hostilesInCone', () => {
  it('keeps only in-range, in-cone hostiles, nearest first', () => {
    const r = hostilesInCone(0, 0, 0, 10, CONE_HALF, candidates);
    expect(r.map((a) => a.entity)).toEqual([1, 2]);
    expect(r[0].dist).toBeCloseTo(5, 5);
  });

  it('respects the range limit', () => {
    const r = hostilesInCone(0, 0, 0, 5.2, CONE_HALF, candidates);
    expect(r.map((a) => a.entity)).toEqual([1]); // entity 2 is 5.39 away
  });

  it('follows the facing yaw', () => {
    // Face -Z (π): only the behind candidate is now in front.
    const r = hostilesInCone(0, 0, Math.PI, 10, CONE_HALF, candidates);
    expect(r.map((a) => a.entity)).toEqual([3]);
  });

  it('nearestInCone returns the closest, or null when none', () => {
    expect(nearestInCone(0, 0, 0, 10, CONE_HALF, candidates)).toBe(1);
    expect(nearestInCone(0, 0, 0, 1, CONE_HALF, candidates)).toBeNull();
  });
});

describe('cycleTarget', () => {
  const ordered = [1, 2, 3];
  it('starts at the first when nothing or an unknown is selected', () => {
    expect(cycleTarget(null, ordered)).toBe(1);
    expect(cycleTarget(99, ordered)).toBe(1);
  });
  it('advances and wraps', () => {
    expect(cycleTarget(1, ordered)).toBe(2);
    expect(cycleTarget(3, ordered)).toBe(1);
  });
  it('returns null for an empty list', () => {
    expect(cycleTarget(2, [])).toBeNull();
  });
});

describe('segmentBlockedByCylinders', () => {
  it('blocks when a cylinder sits on the segment', () => {
    const blocked = segmentBlockedByCylinders(0, 0, 0, 10, [{ x: 0, z: 5, radius: 1 }]);
    expect(blocked).toBe(true);
  });
  it('passes when cylinders are off to the side', () => {
    const blocked = segmentBlockedByCylinders(0, 0, 0, 10, [{ x: 3, z: 5, radius: 1 }]);
    expect(blocked).toBe(false);
  });
  it('pad shrinks the effective radius', () => {
    const cols = [{ x: 0, z: 5, radius: 1 }];
    expect(segmentBlockedByCylinders(0, 0, 0, 10, cols, 1.5)).toBe(false); // pad > radius disables
  });
});

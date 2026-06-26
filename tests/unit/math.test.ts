import { describe, it, expect } from 'vitest';
import { clamp, lerp, lerpAngle } from '../../src/core/math';

describe('math helpers', () => {
  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('lerp interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('lerpAngle takes the shortest arc across the ±π wrap', () => {
    // from +170° to -170° should pass through 180°, not back through 0°.
    const a = (170 * Math.PI) / 180;
    const b = (-170 * Math.PI) / 180;
    const mid = lerpAngle(a, b, 0.5);
    // midpoint should be near ±180° (≈ ±π), i.e. |mid| close to π.
    expect(Math.abs(Math.abs(mid) - Math.PI)).toBeLessThan(0.05);
  });
});

// Low-HP vignette opacity curve (0.7.0 CP3): pure, so testable without a DOM.

import { describe, it, expect } from 'vitest';
import { vignetteOpacity } from '../../src/render/vignette';

describe('low-HP vignette', () => {
  it('is invisible at healthy HP and ramps up as HP drops', () => {
    expect(vignetteOpacity(1, false)).toBe(0);
    expect(vignetteOpacity(0.35, false)).toBe(0); // exactly at the threshold → still off
    const low = vignetteOpacity(0.15, false);
    const lower = vignetteOpacity(0.05, false);
    expect(low).toBeGreaterThan(0);
    expect(lower).toBeGreaterThan(low); // closer to death → stronger
  });

  it('peaks near 0 HP but stays bounded; reduced-effects caps it lower', () => {
    expect(vignetteOpacity(0, false)).toBeCloseTo(0.55, 2);
    expect(vignetteOpacity(0, true)).toBeCloseTo(0.2, 2);
    expect(vignetteOpacity(0.1, true)).toBeLessThan(vignetteOpacity(0.1, false));
  });

  it('clamps out-of-range HP fractions', () => {
    expect(vignetteOpacity(2, false)).toBe(0);
    expect(vignetteOpacity(-0.5, false)).toBeCloseTo(0.55, 2); // treated as 0 HP
  });
});

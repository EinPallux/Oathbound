import { describe, it, expect } from 'vitest';
import { regionAt, regionLabel } from '../../src/sim/content/regions';

describe('regions', () => {
  it('places the world origin in the Oathhold hub (safe haven)', () => {
    const r = regionAt(0, 0);
    expect(r.id).toBe('oathhold');
    expect(regionLabel(r)).toBe('Oathhold · Safe Haven');
  });

  it('places the near-spawn fields in the Greenmarch (Lv 1–5)', () => {
    const r = regionAt(0, 12);
    expect(r.id).toBe('greenmarch');
    expect(regionLabel(r)).toBe('The Greenmarch · Lv 1–5');
  });

  it('places the north-east woods in Thornwood Vale (Lv 6–10)', () => {
    const r = regionAt(30, 30);
    expect(r.id).toBe('thornwood');
    expect(r.minLevel).toBe(6);
    expect(r.maxLevel).toBe(10);
  });

  it('places the south bog in the Sunken Fen (Lv 11–15)', () => {
    const r = regionAt(0, -30);
    expect(r.id).toBe('fen');
    expect(regionLabel(r)).toBe('The Sunken Fen · Lv 11–15');
  });

  it('places the western scorch in the Emberreach (Lv 16–20)', () => {
    const r = regionAt(-30, 0);
    expect(r.id).toBe('ember');
    expect(r.minLevel).toBe(16);
    expect(r.maxLevel).toBe(20);
  });
});

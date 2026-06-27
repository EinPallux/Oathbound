import { describe, it, expect } from 'vitest';
import { regionAt, regionLabel } from '../../src/sim/content/regions';
import { ZONE_THRESHOLD } from '../../src/world/layout';

// The world is large (0.6.0 map expansion): the frontier zones begin at ZONE_THRESHOLD
// in their directions; the Greenmarch heartland fills the area around the hub.
const FAR = ZONE_THRESHOLD + 30; // comfortably inside a frontier zone

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

  it('keeps the wide heartland around the hub in the Greenmarch', () => {
    expect(regionAt(0, 80).id).toBe('greenmarch');
    expect(regionAt(-60, -40).id).toBe('greenmarch');
    expect(regionAt(70, 10).id).toBe('greenmarch');
  });

  it('places the far north-east woods in Thornwood Vale (Lv 6–10)', () => {
    const r = regionAt(FAR, FAR);
    expect(r.id).toBe('thornwood');
    expect(r.minLevel).toBe(6);
    expect(r.maxLevel).toBe(10);
  });

  it('places the far south bog in the Sunken Fen (Lv 11–15)', () => {
    const r = regionAt(0, -FAR);
    expect(r.id).toBe('fen');
    expect(regionLabel(r)).toBe('The Sunken Fen · Lv 11–15');
  });

  it('places the far western scorch in the Emberreach (Lv 16–20)', () => {
    const r = regionAt(-FAR, 0);
    expect(r.id).toBe('ember');
    expect(r.minLevel).toBe(16);
    expect(r.maxLevel).toBe(20);
  });

  it('places the far eastern peaks in the Riven Peaks (Lv 21–25)', () => {
    const r = regionAt(FAR, 0);
    expect(r.id).toBe('riven');
    expect(regionLabel(r)).toBe('The Riven Peaks · Lv 21–25');
  });

  it('places the far northern ruins in Gravereach (Lv 26–30)', () => {
    const r = regionAt(0, FAR);
    expect(r.id).toBe('gravereach');
    expect(r.minLevel).toBe(26);
    expect(r.maxLevel).toBe(30);
  });

  it('keeps Thornwood in the NE corner (does not leak into the east/north zones)', () => {
    expect(regionAt(FAR, FAR).id).toBe('thornwood');
    // Pure east (low z) is Riven, not Thornwood; pure north (low x) is Gravereach.
    expect(regionAt(FAR, 0).id).toBe('riven');
    expect(regionAt(0, FAR).id).toBe('gravereach');
  });
});

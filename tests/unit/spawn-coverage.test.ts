import { describe, it, expect } from 'vitest';
import { WORLD_SPAWNS } from '../../src/sim/content/spawns';
import { regionAt } from '../../src/sim/content/regions';

describe('world spawn coverage (1→30 journey)', () => {
  it('spans the full Lv 1–30 range', () => {
    const levels = WORLD_SPAWNS.map((s) => s.level);
    expect(Math.min(...levels)).toBe(1);
    expect(Math.max(...levels)).toBe(30);
  });

  it('every 5-level band has standard (grindable) spawns — no XP gaps', () => {
    const bands: [number, number][] = [
      [1, 5],
      [6, 10],
      [11, 15],
      [16, 20],
      [21, 25],
      [26, 30],
    ];
    for (const [lo, hi] of bands) {
      const standards = WORLD_SPAWNS.filter(
        (s) => (s.tier ?? 'standard') === 'standard' && s.level >= lo && s.level <= hi,
      );
      expect(standards.length, `band ${lo}-${hi} has standards`).toBeGreaterThan(0);
    }
  });

  it('places spawns in every leveling region', () => {
    const regionIds = new Set(WORLD_SPAWNS.map((s) => regionAt(s.x, s.z).id));
    for (const id of ['greenmarch', 'thornwood', 'fen', 'ember', 'riven', 'gravereach']) {
      expect(regionIds.has(id), `region ${id} populated`).toBe(true);
    }
  });

  it('never spawns an enemy inside the safe hub', () => {
    for (const s of WORLD_SPAWNS) {
      expect(regionAt(s.x, s.z).id, `spawn ${s.id}@(${s.x},${s.z})`).not.toBe('oathhold');
    }
  });
});

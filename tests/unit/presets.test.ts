import { describe, it, expect } from 'vitest';
import { PRESET_ASSETS, presetById } from '../../src/world/presets';

const SHAPES = new Set(['box', 'cylinder', 'cone', 'sphere', 'icosahedron']);
const finite3 = (v: readonly number[]): boolean => v.length === 3 && v.every((n) => Number.isFinite(n));

describe('preset assets', () => {
  it('every preset is structurally valid and has a unique id', () => {
    const ids = new Set<string>();
    for (const d of PRESET_ASSETS) {
      expect(ids.has(d.id), `duplicate id ${d.id}`).toBe(false);
      ids.add(d.id);
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.parts.length).toBeGreaterThan(0);
      for (const p of d.parts) {
        expect(SHAPES.has(p.shape), `${d.id}: bad shape ${p.shape}`).toBe(true);
        expect(Number.isFinite(p.color)).toBe(true);
        expect(finite3(p.dims), `${d.id}: non-finite dims`).toBe(true);
        expect(finite3(p.pos), `${d.id}: non-finite pos`).toBe(true);
        expect(finite3(p.rot), `${d.id}: non-finite rot`).toBe(true);
      }
    }
    expect(ids.size).toBe(PRESET_ASSETS.length); // all ids unique
  });

  it('ships the new medieval city buildings, all placeable structures with colliders', () => {
    const city = [
      'cathedral', 'castle-keep', 'town-hall', 'guildhall', 'city-manor', 'grand-gatehouse',
      'mage-tower', 'barracks', 'city-townhouse', 'bell-tower', 'market-hall', 'citadel-tower',
    ];
    expect(city.length).toBeGreaterThanOrEqual(8); // owner asked for 8–12
    for (const id of city) {
      const d = presetById(id);
      expect(d, `missing preset ${id}`).toBeDefined();
      expect(d!.category).toBe('structure');
      // Each blocks movement: a round collider radius or a rectangular box footprint
      // (the gatehouse is intentionally walk-through, like the existing 'gate').
      const blocks = d!.collider != null || d!.box != null || id === 'grand-gatehouse';
      expect(blocks, `${id} should block or be a gateway`).toBe(true);
      // City buildings are substantial — a good few primitives each.
      expect(d!.parts.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('resolves preset ids and returns undefined for unknown ones', () => {
    expect(presetById('cathedral')!.name).toBe('Cathedral');
    expect(presetById('not-a-real-preset')).toBeUndefined();
  });
});

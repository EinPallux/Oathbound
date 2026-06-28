// Settings tests (0.7.0 CP1): the pure validate/merge + rarity-tag helpers. The DOM /
// localStorage wrappers (loadSettings/saveSettings/applySettings) are covered by the e2e.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  UI_SCALES,
  mergeSettings,
  tierTag,
  type Settings,
} from '../../src/game/settings';
import type { Rarity } from '../../src/core/ecs/components';

describe('settings — merge/validate', () => {
  it('returns defaults for empty / missing / garbage input', () => {
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields and fills the rest from defaults', () => {
    const m = mergeSettings({ damageNumbers: false, reducedEffects: true });
    expect(m.damageNumbers).toBe(false);
    expect(m.reducedEffects).toBe(true);
    expect(m.uiScale).toBe(DEFAULT_SETTINGS.uiScale);
    expect(m.damageNumberSize).toBe(DEFAULT_SETTINGS.damageNumberSize);
  });

  it('clamps uiScale to the supported range and rejects non-finite values', () => {
    const lo = UI_SCALES[0];
    const hi = UI_SCALES[UI_SCALES.length - 1];
    expect(mergeSettings({ uiScale: 5 }).uiScale).toBe(hi);
    expect(mergeSettings({ uiScale: 0.1 }).uiScale).toBe(lo);
    expect(mergeSettings({ uiScale: 1.15 }).uiScale).toBe(1.15);
    expect(mergeSettings({ uiScale: Number.NaN }).uiScale).toBe(DEFAULT_SETTINGS.uiScale);
    expect(mergeSettings({ uiScale: 'big' }).uiScale).toBe(DEFAULT_SETTINGS.uiScale);
  });

  it('rejects invalid enums and ignores unknown keys', () => {
    expect(mergeSettings({ damageNumberSize: 'huge' }).damageNumberSize).toBe('normal');
    expect(mergeSettings({ damageNumberSize: 'large' }).damageNumberSize).toBe('large');
    const m = mergeSettings({ totallyUnknown: 1, highContrastRarity: true }) as Settings & {
      totallyUnknown?: unknown;
    };
    expect(m.highContrastRarity).toBe(true);
    expect(m.totallyUnknown).toBeUndefined();
  });

  it('round-trips a fully-custom settings object through JSON', () => {
    const custom: Settings = {
      uiScale: 1.3,
      damageNumbers: false,
      damageNumberSize: 'small',
      reducedEffects: true,
      highContrastRarity: true,
    };
    expect(mergeSettings(JSON.parse(JSON.stringify(custom)))).toEqual(custom);
  });
});

describe('settings — colorblind-safe rarity tags', () => {
  it('gives every rarity a distinct bracketed tag (a non-colour signal)', () => {
    const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'relic'];
    const tags = rarities.map(tierTag);
    expect(tags).toEqual(['[C]', '[U]', '[R]', '[E]', '[L]', '[★]']);
    expect(new Set(tags).size).toBe(rarities.length); // all distinct
  });
});

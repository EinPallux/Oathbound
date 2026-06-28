// Player settings & accessibility (0.7.0 CP1). Device-local preferences (separate from
// the gameplay save) persisted to localStorage, applied live to the DOM UI overlay via
// CSS variables/classes — so every option "takes effect without restart" per
// docs/design/UX_AND_ACCESSIBILITY.md. The pure bits (merge/validate, rarity tags) are
// unit-tested; the DOM/localStorage wrappers are exercised by the e2e.

import type { Rarity } from '../core/ecs/components';

export type DamageNumberSize = 'small' | 'normal' | 'large';

export interface Settings {
  /** DOM UI zoom (the whole HUD/menus scale together). */
  uiScale: number;
  /** Show floating combat numbers at all. */
  damageNumbers: boolean;
  /** Combat-number text size. */
  damageNumberSize: DamageNumberSize;
  /** Reduced motion + flashing: tones down crit pops, rise, and toast/menu animation. */
  reducedEffects: boolean;
  /** Stronger, color-independent rarity borders (colorblind-safe rarity is always on; */
  /*  this turns the baseline tag/border up to high-contrast). */
  highContrastRarity: boolean;
}

/** Discrete UI-scale steps offered in the panel (continuous values are clamped to range). */
export const UI_SCALES = [0.85, 1, 1.15, 1.3] as const;

export const DEFAULT_SETTINGS: Settings = {
  uiScale: 1,
  damageNumbers: true,
  damageNumberSize: 'normal',
  reducedEffects: false,
  highContrastRarity: false,
};

const STORAGE_KEY = 'oathbound.settings';

/** Colour-independent rarity tag (the non-colour signal — see UX_AND_ACCESSIBILITY). */
export const RARITY_TAG: Record<Rarity, string> = {
  common: 'C',
  uncommon: 'U',
  rare: 'R',
  epic: 'E',
  legendary: 'L',
  relic: '★',
};

/** Bracketed tier tag for a rarity, e.g. "[R]" — shown alongside (never instead of) colour. */
export function tierTag(rarity: Rarity): string {
  return `[${RARITY_TAG[rarity] ?? '?'}]`;
}

function clampScale(n: number): number {
  const lo = UI_SCALES[0];
  const hi = UI_SCALES[UI_SCALES.length - 1];
  return Math.min(hi, Math.max(lo, n));
}

/** Merge unknown/partial/old persisted data over the defaults, validating every field. */
export function mergeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sizeOk = (v: unknown): v is DamageNumberSize => v === 'small' || v === 'normal' || v === 'large';
  return {
    uiScale: typeof r.uiScale === 'number' && Number.isFinite(r.uiScale) ? clampScale(r.uiScale) : DEFAULT_SETTINGS.uiScale,
    damageNumbers: typeof r.damageNumbers === 'boolean' ? r.damageNumbers : DEFAULT_SETTINGS.damageNumbers,
    damageNumberSize: sizeOk(r.damageNumberSize) ? r.damageNumberSize : DEFAULT_SETTINGS.damageNumberSize,
    reducedEffects: typeof r.reducedEffects === 'boolean' ? r.reducedEffects : DEFAULT_SETTINGS.reducedEffects,
    highContrastRarity:
      typeof r.highContrastRarity === 'boolean' ? r.highContrastRarity : DEFAULT_SETTINGS.highContrastRarity,
  };
}

/** Load settings from localStorage (defaults on miss/corruption — never throws). */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return mergeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist settings to localStorage (best-effort). */
export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable → settings simply don't persist this session.
  }
}

/** Apply settings to the DOM UI overlay (CSS var + classes). Idempotent, no restart. */
export function applySettings(uiRoot: HTMLElement, s: Settings): void {
  uiRoot.style.setProperty('--ui-scale', String(s.uiScale));
  uiRoot.classList.toggle('reduced-effects', s.reducedEffects);
  uiRoot.classList.toggle('hc-rarity', s.highContrastRarity);
  uiRoot.classList.toggle('dmg-off', !s.damageNumbers);
  uiRoot.classList.toggle('dmg-small', s.damageNumberSize === 'small');
  uiRoot.classList.toggle('dmg-large', s.damageNumberSize === 'large');
}

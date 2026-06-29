// Keybinds tests (0.7.0 CP4): the pure defaults/merge/label/rebind helpers behind the
// remappable controls. The InputController integration is covered by the e2e.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_KEYBINDS,
  ACTION_ORDER,
  ACTION_LABEL,
  keyLabel,
  mergeKeybinds,
  rebind,
  type Keybinds,
} from '../../src/game/keybinds';

describe('keybinds — defaults & metadata', () => {
  it('every action has a default code, a label, and appears once in the order', () => {
    for (const action of ACTION_ORDER) {
      expect(DEFAULT_KEYBINDS[action], `${action} default`).toBeTruthy();
      expect(ACTION_LABEL[action], `${action} label`).toBeTruthy();
    }
    expect(new Set(ACTION_ORDER).size).toBe(ACTION_ORDER.length); // no dupes
    expect(Object.keys(DEFAULT_KEYBINDS).sort()).toEqual([...ACTION_ORDER].sort());
  });

  it('the default bindings are conflict-free (no two actions share a key)', () => {
    const codes = ACTION_ORDER.map((a) => DEFAULT_KEYBINDS[a]);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('keybinds — key labels', () => {
  it('formats codes into readable labels', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit1')).toBe('1');
    expect(keyLabel('Digit0')).toBe('0');
    expect(keyLabel('ShiftLeft')).toBe('Shift');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('')).toBe('—');
    expect(keyLabel('F13')).toBe('F13'); // unknown → passthrough
  });
});

describe('keybinds — merge & rebind', () => {
  it('merges partial/garbage data over defaults, keeping only string codes', () => {
    expect(mergeKeybinds(null)).toEqual(DEFAULT_KEYBINDS);
    expect(mergeKeybinds('nope')).toEqual(DEFAULT_KEYBINDS);
    const m = mergeKeybinds({ jump: 'KeyJ', inventory: 123, bogus: 'x' });
    expect(m.jump).toBe('KeyJ'); // valid override kept
    expect(m.inventory).toBe(DEFAULT_KEYBINDS.inventory); // non-string ignored
    expect((m as Record<string, unknown>).bogus).toBeUndefined(); // unknown dropped
  });

  it('rebinding a key unbinds any other action that held it (no conflicts)', () => {
    const k: Keybinds = { ...DEFAULT_KEYBINDS };
    // Bind "inventory" to W — which is "forward" by default → forward gets cleared.
    rebind(k, 'inventory', 'KeyW');
    expect(k.inventory).toBe('KeyW');
    expect(k.forward).toBe(''); // the previous owner was unbound
    // No remaining duplicates among bound (non-empty) codes.
    const bound = ACTION_ORDER.map((a) => k[a]).filter((c) => c.length > 0);
    expect(new Set(bound).size).toBe(bound.length);
  });
});

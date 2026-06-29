// Rebindable controls (0.7.0 CP4): a map of game actions → KeyboardEvent.code, with
// sensible defaults, persisted to localStorage (device-local, separate from the save).
// The InputController resolves codes → actions through this map; the Settings panel
// rebinds them. Tab (cycle target) and Esc (clear/close) stay fixed so panels always
// close. See docs/design/UX_AND_ACCESSIBILITY.md (Controls & input) + COMBAT_DESIGN.

export type BindableAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'sprint'
  | 'jump'
  | 'ability1'
  | 'ability2'
  | 'ability3'
  | 'ability4'
  | 'ability5'
  | 'ability6'
  | 'ability7'
  | 'ability8'
  | 'ability9'
  | 'ability10'
  | 'interact'
  | 'inventory'
  | 'character'
  | 'travel'
  | 'map'
  | 'settings'
  | 'pause';

export type Keybinds = Record<BindableAction, string>;

export const DEFAULT_KEYBINDS: Keybinds = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  jump: 'Space',
  ability1: 'Digit1',
  ability2: 'Digit2',
  ability3: 'Digit3',
  ability4: 'Digit4',
  ability5: 'Digit5',
  ability6: 'Digit6',
  ability7: 'Digit7',
  ability8: 'Digit8',
  ability9: 'Digit9',
  ability10: 'Digit0',
  interact: 'KeyF',
  inventory: 'KeyI',
  character: 'KeyC',
  travel: 'KeyT',
  map: 'KeyM',
  settings: 'KeyO',
  pause: 'KeyP',
};

/** Display label + grouping order for the Controls UI. */
export const ACTION_LABEL: Record<BindableAction, string> = {
  forward: 'Move forward',
  back: 'Move back',
  left: 'Strafe left',
  right: 'Strafe right',
  sprint: 'Sprint',
  jump: 'Jump',
  ability1: 'Ability 1',
  ability2: 'Ability 2',
  ability3: 'Ability 3',
  ability4: 'Ability 4',
  ability5: 'Ability 5',
  ability6: 'Ability 6',
  ability7: 'Ability 7',
  ability8: 'Ability 8',
  ability9: 'Ability 9',
  ability10: 'Ability 10',
  interact: 'Interact / pick up',
  inventory: 'Inventory',
  character: 'Character',
  travel: 'Fast travel',
  map: 'Map',
  settings: 'Settings',
  pause: 'Pause',
};

export const ACTION_ORDER: BindableAction[] = [
  'forward', 'back', 'left', 'right', 'sprint', 'jump',
  'ability1', 'ability2', 'ability3', 'ability4', 'ability5',
  'ability6', 'ability7', 'ability8', 'ability9', 'ability10',
  'interact', 'inventory', 'character', 'travel', 'map', 'settings', 'pause',
];

const STORAGE_KEY = 'oathbound.keybinds';

/** Human-readable label for a KeyboardEvent.code (e.g. "KeyW" → "W", "Space" → "Space"). */
export function keyLabel(code: string): string {
  if (!code) return '—';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
  const special: Record<string, string> = {
    ShiftLeft: 'Shift',
    ShiftRight: 'R-Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'R-Ctrl',
    AltLeft: 'Alt',
    AltRight: 'R-Alt',
    Space: 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: 'Enter',
    Backquote: '`',
  };
  return special[code] ?? code;
}

/** Merge persisted/partial data over the defaults, keeping only string codes. */
export function mergeKeybinds(raw: unknown): Keybinds {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_KEYBINDS };
  for (const action of ACTION_ORDER) {
    const v = r[action];
    if (typeof v === 'string' && v.length > 0) out[action] = v;
  }
  return out;
}

export function loadKeybinds(): Keybinds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return mergeKeybinds(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_KEYBINDS };
  }
}

export function saveKeybinds(k: Keybinds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(k));
  } catch {
    // localStorage unavailable → bindings simply don't persist this session.
  }
}

/**
 * Assign `code` to `action`, clearing it from any other action that held it (so two
 * actions never share a key). Mutates + returns the map.
 */
export function rebind(k: Keybinds, action: BindableAction, code: string): Keybinds {
  for (const a of ACTION_ORDER) {
    if (a !== action && k[a] === code) k[a] = ''; // unbind the conflicting action
  }
  k[action] = code;
  return k;
}

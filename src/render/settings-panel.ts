// Settings panel (DOM, interactive — toggled with O). Edits the live Settings object in
// place and calls onChange after every change so the bootstrap can persist + re-apply
// immediately (no restart). Accessibility-first: every control is a labelled native
// input. See docs/design/UX_AND_ACCESSIBILITY.md (Settings + accessibility commit list).

import { type Settings, type DamageNumberSize, UI_SCALES, DEFAULT_SETTINGS } from '../game/settings';
import {
  type Keybinds,
  type BindableAction,
  ACTION_ORDER,
  ACTION_LABEL,
  DEFAULT_KEYBINDS,
  keyLabel,
  rebind,
} from '../game/keybinds';

export class SettingsPanel {
  private readonly root: HTMLDivElement;
  private visible = false;
  private uiScale!: HTMLSelectElement;
  private dmgOn!: HTMLInputElement;
  private dmgSize!: HTMLSelectElement;
  private reduced!: HTMLInputElement;
  private hcRarity!: HTMLInputElement;
  private confirmDestructive!: HTMLInputElement;
  private mute!: HTMLInputElement;
  private volume!: HTMLInputElement;
  private sensitivity!: HTMLInputElement;
  private invertY!: HTMLInputElement;
  private keybindsList!: HTMLDivElement;
  private captureHandler: ((e: KeyboardEvent) => void) | null = null;

  /** Called after any settings change (persist + apply). */
  onChange: () => void = () => {};
  /** Called after a keybind change (persist + apply to input). */
  onKeybindsChange: () => void = () => {};

  constructor(parent: HTMLElement, private readonly settings: Settings, private readonly keybinds: Keybinds) {
    this.root = document.createElement('div');
    this.root.className = 'settings-panel';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'inv-title';
    title.textContent = 'Settings — Esc / O to close';
    this.root.appendChild(title);

    const groups = document.createElement('div');
    groups.className = 'settings-groups';
    this.root.appendChild(groups);

    groups.appendChild(this.sectionHead('Display'));
    this.uiScale = this.selectRow(
      groups,
      'UI scale',
      UI_SCALES.map((s) => ({ value: String(s), label: `${Math.round(s * 100)}%` })),
      () => {
        this.settings.uiScale = parseFloat(this.uiScale.value);
        this.onChange();
      },
    );

    groups.appendChild(this.sectionHead('Combat text'));
    this.dmgOn = this.checkRow(groups, 'Show damage numbers', () => {
      this.settings.damageNumbers = this.dmgOn.checked;
      this.onChange();
    });
    this.dmgSize = this.selectRow(
      groups,
      'Damage-number size',
      [
        { value: 'small', label: 'Small' },
        { value: 'normal', label: 'Normal' },
        { value: 'large', label: 'Large' },
      ],
      () => {
        this.settings.damageNumberSize = this.dmgSize.value as DamageNumberSize;
        this.onChange();
      },
    );

    groups.appendChild(this.sectionHead('Accessibility'));
    this.reduced = this.checkRow(groups, 'Reduced effects (motion & flashing)', () => {
      this.settings.reducedEffects = this.reduced.checked;
      this.onChange();
    });
    this.hcRarity = this.checkRow(groups, 'High-contrast rarity', () => {
      this.settings.highContrastRarity = this.hcRarity.checked;
      this.onChange();
    });
    this.confirmDestructive = this.checkRow(groups, 'Confirm destructive actions', () => {
      this.settings.confirmDestructive = this.confirmDestructive.checked;
      this.onChange();
    });

    groups.appendChild(this.sectionHead('Audio'));
    this.mute = this.checkRow(groups, 'Mute audio', () => {
      this.settings.muteAudio = this.mute.checked;
      this.onChange();
    });
    this.volume = this.rangeRow(groups, 'Volume', () => {
      this.settings.masterVolume = parseInt(this.volume.value, 10) / 100;
      this.onChange();
    });

    groups.appendChild(this.sectionHead('Controls'));
    this.sensitivity = this.rangeRow(groups, 'Mouse sensitivity', () => {
      this.settings.mouseSensitivity = parseInt(this.sensitivity.value, 10) / 100;
      this.onChange();
    });
    this.sensitivity.min = '50';
    this.sensitivity.max = '200';
    this.sensitivity.step = '10';
    this.invertY = this.checkRow(groups, 'Invert mouse Y', () => {
      this.settings.invertY = this.invertY.checked;
      this.onChange();
    });
    const kbHint = document.createElement('div');
    kbHint.className = 'inv-hint';
    kbHint.textContent = 'Click a key to rebind (Tab / Esc are fixed).';
    groups.appendChild(kbHint);
    this.keybindsList = document.createElement('div');
    this.keybindsList.className = 'keybinds-list';
    groups.appendChild(this.keybindsList);

    const actions = document.createElement('div');
    actions.className = 'inv-actions';
    const reset = document.createElement('button');
    reset.className = 'inv-btn';
    reset.textContent = 'Reset to defaults';
    reset.onclick = () => {
      Object.assign(this.settings, DEFAULT_SETTINGS);
      Object.assign(this.keybinds, DEFAULT_KEYBINDS);
      this.syncControls();
      this.onChange();
      this.onKeybindsChange();
    };
    const close = document.createElement('button');
    close.className = 'inv-btn';
    close.textContent = 'Close';
    close.onclick = () => this.close();
    actions.append(reset, close);
    this.root.appendChild(actions);

    parent.appendChild(this.root);
    this.syncControls();
  }

  private sectionHead(text: string): HTMLDivElement {
    const h = document.createElement('div');
    h.className = 'inv-col-head';
    h.textContent = text;
    return h;
  }

  private checkRow(parent: HTMLElement, label: string, onInput: () => void): HTMLInputElement {
    const row = document.createElement('label');
    row.className = 'settings-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.onchange = onInput;
    const span = document.createElement('span');
    span.textContent = label;
    row.append(input, span);
    parent.appendChild(row);
    return input;
  }

  private selectRow(
    parent: HTMLElement,
    label: string,
    options: { value: string; label: string }[],
    onInput: () => void,
  ): HTMLSelectElement {
    const row = document.createElement('label');
    row.className = 'settings-row';
    const span = document.createElement('span');
    span.textContent = label;
    const select = document.createElement('select');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      select.appendChild(opt);
    }
    select.onchange = onInput;
    row.append(span, select);
    parent.appendChild(row);
    return select;
  }

  private rangeRow(parent: HTMLElement, label: string, onInput: () => void): HTMLInputElement {
    const row = document.createElement('label');
    row.className = 'settings-row';
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '5';
    input.oninput = onInput;
    row.append(span, input);
    parent.appendChild(row);
    return input;
  }

  /** Rebuild the rebindable-key list (label + current key button). */
  private renderKeybinds(): void {
    this.keybindsList.replaceChildren();
    for (const action of ACTION_ORDER) {
      const row = document.createElement('div');
      row.className = 'keybind-row';
      const label = document.createElement('span');
      label.className = 'keybind-label';
      label.textContent = ACTION_LABEL[action];
      const key = document.createElement('button');
      key.className = 'keybind-key';
      key.textContent = keyLabel(this.keybinds[action]);
      key.onclick = () => this.startCapture(action, key);
      row.append(label, key);
      this.keybindsList.appendChild(row);
    }
  }

  /** Capture the next keypress and bind it to `action` (Esc cancels). */
  private startCapture(action: BindableAction, button: HTMLButtonElement): void {
    this.cancelCapture();
    button.textContent = 'Press a key…';
    button.classList.add('capturing');
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation(); // swallow it before the game input handler sees it
      this.cancelCapture();
      if (e.code !== 'Escape') {
        rebind(this.keybinds, action, e.code);
        this.onKeybindsChange();
      }
      this.renderKeybinds();
    };
    this.captureHandler = handler;
    window.addEventListener('keydown', handler, true); // capture phase, before InputController
  }

  private cancelCapture(): void {
    if (this.captureHandler) {
      window.removeEventListener('keydown', this.captureHandler, true);
      this.captureHandler = null;
    }
  }

  /** Push the current settings values into the controls (open / after reset). */
  private syncControls(): void {
    this.uiScale.value = String(this.settings.uiScale);
    this.dmgOn.checked = this.settings.damageNumbers;
    this.dmgSize.value = this.settings.damageNumberSize;
    this.reduced.checked = this.settings.reducedEffects;
    this.hcRarity.checked = this.settings.highContrastRarity;
    this.confirmDestructive.checked = this.settings.confirmDestructive;
    this.mute.checked = this.settings.muteAudio;
    this.volume.value = String(Math.round(this.settings.masterVolume * 100));
    this.sensitivity.value = String(Math.round(this.settings.mouseSensitivity * 100));
    this.invertY.checked = this.settings.invertY;
    this.renderKeybinds();
  }

  toggle(): void {
    this.visible ? this.close() : this.open();
  }
  open(): void {
    this.syncControls();
    this.visible = true;
    this.root.style.display = 'block';
  }
  close(): void {
    this.cancelCapture();
    this.visible = false;
    this.root.style.display = 'none';
  }
  get isOpen(): boolean {
    return this.visible;
  }
}

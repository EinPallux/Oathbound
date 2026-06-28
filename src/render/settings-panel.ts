// Settings panel (DOM, interactive — toggled with O). Edits the live Settings object in
// place and calls onChange after every change so the bootstrap can persist + re-apply
// immediately (no restart). Accessibility-first: every control is a labelled native
// input. See docs/design/UX_AND_ACCESSIBILITY.md (Settings + accessibility commit list).

import { type Settings, type DamageNumberSize, UI_SCALES, DEFAULT_SETTINGS } from '../game/settings';

export class SettingsPanel {
  private readonly root: HTMLDivElement;
  private visible = false;
  private uiScale!: HTMLSelectElement;
  private dmgOn!: HTMLInputElement;
  private dmgSize!: HTMLSelectElement;
  private reduced!: HTMLInputElement;
  private hcRarity!: HTMLInputElement;
  private confirmDestructive!: HTMLInputElement;

  /** Called after any change (persist + apply). */
  onChange: () => void = () => {};

  constructor(parent: HTMLElement, private readonly settings: Settings) {
    this.root = document.createElement('div');
    this.root.className = 'settings-panel';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'inv-title';
    title.textContent = 'Settings — O to close';
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

    const actions = document.createElement('div');
    actions.className = 'inv-actions';
    const reset = document.createElement('button');
    reset.className = 'inv-btn';
    reset.textContent = 'Reset to defaults';
    reset.onclick = () => {
      Object.assign(this.settings, DEFAULT_SETTINGS);
      this.syncControls();
      this.onChange();
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

  /** Push the current settings values into the controls (open / after reset). */
  private syncControls(): void {
    this.uiScale.value = String(this.settings.uiScale);
    this.dmgOn.checked = this.settings.damageNumbers;
    this.dmgSize.value = this.settings.damageNumberSize;
    this.reduced.checked = this.settings.reducedEffects;
    this.hcRarity.checked = this.settings.highContrastRarity;
    this.confirmDestructive.checked = this.settings.confirmDestructive;
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
    this.visible = false;
    this.root.style.display = 'none';
  }
  get isOpen(): boolean {
    return this.visible;
  }
}

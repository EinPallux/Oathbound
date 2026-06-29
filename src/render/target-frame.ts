// The current-target unit-frame (top-centre, right of the player frame, mirrored to
// face it): the locked target's name (con-coloured), level, an HP bar, and a portrait.
// Classic tab-target assist UI. DOM overlay per ADR-002.

import type { ConColor } from '../sim/stats';

const CON_HEX: Record<ConColor, string> = {
  gray: '#8a8f98',
  green: '#7be08a',
  white: '#e8eef5',
  yellow: '#e8d44d',
  orange: '#ff9a4a',
  red: '#ff5b5b',
};

export class TargetFrame {
  private readonly el: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly levelEl: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly hpText: HTMLDivElement;
  private readonly portrait: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'unit-frame target';
    this.el.style.display = 'none';

    const body = document.createElement('div');
    body.className = 'unit-body';

    this.nameEl = document.createElement('div');
    this.nameEl.className = 'unit-name';

    const bar = document.createElement('div');
    bar.className = 'bar hp target';
    this.fill = document.createElement('div');
    this.fill.className = 'bar-fill';
    this.hpText = document.createElement('div');
    this.hpText.className = 'bar-text';
    bar.append(this.fill, this.hpText);

    this.levelEl = document.createElement('div');
    this.levelEl.className = 'unit-level';

    body.append(this.nameEl, bar, this.levelEl);

    this.portrait = document.createElement('div');
    this.portrait.className = 'unit-portrait enemy';
    this.portrait.textContent = '💀'; // color emoji — renders reliably across fonts

    // Body first, portrait second → portrait sits on the outer (right) edge, mirroring
    // the player frame so the two frames face each other across the centre.
    this.el.append(body, this.portrait);
    parent.appendChild(this.el);
  }

  set(name: string, level: number, current: number, max: number, con: ConColor = 'white'): void {
    this.el.style.display = 'flex';
    this.nameEl.textContent = name;
    this.nameEl.style.color = CON_HEX[con];
    this.levelEl.textContent = `Lv ${level}`;
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.fill.style.width = `${ratio * 100}%`;
    this.hpText.textContent = `${Math.ceil(current)}/${max}`;
  }

  clear(): void {
    this.el.style.display = 'none';
  }
}

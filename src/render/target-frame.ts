// The current-target frame: a small fixed panel showing the locked target's name,
// level, and HP. Classic tab-target assist UI; no per-frame projection needed.
// DOM UI overlay per ADR-002.

export class TargetFrame {
  private readonly el: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly hpText: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'target-frame';
    this.el.style.display = 'none';

    this.nameEl = document.createElement('div');
    this.nameEl.className = 'target-name';

    const bar = document.createElement('div');
    bar.className = 'target-hp';
    this.fill = document.createElement('div');
    this.fill.className = 'target-hp-fill';
    this.hpText = document.createElement('div');
    this.hpText.className = 'target-hp-text';
    bar.append(this.fill, this.hpText);

    this.el.append(this.nameEl, bar);
    parent.appendChild(this.el);
  }

  set(name: string, level: number, current: number, max: number): void {
    this.el.style.display = 'block';
    this.nameEl.textContent = `${name}  ·  Lv ${level}`;
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.fill.style.width = `${ratio * 100}%`;
    this.hpText.textContent = `${Math.ceil(current)} / ${max}`;
  }

  clear(): void {
    this.el.style.display = 'none';
  }
}

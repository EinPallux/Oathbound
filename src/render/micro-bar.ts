// Micro-bar (bottom-right): a compact row of icon buttons for quick mouse access to the
// game's panels — the same destinations as the hotkeys, for players who'd rather click.
// Pure UI; actions are wired to callbacks by the bootstrap. DOM overlay per ADR-002.

function iconBtn(parent: HTMLElement, glyph: string, title: string, onClick: () => void): void {
  const b = document.createElement('button');
  b.className = 'micro-btn';
  b.textContent = glyph;
  b.title = title;
  b.onclick = onClick;
  parent.appendChild(b);
}

export class MicroBar {
  onInventory: () => void = () => {};
  onCharacter: () => void = () => {};
  onTravel: () => void = () => {};
  onMap: () => void = () => {};
  onSettings: () => void = () => {};
  onFullscreen: () => void = () => {};
  onLogout: () => void = () => {};

  constructor(parent: HTMLElement) {
    const bar = document.createElement('div');
    bar.className = 'micro-bar';
    iconBtn(bar, '🎒', 'Inventory (B)', () => this.onInventory());
    iconBtn(bar, '👤', 'Character (C)', () => this.onCharacter());
    iconBtn(bar, '🧭', 'Fast travel (T)', () => this.onTravel());
    iconBtn(bar, '🗺', 'Map (M)', () => this.onMap());
    iconBtn(bar, '⚙', 'Settings (Esc)', () => this.onSettings());
    iconBtn(bar, '⛶', 'Toggle fullscreen', () => this.onFullscreen());
    iconBtn(bar, '🚪', 'Character select / Log out', () => this.onLogout());
    parent.appendChild(bar);
  }
}

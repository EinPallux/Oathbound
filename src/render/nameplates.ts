// Floating nameplates (name + slim HP bar) over entities, projected from world space to the
// screen each frame. Used by the online client to label other players + enemies. A pooled set of
// DOM nodes keeps it cheap; entries beyond the pool are dropped (nearest-first ordering upstream).

import * as THREE from 'three';

export interface NameplateEntry {
  x: number;
  y: number; // head height in world space
  z: number;
  name: string;
  hp: number;
  mhp: number;
  /** 'player' | 'enemy' | 'boss' — tints the name. */
  kind: string;
}

const KIND_COLOR: Record<string, string> = { player: '#8fd0ff', enemy: '#ff9a8a', boss: '#ff6b6b' };

interface Plate {
  root: HTMLDivElement;
  nameEl: HTMLDivElement;
  bar: HTMLDivElement;
  fill: HTMLDivElement;
}

export class Nameplates {
  private readonly container: HTMLDivElement;
  private readonly pool: Plate[] = [];
  private readonly project = new THREE.Vector3();

  constructor(parent: HTMLElement, private readonly max = 40) {
    this.container = document.createElement('div');
    this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:7;overflow:hidden';
    parent.appendChild(this.container);
  }

  private plate(i: number): Plate {
    let p = this.pool[i];
    if (p) return p;
    const root = document.createElement('div');
    root.style.cssText =
      'position:absolute;transform:translate(-50%,-100%);display:none;text-align:center;' +
      'font:600 12px/1.2 system-ui,sans-serif;text-shadow:0 1px 2px #000;white-space:nowrap';
    const nameEl = document.createElement('div');
    const bar = document.createElement('div');
    bar.style.cssText =
      'width:56px;height:4px;margin:1px auto 0;border-radius:2px;background:rgba(0,0,0,.6);overflow:hidden';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:100%;background:#e5484d';
    bar.appendChild(fill);
    root.append(nameEl, bar);
    this.container.appendChild(root);
    p = { root, nameEl, bar, fill };
    this.pool[i] = p;
    return p;
  }

  /** Position/refresh nameplates for the given entries (already filtered to what should show). */
  render(camera: THREE.Camera, width: number, height: number, entries: NameplateEntry[]): void {
    const n = Math.min(entries.length, this.max);
    for (let i = 0; i < n; i++) {
      const e = entries[i];
      this.project.set(e.x, e.y, e.z).project(camera);
      const p = this.plate(i);
      // Behind the camera (z > 1) or off-screen → hide.
      if (this.project.z > 1 || this.project.x < -1.2 || this.project.x > 1.2 || this.project.y < -1.2 || this.project.y > 1.2) {
        p.root.style.display = 'none';
        continue;
      }
      const sx = (this.project.x * 0.5 + 0.5) * width;
      const sy = (-this.project.y * 0.5 + 0.5) * height;
      p.root.style.display = 'block';
      p.root.style.left = `${sx}px`;
      p.root.style.top = `${sy}px`;
      p.nameEl.textContent = e.name;
      p.nameEl.style.color = KIND_COLOR[e.kind] ?? '#e8eef6';
      const frac = e.mhp > 0 ? Math.max(0, Math.min(1, e.hp / e.mhp)) : 0;
      p.fill.style.width = `${frac * 100}%`;
      p.bar.style.display = e.kind === 'player' || e.mhp > 0 ? 'block' : 'none';
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].root.style.display = 'none';
  }

  dispose(): void {
    this.container.remove();
  }
}

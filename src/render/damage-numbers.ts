// Floating combat text. A fixed pool of DOM spans (no per-hit allocation) anchored to
// a world position, projected to screen each frame, rising and fading out. Crits are
// emphasised. Pooling matters: combat can spawn many numbers per second.
// DOM UI overlay per ADR-002.

import * as THREE from 'three';
import type { Settings } from '../game/settings';

interface FloatingNumber {
  el: HTMLDivElement;
  x: number;
  y: number;
  z: number;
  life: number;
  ttl: number;
}

const TTL = 0.9; // seconds on screen
const CRIT_TTL = 1.2;
const RISE = 1.4; // world units risen over its life

export class DamageNumbers {
  private readonly container: HTMLDivElement;
  private readonly pool: HTMLDivElement[] = [];
  private readonly active: FloatingNumber[] = [];
  private readonly anchor = new THREE.Vector3();
  private lastMs = performance.now();

  constructor(parent: HTMLElement, private readonly settings?: Settings, poolSize = 32) {
    this.container = document.createElement('div');
    this.container.className = 'dmg-layer';
    parent.appendChild(this.container);
    for (let i = 0; i < poolSize; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-number';
      el.style.display = 'none';
      this.container.appendChild(el);
      this.pool.push(el);
    }
  }

  /** Spawn a number at a world position. Reuses a pooled span (drops if all busy). */
  spawn(x: number, y: number, z: number, amount: number, isCrit: boolean, heal = false): void {
    if (this.settings && !this.settings.damageNumbers) return; // disabled in settings
    const el = this.pool.pop();
    if (!el) return; // pool exhausted — drop rather than allocate
    // Reduced-effects tones the crit emphasis down to a normal number (colour kept).
    const critEmphasis = isCrit && !(this.settings?.reducedEffects ?? false);
    el.textContent = heal ? `+${amount}` : isCrit ? `${amount}!` : String(amount);
    el.className = heal ? 'dmg-number heal' : critEmphasis ? 'dmg-number crit' : 'dmg-number';
    el.style.display = 'block';
    el.style.opacity = '1';
    this.active.push({ el, x, y, z, life: 0, ttl: isCrit ? CRIT_TTL : TTL });
  }

  update(camera: THREE.Camera, width: number, height: number): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastMs) / 1000);
    this.lastMs = now;

    const rise = this.settings?.reducedEffects ? RISE * 0.3 : RISE; // reduced motion
    for (let i = this.active.length - 1; i >= 0; i--) {
      const n = this.active[i];
      n.life += dt;
      const k = n.life / n.ttl;
      if (k >= 1) {
        n.el.style.display = 'none';
        this.pool.push(n.el);
        this.active.splice(i, 1);
        continue;
      }
      this.anchor.set(n.x, n.y + rise * k, n.z).project(camera);
      if (this.anchor.z > 1) {
        n.el.style.display = 'none';
        continue; // behind the camera this frame
      }
      n.el.style.display = 'block';
      const sx = (this.anchor.x * 0.5 + 0.5) * width;
      const sy = (-this.anchor.y * 0.5 + 0.5) * height;
      n.el.style.transform = `translate(-50%, -50%) translate(${sx}px, ${sy}px)`;
      n.el.style.opacity = String(1 - k * k);
    }
  }
}

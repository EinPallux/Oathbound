// Minimap (always-on, player-centred) + a large world map toggled with M. Plain 2D
// canvas, redrawn from the world each frame: terrain-region tint, Oathstones (bright
// cyan once attuned, dim otherwise), the vendor, live enemies, and a player arrow.
// Reads sim state; never mutates it. Map v1 per docs/design/UX_AND_ACCESSIBILITY.md.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Transform,
  type Oathstone,
  type Health,
  type EnemyInfo,
} from '../core/ecs/components';
import { regionAt, regionLabel } from '../sim/content/regions';

const MINI_SIZE = 150;
/** Half-extent (m) shown around the player on the minimap. */
const MINI_RANGE = 45;

type Project = (wx: number, wz: number) => [number, number];

export class Minimap {
  private readonly mini: HTMLCanvasElement;
  private readonly miniCtx: CanvasRenderingContext2D;
  private readonly label: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly map: HTMLCanvasElement;
  private readonly mapCtx: CanvasRenderingContext2D;
  private bigOpen = false;

  constructor(parent: HTMLElement, private readonly worldSize: number) {
    const wrap = document.createElement('div');
    wrap.className = 'minimap-wrap';
    this.mini = document.createElement('canvas');
    this.mini.className = 'minimap';
    this.mini.width = MINI_SIZE;
    this.mini.height = MINI_SIZE;
    this.miniCtx = this.mini.getContext('2d')!;
    this.label = document.createElement('div');
    this.label.className = 'minimap-label';
    wrap.append(this.mini, this.label);
    parent.appendChild(wrap);

    this.overlay = document.createElement('div');
    this.overlay.className = 'map-overlay';
    this.overlay.style.display = 'none';
    const panel = document.createElement('div');
    panel.className = 'map-panel';
    const title = document.createElement('div');
    title.className = 'inv-title';
    title.textContent = 'Map — M or Esc to close';
    this.map = document.createElement('canvas');
    this.map.className = 'map-canvas';
    this.map.width = 520;
    this.map.height = 520;
    this.mapCtx = this.map.getContext('2d')!;
    panel.append(title, this.map);
    this.overlay.appendChild(panel);
    parent.appendChild(this.overlay);
  }

  toggleMap(): void {
    this.bigOpen = !this.bigOpen;
    this.overlay.style.display = this.bigOpen ? 'flex' : 'none';
  }
  closeMap(): void {
    this.bigOpen = false;
    this.overlay.style.display = 'none';
  }
  get isMapOpen(): boolean {
    return this.bigOpen;
  }

  update(world: World, player: Entity): void {
    const tr = world.get<Transform>(player, C.Transform);
    if (!tr) return;
    this.label.textContent = regionLabel(regionAt(tr.x, tr.z));
    this.draw(this.miniCtx, MINI_SIZE, world, tr, true);
    if (this.bigOpen) this.draw(this.mapCtx, this.map.width, world, tr, false);
  }

  private draw(
    ctx: CanvasRenderingContext2D,
    size: number,
    world: World,
    ptr: Transform,
    centered: boolean,
  ): void {
    let project: Project;
    if (centered) {
      const scale = size / (2 * MINI_RANGE);
      project = (wx, wz) => [size / 2 + (wx - ptr.x) * scale, size / 2 - (wz - ptr.z) * scale];
    } else {
      const half = this.worldSize / 2;
      const scale = size / this.worldSize;
      project = (wx, wz) => [(wx + half) * scale, size - (wz + half) * scale];
    }

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = centered ? '#10160f' : '#0c1014';
    ctx.fillRect(0, 0, size, size);

    const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x <= size && y <= size;
    const dot = (x: number, y: number, r: number, color: string): void => {
      if (!inBounds(x, y)) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    // Live enemies (red).
    for (const e of world.query(C.Enemy, C.Health, C.Transform)) {
      const h = world.get<Health>(e, C.Health)!;
      if (h.current <= 0) continue;
      const t = world.get<Transform>(e, C.Transform)!;
      const [x, y] = project(t.x, t.z);
      dot(x, y, centered ? 2 : 3, '#e0584c');
    }

    // Vendor (gold square).
    for (const e of world.query(C.Vendor, C.Transform)) {
      const t = world.get<Transform>(e, C.Transform)!;
      const [x, y] = project(t.x, t.z);
      if (!inBounds(x, y)) continue;
      ctx.fillStyle = '#e0b44c';
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }

    // Oathstones (attuned bright cyan, dormant dim).
    for (const e of world.query(C.Oathstone, C.Transform)) {
      const os = world.get<Oathstone>(e, C.Oathstone)!;
      const t = world.get<Transform>(e, C.Transform)!;
      const [x, y] = project(t.x, t.z);
      dot(x, y, centered ? 3 : 5, os.activated ? '#49d6e0' : '#3a4a5a');
      if (!centered && inBounds(x, y)) {
        ctx.fillStyle = os.activated ? '#bfeef2' : '#6a7a8a';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(os.name, x + 8, y + 4);
      }
    }

    // World bosses — a distinct crimson diamond (+ name on the big map) so the endgame
    // targets are easy to locate. Hidden while slain (respawning).
    for (const e of world.query(C.Boss, C.Transform, C.Health)) {
      const h = world.get<Health>(e, C.Health)!;
      if (h.current <= 0) continue;
      const t = world.get<Transform>(e, C.Transform)!;
      const [x, y] = project(t.x, t.z);
      if (!inBounds(x, y)) continue;
      const r = centered ? 4 : 7;
      ctx.fillStyle = '#ff3b46';
      ctx.strokeStyle = '#ffd0d3';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!centered) {
        const info = world.get<EnemyInfo>(e, C.EnemyInfo);
        ctx.fillStyle = '#ffd0d3';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(info?.name ?? 'World Boss', x + 9, y + 4);
      }
    }

    // Player arrow (facing forward = (sin yaw, cos yaw) in world; +z is up here).
    const [px, py] = project(ptr.x, ptr.z);
    const dx = Math.sin(ptr.yaw);
    const dy = -Math.cos(ptr.yaw);
    const perpX = -dy;
    const perpY = dx;
    const tip = 8;
    const back = 5;
    const wide = 4;
    ctx.fillStyle = '#eef3f8';
    ctx.beginPath();
    ctx.moveTo(px + dx * tip, py + dy * tip);
    ctx.lineTo(px - dx * back + perpX * wide, py - dy * back + perpY * wide);
    ctx.lineTo(px - dx * back - perpX * wide, py - dy * back - perpY * wide);
    ctx.closePath();
    ctx.fill();
  }
}

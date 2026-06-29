// Minimap (always-on, player-centred) + a large world map toggled with M. Both draw a
// pre-rendered shaded-relief image of the world — biome-tinted terrain with hillshading,
// lakes, rivers and roads — then overlay live markers (enemies, Oathstones, vendor,
// world bosses, the player arrow). The relief is built once from the pure world data
// (heightfield + biomes + lakes + scenery paths) and reused every frame. Reads sim state;
// never mutates it. Map v1 per docs/design/UX_AND_ACCESSIBILITY.md.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Transform,
  type Oathstone,
  type Health,
  type EnemyInfo,
} from '../core/ecs/components';
import { regionAt, regionLabel } from '../sim/content/regions';
import type { Heightfield } from '../world/heightfield';
import { dominantBiome, type BiomeId } from '../world/biomes';
import { inLakeWater } from '../world/lakes';
import type { Scenery, SceneryPath } from '../world/scenery';

const MINI_SIZE = 150;
/** Half-extent (m) shown around the player on the minimap. */
const MINI_RANGE = 48;
/** Relief texture resolution (built once, off the boot path). */
const REL = 352;

type Project = (wx: number, wz: number) => [number, number];

// Top-down biome palette (legible, lightly saturated). Riven blends to snow by height.
const BIOME_RGB: Record<BiomeId, [number, number, number]> = {
  hub: [150, 132, 92],
  greenmarch: [96, 126, 66],
  thornwood: [62, 94, 52],
  fen: [74, 88, 64],
  ember: [124, 72, 54],
  riven: [150, 160, 176],
  gravereach: [90, 84, 106],
};
const SNOW: [number, number, number] = [232, 238, 246];
const WATER: [number, number, number] = [58, 120, 160];
const ROAD = '#b59a63';
const RIVER = '#4d97c4';

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

export class Minimap {
  private readonly mini: HTMLCanvasElement;
  private readonly miniCtx: CanvasRenderingContext2D;
  private readonly label: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly map: HTMLCanvasElement;
  private readonly mapCtx: CanvasRenderingContext2D;
  /** Pre-rendered terrain relief — built lazily during idle time so boot isn't blocked. */
  private relief: HTMLCanvasElement | null = null;
  private bigOpen = false;

  constructor(
    parent: HTMLElement,
    private readonly worldSize: number,
    field: Heightfield,
    scenery: Scenery,
  ) {
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

    // Build the relief off the boot critical path (it samples the whole world once). Until
    // it's ready the maps show their background + live markers, which fills in moments later.
    const build = (): void => {
      this.relief = this.buildRelief(field, scenery);
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: object) => void })
      .requestIdleCallback;
    if (typeof ric === 'function') ric(build, { timeout: 1500 });
    else window.setTimeout(build, 200);
  }

  /** Pre-render the static shaded-relief terrain image (one-time). */
  private buildRelief(field: Heightfield, scenery: Scenery): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = REL;
    const ctx = canvas.getContext('2d')!;
    const half = this.worldSize / 2;
    const step = this.worldSize / REL;

    // Sample the heightfield onto the relief grid first (for hillshade gradients).
    const hgt = new Float32Array(REL * REL);
    for (let j = 0; j < REL; j++) {
      for (let i = 0; i < REL; i++) {
        const wx = -half + (i + 0.5) * step;
        const wz = half - (j + 0.5) * step;
        hgt[j * REL + i] = field.sample(wx, wz);
      }
    }

    const img = ctx.createImageData(REL, REL);
    const d = img.data;
    for (let j = 0; j < REL; j++) {
      for (let i = 0; i < REL; i++) {
        const idx = j * REL + i;
        const wx = -half + (i + 0.5) * step;
        const wz = half - (j + 0.5) * step;
        const h = hgt[idx];
        let r: number, g: number, b: number;
        let shade = 1;
        if (inLakeWater(wx, wz, 0)) {
          [r, g, b] = WATER;
        } else {
          const biome = dominantBiome(wx, wz);
          if (biome === 'riven') {
            const t = Math.max(0, Math.min(1, (h - 24) / 22));
            r = BIOME_RGB.riven[0] + (SNOW[0] - BIOME_RGB.riven[0]) * t;
            g = BIOME_RGB.riven[1] + (SNOW[1] - BIOME_RGB.riven[1]) * t;
            b = BIOME_RGB.riven[2] + (SNOW[2] - BIOME_RGB.riven[2]) * t;
          } else {
            [r, g, b] = BIOME_RGB[biome];
          }
          // Hillshade from the height gradient (light from the north-west).
          const il = i > 0 ? i - 1 : i;
          const ir = i < REL - 1 ? i + 1 : i;
          const ju = j > 0 ? j - 1 : j;
          const jd = j < REL - 1 ? j + 1 : j;
          const gx = hgt[j * REL + ir] - hgt[j * REL + il];
          const gz = hgt[jd * REL + i] - hgt[ju * REL + i];
          shade = 1 - gx * 0.05 + gz * 0.05;
          shade = shade < 0.62 ? 0.62 : shade > 1.5 ? 1.5 : shade;
        }
        const o = idx * 4;
        d[o] = clamp255(r * shade);
        d[o + 1] = clamp255(g * shade);
        d[o + 2] = clamp255(b * shade);
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Vector overlays: roads then rivers, in relief pixel space.
    const toPx = (wx: number, wz: number): [number, number] => [
      (wx + half) / step,
      (half - wz) / step,
    ];
    const stroke = (paths: SceneryPath[], color: string): void => {
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const p of paths) {
        if (p.points.length < 2) continue;
        ctx.lineWidth = Math.max(1.2, (p.width * REL) / this.worldSize);
        ctx.beginPath();
        const [x0, y0] = toPx(p.points[0].x, p.points[0].z);
        ctx.moveTo(x0, y0);
        for (let k = 1; k < p.points.length; k++) {
          const [x, y] = toPx(p.points[k].x, p.points[k].z);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };
    stroke(scenery.roads, ROAD);
    stroke(scenery.rivers, RIVER);

    return canvas;
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
    const half = this.worldSize / 2;
    let project: Project;

    ctx.clearRect(0, 0, size, size);
    if (centered) {
      const scale = size / (2 * MINI_RANGE);
      ctx.fillStyle = '#0c110b';
      ctx.fillRect(0, 0, size, size);
      // Blit the whole relief, mapped so the player sits at the centre (canvas clips it).
      if (this.relief) {
        const dw = this.worldSize * scale;
        const dx = size / 2 + (-half - ptr.x) * scale;
        const dy = size / 2 - (half - ptr.z) * scale;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.relief, 0, 0, REL, REL, dx, dy, dw, dw);
      }
      project = (wx, wz) => [size / 2 + (wx - ptr.x) * scale, size / 2 - (wz - ptr.z) * scale];
    } else {
      ctx.fillStyle = '#0c110b';
      ctx.fillRect(0, 0, size, size);
      if (this.relief) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.relief, 0, 0, REL, REL, 0, 0, size, size);
      }
      const scale = size / this.worldSize;
      project = (wx, wz) => [(wx + half) * scale, size - (wz + half) * scale];
    }

    const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x <= size && y <= size;
    const dot = (x: number, y: number, r: number, color: string): void => {
      if (!inBounds(x, y)) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Label with a dark halo so it stays legible over snow / bright terrain.
    const label = (text: string, x: number, y: number, color: string): void => {
      ctx.font = '11px ui-monospace, monospace';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.78)';
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
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

    // Oathstones (attuned bright cyan, dormant dim) with a dark halo for legibility.
    for (const e of world.query(C.Oathstone, C.Transform)) {
      const os = world.get<Oathstone>(e, C.Oathstone)!;
      const t = world.get<Transform>(e, C.Transform)!;
      const [x, y] = project(t.x, t.z);
      if (!inBounds(x, y)) continue;
      dot(x, y, centered ? 4 : 6, 'rgba(0,0,0,0.5)');
      dot(x, y, centered ? 3 : 5, os.activated ? '#49d6e0' : '#8aa0b0');
      if (!centered) label(os.name, x + 8, y + 4, os.activated ? '#dff6f8' : '#cdd8e3');
    }

    // World bosses — a distinct crimson diamond (+ name on the big map). Hidden while slain.
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
        label(info?.name ?? 'World Boss', x + 9, y + 4, '#ffd7da');
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
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + dx * tip, py + dy * tip);
    ctx.lineTo(px - dx * back + perpX * wide, py - dy * back + perpY * wide);
    ctx.lineTo(px - dx * back - perpX * wide, py - dy * back - perpY * wide);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// Friendly NPCs for a custom map (render-only, like the village walkers): a small low-poly
// figure per NPC that strolls its looped patrol route (or idles), snapping to the terrain
// and facing its direction of travel, with an overhead name plate. No sim/combat — purely
// ambient, so it stays out of the ECS just like AmbientLife and VillageView.

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';
import type { MapNpc } from '../world/map-format';

const NPC_TINTS = [0x5b7da8, 0x8a8f99, 0x9c6b3f, 0x6a5a72]; // villager / guard / merchant / elder
const SKIN = new THREE.MeshLambertMaterial({ color: 0xe0b48c });
const ROBES = NPC_TINTS.map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));

function namePlate(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = '600 30px system-ui, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = w;
  canvas.height = 44;
  const c = canvas.getContext('2d')!;
  c.font = '600 30px system-ui, sans-serif';
  c.fillStyle = 'rgba(14,20,16,0.7)';
  c.fillRect(0, 0, w, 44);
  c.fillStyle = '#bfe8cf';
  c.textBaseline = 'middle';
  c.fillText(text, 12, 23);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set((w / 44) * 1.3, 1.3, 1);
  sprite.position.y = 2.4;
  sprite.renderOrder = 50;
  return sprite;
}

function figure(variant: number): THREE.Group {
  const g = new THREE.Group();
  const robe = ROBES[variant] ?? ROBES[0];
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.7, 6), robe);
  legs.position.y = 0.35;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.8, 7), robe);
  torso.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), SKIN);
  head.position.y = 1.6;
  g.add(legs, torso, head);
  return g;
}

interface Walker {
  mesh: THREE.Group;
  pts: { x: number; z: number }[];
  seg: number;
  t: number;
  speed: number;
}

export class CustomNpcs {
  readonly group = new THREE.Group();
  private walkers: Walker[] = [];

  constructor(scene: THREE.Scene, private readonly field: Heightfield, list: MapNpc[]) {
    this.group.name = 'custom-npcs';
    for (const n of list) {
      const mesh = figure(n.variant ?? 0);
      mesh.add(namePlate(n.name));
      mesh.position.set(n.x, field.sample(n.x, n.z), n.z);
      this.group.add(mesh);
      const pts = [{ x: n.x, z: n.z }, ...n.route.map((p) => ({ x: p.x, z: p.z }))];
      this.walkers.push({ mesh, pts, seg: 0, t: 0, speed: Math.max(0.1, n.speed) });
    }
    scene.add(this.group);
  }

  update(dt: number): void {
    for (const w of this.walkers) {
      if (w.pts.length < 2) {
        // Idle: keep seated on the terrain (it may differ from the authored height).
        w.mesh.position.y = this.field.sample(w.mesh.position.x, w.mesh.position.z);
        continue;
      }
      const a = w.pts[w.seg];
      const b = w.pts[(w.seg + 1) % w.pts.length];
      const segLen = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
      w.t += (w.speed * dt) / segLen;
      while (w.t >= 1) {
        w.t -= 1;
        w.seg = (w.seg + 1) % w.pts.length;
      }
      const a2 = w.pts[w.seg];
      const b2 = w.pts[(w.seg + 1) % w.pts.length];
      const x = a2.x + (b2.x - a2.x) * w.t;
      const z = a2.z + (b2.z - a2.z) * w.t;
      w.mesh.position.set(x, this.field.sample(x, z), z);
      const dx = b2.x - a2.x;
      const dz = b2.z - a2.z;
      if (dx || dz) w.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }
}

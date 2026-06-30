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

/** A floating quest marker badge: gold '!' / '?' (available / ready) or a dim '?' (in progress). */
function questBadge(kind: '!' | '?' | '?dim'): THREE.Sprite {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d')!;
  const gold = kind !== '?dim';
  c.beginPath();
  c.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  c.fillStyle = gold ? '#ffcf3f' : '#8b96a5';
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = gold ? '#7a5b12' : '#46505e';
  c.stroke();
  c.fillStyle = gold ? '#3a2a05' : '#11151b';
  c.font = '700 44px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(kind === '!' ? '!' : '?', size / 2, size / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(0.85, 0.85, 1);
  sprite.position.y = 3.3;
  sprite.renderOrder = 51;
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
  private markerSprites: (THREE.Sprite | null)[] = [];
  private markerKinds: (string | null)[] = [];
  private bob = 0;
  readonly list: MapNpc[];

  constructor(scene: THREE.Scene, private readonly field: Heightfield, list: MapNpc[]) {
    this.group.name = 'custom-npcs';
    this.list = list;
    list.forEach((n, i) => {
      const mesh = figure(n.variant ?? 0);
      mesh.userData.npcIndex = i; // so a raycast/click resolves back to the NPC
      mesh.add(namePlate(n.name));
      mesh.position.set(n.x, field.sample(n.x, n.z), n.z);
      this.group.add(mesh);
      const pts = [{ x: n.x, z: n.z }, ...n.route.map((p) => ({ x: p.x, z: p.z }))];
      this.walkers.push({ mesh, pts, seg: 0, t: 0, speed: Math.max(0.1, n.speed) });
    });
    scene.add(this.group);
  }

  /** Raycast the NPC figures; returns the hit NPC index (into `list`) or null. */
  pick(raycaster: THREE.Raycaster): number | null {
    const hits = raycaster.intersectObjects(this.group.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const idx = o.userData.npcIndex;
        if (typeof idx === 'number') return idx;
        o = o.parent;
      }
    }
    return null;
  }

  /** Nearest NPC (by current position) within `maxDist` of (x,z), or null. */
  nearest(x: number, z: number, maxDist: number): number | null {
    let best: number | null = null;
    let bestD = maxDist * maxDist;
    for (let i = 0; i < this.walkers.length; i++) {
      const p = this.walkers[i].mesh.position;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** Float a quest marker over NPC `index` (or clear it). Idempotent + cheap to call. */
  setMarker(index: number, kind: '!' | '?' | '?dim' | null): void {
    if (this.markerKinds[index] === kind) return;
    this.markerKinds[index] = kind;
    const prev = this.markerSprites[index];
    if (prev) {
      prev.parent?.remove(prev);
      prev.material.map?.dispose();
      prev.material.dispose();
      this.markerSprites[index] = null;
    }
    const mesh = this.walkers[index]?.mesh;
    if (kind && mesh) {
      const sprite = questBadge(kind);
      mesh.add(sprite);
      this.markerSprites[index] = sprite;
    }
  }

  update(dt: number): void {
    // Gentle bob so the quest markers catch the eye.
    this.bob += dt;
    const markerY = 3.3 + Math.sin(this.bob * 3) * 0.07;
    for (const s of this.markerSprites) if (s) s.position.y = markerY;

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

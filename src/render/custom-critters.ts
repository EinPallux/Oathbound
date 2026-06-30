// Ambient wildlife placed by a custom map (render-only, like AmbientLife): each critter
// zone spawns `count` creatures of its type wandering within `radius` of the point —
// birds wheel overhead, ground critters scurry, butterflies flit, fireflies bob + glow.
// No sim/collision; updated each frame from the bootstrap render loop.

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';
import type { MapCritter } from '../world/map-format';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const MAX_TOTAL = 600; // safety cap across all zones

const BIRD_MAT = new THREE.MeshStandardMaterial({ color: 0x9aa1ad, roughness: 0.8, emissive: 0x20242c });
const FUR_MATS = [
  new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.85 }),
];
const BUTTERFLY_COLORS = [0xffd24a, 0xff7ab0, 0x7ab0ff, 0xffffff];

interface Bird {
  group: THREE.Group; lw: THREE.Group; rw: THREE.Group;
  cx: number; cz: number; angle: number; rad: number; speed: number; alt: number; flap: number; phase: number;
  px: number; pz: number;
}
interface Ground {
  group: THREE.Group; cx: number; cz: number; radius: number;
  tx: number; tz: number; timer: number; moving: boolean; speed: number;
}
interface Flier {
  group: THREE.Group; lw: THREE.Mesh; rw: THREE.Mesh; mat: THREE.MeshStandardMaterial;
  hx: number; hz: number; amp: number; phase: number; firefly: boolean;
}

function makeBird(): { group: THREE.Group; lw: THREE.Group; rw: THREE.Group } {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.74, 5), BIRD_MAT);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const wingGeo = new THREE.BoxGeometry(0.62, 0.03, 0.3);
  const lw = new THREE.Group();
  const rw = new THREE.Group();
  const lwm = new THREE.Mesh(wingGeo, BIRD_MAT);
  lwm.position.x = 0.28;
  lw.add(lwm);
  const rwm = new THREE.Mesh(wingGeo, BIRD_MAT);
  rwm.position.x = -0.28;
  rw.add(rwm);
  group.add(lw, rw);
  return { group, lw, rw };
}

function makeGround(): THREE.Group {
  const group = new THREE.Group();
  const mat = FUR_MATS[Math.random() < 0.5 ? 0 : 1];
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.34), mat);
  body.position.y = 0.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.14), mat);
  head.position.set(0, 0.16, 0.22);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.18), mat);
  tail.position.set(0, 0.12, -0.24);
  group.add(body, head, tail);
  return group;
}

function makeFlier(firefly: boolean): { group: THREE.Group; lw: THREE.Mesh; rw: THREE.Mesh; mat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  if (firefly) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffe066, emissiveIntensity: 1.0, roughness: 0.5 });
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat);
    group.add(dot);
    return { group, lw: dot, rw: dot, mat };
  }
  const mat = new THREE.MeshStandardMaterial({
    color: BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)],
    roughness: 0.6, side: THREE.DoubleSide, emissive: 0x111111,
  });
  const wingGeo = new THREE.PlaneGeometry(0.16, 0.22);
  const lw = new THREE.Mesh(wingGeo, mat);
  lw.position.x = 0.08;
  const rw = new THREE.Mesh(wingGeo, mat);
  rw.position.x = -0.08;
  group.add(lw, rw);
  return { group, lw, rw, mat };
}

export class CustomCritters {
  readonly group = new THREE.Group();
  private birds: Bird[] = [];
  private ground: Ground[] = [];
  private fliers: Flier[] = [];
  private t = 0;

  constructor(scene: THREE.Scene, private readonly field: Heightfield, zones: MapCritter[]) {
    this.group.name = 'custom-critters';
    let total = 0;
    for (const z of zones) {
      const count = Math.max(0, Math.min(40, Math.round(z.count)));
      for (let i = 0; i < count && total < MAX_TOTAL; i++, total++) {
        this.spawn(z);
      }
    }
    scene.add(this.group);
  }

  private spawn(z: MapCritter): void {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * z.radius;
    const hx = z.x + Math.cos(a) * r;
    const hz = z.z + Math.sin(a) * r;
    if (z.type === 'birds') {
      const { group, lw, rw } = makeBird();
      this.group.add(group);
      this.birds.push({
        group, lw, rw, cx: z.x, cz: z.z, angle: rand(0, Math.PI * 2),
        rad: rand(z.radius * 0.3, Math.max(2, z.radius)), speed: rand(0.25, 0.5) * (Math.random() < 0.5 ? 1 : -1),
        alt: rand(11, 22), flap: rand(6, 10), phase: rand(0, 10), px: 0, pz: 0,
      });
    } else if (z.type === 'critters') {
      const group = makeGround();
      group.position.set(hx, this.field.sample(hx, hz), hz);
      this.group.add(group);
      this.ground.push({ group, cx: z.x, cz: z.z, radius: z.radius, tx: hx, tz: hz, timer: rand(0, 2), moving: false, speed: rand(2.5, 4.5) });
    } else {
      const firefly = z.type === 'fireflies';
      const { group, lw, rw, mat } = makeFlier(firefly);
      group.position.set(hx, this.field.sample(hx, hz) + 1, hz);
      this.group.add(group);
      this.fliers.push({ group, lw, rw, mat, hx, hz, amp: rand(1.2, 2.6), phase: rand(0, 10), firefly });
    }
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;

    for (const b of this.birds) {
      b.angle += b.speed * dt;
      const x = b.cx + Math.cos(b.angle) * b.rad;
      const z = b.cz + Math.sin(b.angle) * b.rad;
      const y = this.field.sample(x, z) + b.alt + Math.sin(t * 1.4 + b.phase) * 0.8;
      const dx = x - b.px;
      const dz = z - b.pz;
      if (dx * dx + dz * dz > 1e-5) b.group.rotation.y = Math.atan2(dx, dz);
      b.group.position.set(x, y, z);
      b.px = x;
      b.pz = z;
      const beat = Math.sin(t * b.flap + b.phase) * 0.9;
      b.lw.rotation.z = beat;
      b.rw.rotation.z = -beat;
    }

    for (const c of this.ground) {
      c.timer -= dt;
      if (c.timer <= 0) {
        c.moving = !c.moving;
        if (c.moving) {
          const a = rand(0, Math.PI * 2);
          const r = Math.sqrt(Math.random()) * c.radius;
          c.tx = c.cx + Math.cos(a) * r;
          c.tz = c.cz + Math.sin(a) * r;
          c.timer = rand(0.5, 1.6);
        } else {
          c.timer = rand(1, 3.5);
        }
      }
      let bob = 0;
      if (c.moving) {
        const dx = c.tx - c.group.position.x;
        const dz = c.tz - c.group.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.15) {
          const s = Math.min(1, (c.speed * dt) / d);
          c.group.position.x += dx * s;
          c.group.position.z += dz * s;
          c.group.rotation.y = Math.atan2(dx, dz);
          bob = Math.abs(Math.sin(t * 16)) * 0.06;
        } else {
          c.moving = false;
          c.timer = rand(0.8, 2.5);
        }
      }
      c.group.position.y = this.field.sample(c.group.position.x, c.group.position.z) + bob;
    }

    for (const f of this.fliers) {
      const x = f.hx + Math.sin(t * 0.6 + f.phase) * f.amp;
      const z = f.hz + Math.cos(t * 0.5 + f.phase * 1.3) * f.amp;
      const base = f.firefly ? 0.8 : 1.0;
      const y = this.field.sample(x, z) + base + Math.sin(t * 1.4 + f.phase) * 0.4;
      f.group.position.set(x, y, z);
      if (f.firefly) {
        f.mat.emissiveIntensity = 0.5 + (0.5 + 0.5 * Math.sin(t * 3 + f.phase)) * 1.4;
      } else {
        f.group.rotation.y = t * 0.8 + f.phase;
        const beat = 0.5 + Math.sin(t * 14 + f.phase) * 0.7;
        f.lw.rotation.y = beat;
        f.rw.rotation.y = -beat;
      }
    }
  }
}

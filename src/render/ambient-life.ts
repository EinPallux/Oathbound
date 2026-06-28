// Ambient wildlife — purely decorative low-poly creatures that make the world feel
// alive: birds wheeling overhead, small critters (rats/rabbits) scurrying on the ground,
// and a few butterflies drifting nearby. Render-only — these are NOT simulation entities
// (no collision, not targetable, not saved). A small fixed pool follows the player around
// the open world (relocated off-screen) so there's always life close by without spawning
// thousands of things.

import * as THREE from 'three';
import type { Heightfield } from '../world/heightfield';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

interface Bird {
  group: THREE.Group;
  lw: THREE.Group;
  rw: THREE.Group;
  angle: number;
  radius: number;
  speed: number;
  alt: number;
  flap: number;
  phase: number;
  px: number;
  pz: number;
}

interface Critter {
  group: THREE.Group;
  hx: number;
  hz: number;
  tx: number;
  tz: number;
  timer: number;
  moving: boolean;
  speed: number;
  px: number;
  pz: number;
}

interface Butterfly {
  group: THREE.Group;
  lw: THREE.Mesh;
  rw: THREE.Mesh;
  hx: number;
  hz: number;
  phase: number;
}

function makeBird(): Bird {
  const group = new THREE.Group();
  // Pale so they read as silhouettes against the moody sky (and over dark terrain).
  const dark = new THREE.MeshStandardMaterial({ color: 0x9aa1ad, roughness: 0.8, emissive: 0x20242c });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.74, 5), dark);
  body.rotation.x = Math.PI / 2; // point along +z
  group.add(body);
  const wingGeo = new THREE.BoxGeometry(0.62, 0.03, 0.3);
  const lw = new THREE.Group();
  const rw = new THREE.Group();
  const lwm = new THREE.Mesh(wingGeo, dark);
  lwm.position.x = 0.28;
  lw.add(lwm);
  const rwm = new THREE.Mesh(wingGeo, dark);
  rwm.position.x = -0.28;
  rw.add(rwm);
  group.add(lw, rw);
  return {
    group,
    lw,
    rw,
    angle: rand(0, Math.PI * 2),
    radius: rand(7, 22),
    speed: rand(0.25, 0.5) * (Math.random() < 0.5 ? 1 : -1),
    alt: rand(14, 26),
    flap: rand(6, 10),
    phase: rand(0, 10),
    px: 0,
    pz: 0,
  };
}

function makeCritter(): Critter {
  const group = new THREE.Group();
  const fur = Math.random() < 0.5 ? 0x8a7a5a : 0x6a6a72; // rabbit-brown / rat-grey
  const mat = new THREE.MeshStandardMaterial({ color: fur, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.34), mat);
  body.position.y = 0.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.14), mat);
  head.position.set(0, 0.16, 0.22);
  const ear = new THREE.BoxGeometry(0.04, 0.12, 0.03);
  const earL = new THREE.Mesh(ear, mat);
  earL.position.set(0.05, 0.26, 0.22);
  const earR = new THREE.Mesh(ear, mat);
  earR.position.set(-0.05, 0.26, 0.22);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.18), mat);
  tail.position.set(0, 0.12, -0.24);
  group.add(body, head, earL, earR, tail);
  return { group, hx: 0, hz: 0, tx: 0, tz: 0, timer: rand(0, 2), moving: false, speed: rand(3, 5), px: 0, pz: 0 };
}

function makeButterfly(): Butterfly {
  const group = new THREE.Group();
  const colors = [0xffd24a, 0xff7ab0, 0x7ab0ff, 0xffffff];
  const mat = new THREE.MeshStandardMaterial({
    color: colors[Math.floor(Math.random() * colors.length)],
    roughness: 0.6,
    side: THREE.DoubleSide,
    emissive: 0x111111,
  });
  const wingGeo = new THREE.PlaneGeometry(0.16, 0.22);
  const lw = new THREE.Mesh(wingGeo, mat);
  lw.position.x = 0.08;
  const rw = new THREE.Mesh(wingGeo, mat);
  rw.position.x = -0.08;
  group.add(lw, rw);
  return { group, lw, rw, hx: 0, hz: 0, phase: rand(0, 10) };
}

export class AmbientLife {
  private readonly birds: Bird[] = [];
  private readonly critters: Critter[] = [];
  private readonly butterflies: Butterfly[] = [];
  private readonly flock = new THREE.Vector2();
  private t = 0;
  private initialised = false;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < 7; i++) {
      const b = makeBird();
      this.birds.push(b);
      scene.add(b.group);
    }
    for (let i = 0; i < 6; i++) {
      const c = makeCritter();
      this.critters.push(c);
      scene.add(c.group);
    }
    for (let i = 0; i < 4; i++) {
      const f = makeButterfly();
      this.butterflies.push(f);
      scene.add(f.group);
    }
  }

  update(dt: number, px: number, pz: number, field: Heightfield): void {
    this.t += dt;
    if (!this.initialised) {
      this.flock.set(px, pz);
      for (const c of this.critters) this.placeCritter(c, px, pz, field);
      for (const f of this.butterflies) this.placeButterfly(f, px, pz, field);
      this.initialised = true;
    }

    // Birds wheel around a flock centre that lags after the player.
    this.flock.x += (px - this.flock.x) * Math.min(1, dt * 0.25);
    this.flock.y += (pz - this.flock.y) * Math.min(1, dt * 0.25);
    for (const b of this.birds) {
      b.angle += b.speed * dt;
      const x = this.flock.x + Math.cos(b.angle) * b.radius;
      const z = this.flock.y + Math.sin(b.angle) * b.radius;
      const y = field.sample(x, z) + b.alt + Math.sin(this.t * 1.4 + b.phase) * 0.8;
      const dx = x - b.px;
      const dz = z - b.pz;
      if (dx * dx + dz * dz > 1e-5) b.group.rotation.y = Math.atan2(dx, dz);
      b.group.position.set(x, y, z);
      b.px = x;
      b.pz = z;
      const beat = Math.sin(this.t * b.flap + b.phase) * 0.9;
      b.lw.rotation.z = beat;
      b.rw.rotation.z = -beat;
    }

    // Critters scurry within a roam patch; the patch relocates near the player off-screen.
    for (const c of this.critters) {
      if ((c.hx - px) ** 2 + (c.hz - pz) ** 2 > 48 * 48) this.placeCritter(c, px, pz, field);
      c.timer -= dt;
      if (c.timer <= 0) {
        c.moving = !c.moving;
        if (c.moving) {
          const a = rand(0, Math.PI * 2);
          const r = rand(1, 6);
          c.tx = c.hx + Math.cos(a) * r;
          c.tz = c.hz + Math.sin(a) * r;
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
          const s = (c.speed * dt) / d;
          const nx = c.group.position.x + dx * Math.min(1, s);
          const nz = c.group.position.z + dz * Math.min(1, s);
          c.group.position.x = nx;
          c.group.position.z = nz;
          c.group.rotation.y = Math.atan2(dx, dz);
          bob = Math.abs(Math.sin(this.t * 16)) * 0.06;
        } else {
          c.moving = false;
          c.timer = rand(0.8, 2.5);
        }
      }
      c.group.position.y = field.sample(c.group.position.x, c.group.position.z) + bob;
    }

    // Butterflies flit in lazy lissajous loops near the player.
    for (const f of this.butterflies) {
      if ((f.hx - px) ** 2 + (f.hz - pz) ** 2 > 34 * 34) this.placeButterfly(f, px, pz, field);
      const x = f.hx + Math.sin(this.t * 0.6 + f.phase) * 2.4;
      const z = f.hz + Math.cos(this.t * 0.5 + f.phase * 1.3) * 2.4;
      const y = field.sample(x, z) + 1.0 + Math.sin(this.t * 1.5 + f.phase) * 0.4;
      f.group.position.set(x, y, z);
      f.group.rotation.y = this.t * 0.8 + f.phase;
      const beat = 0.5 + Math.sin(this.t * 14 + f.phase) * 0.7;
      f.lw.rotation.y = beat;
      f.rw.rotation.y = -beat;
    }
  }

  private placeCritter(c: Critter, px: number, pz: number, field: Heightfield): void {
    const a = rand(0, Math.PI * 2);
    const r = rand(6, 24);
    c.hx = px + Math.cos(a) * r;
    c.hz = pz + Math.sin(a) * r;
    c.tx = c.hx;
    c.tz = c.hz;
    c.moving = false;
    c.timer = rand(0.5, 2.5);
    c.group.position.set(c.hx, field.sample(c.hx, c.hz), c.hz);
  }

  private placeButterfly(f: Butterfly, px: number, pz: number, field: Heightfield): void {
    const a = rand(0, Math.PI * 2);
    const r = rand(4, 18);
    f.hx = px + Math.cos(a) * r;
    f.hz = pz + Math.sin(a) * r;
    f.group.position.set(f.hx, field.sample(f.hx, f.hz) + 1, f.hz);
  }
}

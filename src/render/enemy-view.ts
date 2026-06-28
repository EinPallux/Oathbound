// Visuals for enemies, driven from sim state each frame: a unique low-poly model per
// family (enemy-models.ts), a billboarded HP bar, a baked name + level nameplate above
// the head, a hit flash, a telegraph tint during a wind-up, and a spinning reticle ring
// under the current target. Reads the world; never mutates it.
//
// Models/nameplates are created lazily for enemies near the camera and freed when they
// move far away — the open world holds ~80 spawns but only a camp or two is ever close.

import * as THREE from 'three';
import type { World, Entity } from '../core/ecs/world';
import { C, type Transform, type Health, type Enemy, type EnemyInfo } from '../core/ecs/components';
import { lerp, lerpAngle } from '../core/math';
import { buildEnemyModel } from './enemy-models';

interface FlashMat {
  mat: THREE.MeshStandardMaterial;
  base: THREE.Color;
}

interface EnemyVisual {
  root: THREE.Group;
  flash: FlashMat[];
  bar: THREE.Group;
  fill: THREE.Mesh;
  barWidth: number;
  nameplate: THREE.Sprite;
  npTexture: THREE.CanvasTexture;
  top: number; // scaled model height
  bob: boolean;
  phase: number;
  flashT: number;
}

const ENEMY_FEET = 0.9; // = ENEMY_HALF — feet sit at the transform centre minus this
const CREATE_DIST = 95;
const DISPOSE_DIST = 135;
const FLASH = new THREE.Color(0xff4030);
const TELEGRAPH = new THREE.Color(0xffa030);

function makeNameplate(name: string, level: number, tier: Enemy['tier']): {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;
  const nameColor = tier === 'rare' ? '#ffcf5a' : tier === 'elite' ? '#ff9a48' : '#eef1f6';
  const font = "'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Name (auto-shrink to fit long rare/elite names).
  let fs = 56;
  do {
    ctx.font = `bold ${fs}px ${font}`;
    fs -= 2;
  } while (ctx.measureText(name).width > 496 && fs > 26);
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  ctx.strokeText(name, 256, 50);
  ctx.fillStyle = nameColor;
  ctx.fillText(name, 256, 50);

  // Level line.
  ctx.font = `600 36px ${font}`;
  const lv = `Lv ${level}`;
  ctx.lineWidth = 8;
  ctx.strokeText(lv, 256, 104);
  ctx.fillStyle = '#ccd3df';
  ctx.fillText(lv, 256, 104);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(2.8, 0.77, 1);
  return { sprite, texture };
}

export class EnemyView {
  private readonly visuals = new Map<Entity, EnemyVisual>();
  private readonly reticle: THREE.Mesh;
  private t = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.9, 28),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
  }

  private ensure(e: Entity, en: Enemy, info: EnemyInfo): EnemyVisual {
    let v = this.visuals.get(e);
    if (v) return v;

    const scale = en.tier === 'rare' ? 1.7 : en.tier === 'elite' ? 1.35 : 1;
    const model = buildEnemyModel(en.family, en.archetype, e);
    model.root.scale.setScalar(scale);
    this.scene.add(model.root);
    const flash = model.flashMats.map((mat) => ({ mat, base: mat.emissive.clone() }));

    const barWidth = 1.3;
    const bar = new THREE.Group();
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x14171c, depthWrite: false }),
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x66dd77, depthWrite: false }),
    );
    fill.position.z = 0.001;
    bar.add(back, fill);
    this.scene.add(bar);

    const { sprite, texture } = makeNameplate(info.name, info.level, en.tier);
    this.scene.add(sprite);

    v = {
      root: model.root,
      flash,
      bar,
      fill,
      barWidth,
      nameplate: sprite,
      npTexture: texture,
      top: model.top * scale,
      bob: model.bob,
      phase: (e % 17) * 0.61,
      flashT: 0,
    };
    this.visuals.set(e, v);
    return v;
  }

  private dispose(e: Entity, v: EnemyVisual): void {
    this.scene.remove(v.root, v.bar, v.nameplate);
    v.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    v.bar.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
    v.npTexture.dispose();
    (v.nameplate.material as THREE.SpriteMaterial).dispose();
    this.visuals.delete(e);
  }

  /** Trigger a hit flash. */
  onHit(e: Entity): void {
    const v = this.visuals.get(e);
    if (v) v.flashT = 1;
  }

  pickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const v of this.visuals.values()) {
      if (!v.root.visible) continue;
      v.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) out.push(o);
      });
    }
    return out;
  }

  update(world: World, camera: THREE.Camera, alpha: number, dt: number, target: Entity | null): void {
    this.t += dt;
    const seen = new Set<Entity>();
    const cx = camera.position.x;
    const cz = camera.position.z;

    for (const e of world.query(C.Enemy, C.Transform, C.Health)) {
      const tr = world.get<Transform>(e, C.Transform)!;
      const dx = tr.x - cx;
      const dz = tr.z - cz;
      const dist2 = dx * dx + dz * dz;
      const existing = this.visuals.get(e);

      // Distance gate: only build models for enemies near the camera; free distant ones.
      if (!existing) {
        if (dist2 > CREATE_DIST * CREATE_DIST) continue;
      } else if (dist2 > DISPOSE_DIST * DISPOSE_DIST) {
        this.dispose(e, existing);
        continue;
      }

      seen.add(e);
      const en = world.get<Enemy>(e, C.Enemy)!;
      const info = world.get<EnemyInfo>(e, C.EnemyInfo)!;
      const v = existing ?? this.ensure(e, en, info);
      const h = world.get<Health>(e, C.Health)!;

      const dead = h.current <= 0;
      v.root.visible = !dead;
      v.bar.visible = !dead;
      v.nameplate.visible = !dead;
      if (dead) continue;

      const x = lerp(tr.prevX, tr.x, alpha);
      const yCentre = lerp(tr.prevY, tr.y, alpha);
      const z = lerp(tr.prevZ, tr.z, alpha);
      const feetY = yCentre - ENEMY_FEET;
      const hover = v.bob ? Math.sin(this.t * 2 + v.phase) * 0.09 + 0.12 : 0;
      v.root.position.set(x, feetY + hover, z);
      v.root.rotation.y = lerpAngle(tr.prevYaw, tr.yaw, alpha);

      const topY = feetY + hover + v.top;
      const ratio = THREE.MathUtils.clamp(h.current / h.max, 0, 1);
      v.fill.scale.x = Math.max(1e-3, ratio);
      v.fill.position.x = -(v.barWidth * (1 - ratio)) / 2;
      (v.fill.material as THREE.MeshBasicMaterial).color.setRGB(
        ratio > 0.5 ? 1 - (ratio - 0.5) * 1.2 : 1,
        ratio > 0.5 ? 0.87 : 0.2 + ratio * 1.3,
        0.2,
      );
      v.bar.position.set(x, topY + 0.4, z);
      v.bar.quaternion.copy(camera.quaternion);
      v.nameplate.position.set(x, topY + 0.95, z);

      // Telegraph tint while winding up; else decay the hit flash; else restore base.
      let mode: 'telegraph' | 'flash' | 'base' = 'base';
      let amount = 0;
      if (en.windupTimer >= 0) {
        mode = 'telegraph';
        amount = 0.4 + 0.4 * Math.sin(performance.now() * 0.02);
      } else if (v.flashT > 0) {
        v.flashT = Math.max(0, v.flashT - dt * 4);
        mode = 'flash';
        amount = v.flashT;
      }
      for (const f of v.flash) {
        if (mode === 'telegraph') f.mat.emissive.copy(TELEGRAPH).multiplyScalar(amount);
        else if (mode === 'flash') f.mat.emissive.copy(FLASH).multiplyScalar(amount);
        else f.mat.emissive.copy(f.base);
      }
    }

    // Free visuals for entities that vanished (despawned).
    for (const [e, v] of this.visuals) {
      if (!seen.has(e)) this.dispose(e, v);
    }

    // Reticle on the current target.
    const tv = target != null ? this.visuals.get(target) : undefined;
    if (tv && tv.root.visible) {
      this.reticle.visible = true;
      this.reticle.position.set(tv.root.position.x, tv.root.position.y + 0.05, tv.root.position.z);
      this.reticle.rotation.z += dt * 1.5;
    } else {
      this.reticle.visible = false;
    }
  }
}

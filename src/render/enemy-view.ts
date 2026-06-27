// Visuals for enemies, driven from sim state each frame: an interpolated capsule
// body, a billboarded HP bar, a hit flash, a telegraph tint during a wind-up, and a
// spinning reticle ring under the current target. Reads the world; never mutates it.

import * as THREE from 'three';
import type { World, Entity } from '../core/ecs/world';
import { C, type Transform, type Health, type Enemy } from '../core/ecs/components';
import { lerp, lerpAngle } from '../core/math';

interface EnemyVisual {
  body: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  bar: THREE.Group;
  fill: THREE.Mesh;
  barWidth: number;
  half: number;
  flash: number;
}

const BODY_COLOR = 0x9c6b4a;
const HALF = 0.9;
const FLASH = new THREE.Color(0xff4030);
const TELEGRAPH = new THREE.Color(0xffa030);

export class EnemyView {
  private readonly visuals = new Map<Entity, EnemyVisual>();
  private readonly reticle: THREE.Mesh;

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

  private ensure(e: Entity, tier: Enemy['tier'], archetype: Enemy['archetype']): EnemyVisual {
    let v = this.visuals.get(e);
    if (v) return v;
    const color =
      tier === 'rare'
        ? 0xb060d0
        : tier === 'elite'
          ? 0xd08a3a
          : archetype === 'support'
            ? 0x46c98a // healer — teal-green
            : archetype === 'pack_leader'
              ? 0xc0563c // leader — banner red
              : BODY_COLOR;
    const scale = tier === 'rare' ? 1.8 : tier === 'elite' ? 1.4 : 1;
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, HALF * 2 - 0.9, 6, 12), material);
    body.scale.setScalar(scale);
    body.userData.entity = e;
    this.scene.add(body);

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

    v = { body, material, bar, fill, barWidth, half: HALF, flash: 0 };
    this.visuals.set(e, v);
    return v;
  }

  /** Trigger a hit flash. */
  onHit(e: Entity): void {
    const v = this.visuals.get(e);
    if (v) v.flash = 1;
  }

  pickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const v of this.visuals.values()) if (v.body.visible) out.push(v.body);
    return out;
  }

  update(world: World, camera: THREE.Camera, alpha: number, dt: number, target: Entity | null): void {
    const seen = new Set<Entity>();

    for (const e of world.query(C.Enemy, C.Transform, C.Health)) {
      seen.add(e);
      const en = world.get<Enemy>(e, C.Enemy)!;
      const v = this.ensure(e, en.tier, en.archetype);
      const tr = world.get<Transform>(e, C.Transform)!;
      const h = world.get<Health>(e, C.Health)!;

      const dead = h.current <= 0;
      v.body.visible = !dead;
      v.bar.visible = !dead;
      if (dead) continue;

      const x = lerp(tr.prevX, tr.x, alpha);
      const y = lerp(tr.prevY, tr.y, alpha);
      const z = lerp(tr.prevZ, tr.z, alpha);
      v.body.position.set(x, y, z);
      v.body.rotation.y = lerpAngle(tr.prevYaw, tr.yaw, alpha);

      const ratio = THREE.MathUtils.clamp(h.current / h.max, 0, 1);
      v.fill.scale.x = Math.max(1e-3, ratio);
      v.fill.position.x = -(v.barWidth * (1 - ratio)) / 2;
      (v.fill.material as THREE.MeshBasicMaterial).color.setRGB(
        ratio > 0.5 ? 1 - (ratio - 0.5) * 1.2 : 1,
        ratio > 0.5 ? 0.87 : 0.2 + ratio * 1.3,
        0.2,
      );
      v.bar.position.set(x, y + v.half + 0.5, z);
      v.bar.quaternion.copy(camera.quaternion);

      // Telegraph tint while winding up; otherwise decay the hit flash.
      if (en.windupTimer >= 0) {
        const pulse = 0.4 + 0.4 * Math.sin(performance.now() * 0.02);
        v.material.emissive.copy(TELEGRAPH).multiplyScalar(pulse);
      } else if (v.flash > 0) {
        v.flash = Math.max(0, v.flash - dt * 4);
        v.material.emissive.copy(FLASH).multiplyScalar(v.flash);
      } else {
        v.material.emissive.setRGB(0, 0, 0);
      }
    }

    // Dispose visuals for entities that vanished.
    for (const [e, v] of this.visuals) {
      if (seen.has(e)) continue;
      this.scene.remove(v.body, v.bar);
      this.visuals.delete(e);
    }

    // Reticle on the current target.
    const tv = target != null ? this.visuals.get(target) : undefined;
    if (tv && tv.body.visible) {
      this.reticle.visible = true;
      this.reticle.position.set(
        tv.body.position.x,
        tv.body.position.y - tv.half + 0.05,
        tv.body.position.z,
      );
      this.reticle.rotation.z += dt * 1.5;
    } else {
      this.reticle.visible = false;
    }
  }
}

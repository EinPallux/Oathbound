// Renders ground-AoE zones as a translucent, pulsing ground disc (tinted by damage
// school), scanned from the world each frame. Mirrors TrapView's lifecycle handling.

import * as THREE from 'three';
import type { World, Entity } from '../core/ecs/world';
import { C, type GroundAoe, type Transform, type DamageType } from '../core/ecs/components';

const TINT: Record<DamageType, number> = {
  physical: 0xffa54c,
  fire: 0xff5a3c,
  frost: 0x8ad6ff,
  blight: 0x7fd36b,
  holy: 0xffe08a,
};

export class GroundAoeView {
  private readonly discs = new Map<Entity, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  private ensure(e: Entity, radius: number, color: number): THREE.Mesh {
    let m = this.discs.get(e);
    if (m) return m;
    m = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 28),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    this.discs.set(e, m);
    return m;
  }

  update(world: World): void {
    const seen = new Set<Entity>();
    const pulse = 0.28 + 0.16 * Math.sin(performance.now() * 0.008);
    for (const e of world.query(C.GroundAoe, C.Transform)) {
      seen.add(e);
      const g = world.get<GroundAoe>(e, C.GroundAoe)!;
      const tr = world.get<Transform>(e, C.Transform)!;
      const m = this.ensure(e, g.radius, TINT[g.damageType]);
      m.position.set(tr.x, tr.y + 0.03, tr.z);
      (m.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
    for (const [e, m] of this.discs) {
      if (seen.has(e)) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.discs.delete(e);
    }
  }
}

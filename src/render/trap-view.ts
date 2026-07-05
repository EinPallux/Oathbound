// Renders placed traps as flat ground rings, scanned from the world each frame.

import * as THREE from 'three';
import type { World, Entity } from '../core/ecs/world';
import { C, type Transform } from '../core/ecs/components';

export class TrapView {
  private readonly rings = new Map<Entity, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  private ensure(e: Entity): THREE.Mesh {
    let m = this.rings.get(e);
    if (m) return m;
    m = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.0, 20),
      new THREE.MeshBasicMaterial({
        color: 0x8ad6ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    this.rings.set(e, m);
    return m;
  }

  update(world: World): void {
    const seen = new Set<Entity>();
    const pulse = 0.5 + 0.3 * Math.sin(performance.now() * 0.006);
    for (const e of world.query(C.Trap, C.Transform)) {
      seen.add(e);
      const tr = world.get<Transform>(e, C.Transform)!;
      const m = this.ensure(e);
      m.position.set(tr.x, tr.y + 0.03, tr.z);
      (m.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
    for (const [e, m] of this.rings) {
      if (seen.has(e)) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.rings.delete(e);
    }
  }
}

// Loot beams: a coloured pillar over each live loot drop (rarity-coloured for items,
// gold for currency-only). Scanned from the world each frame; reads, never mutates.

import * as THREE from 'three';
import type { World, Entity } from '../core/ecs/world';
import { C, type Transform, type LootDrop, type Rarity } from '../core/ecs/components';

const RARITY_COLOR: Record<Rarity, number> = {
  common: 0xc9d1d9,
  uncommon: 0x5fd35f,
};
const GOLD_COLOR = 0xffcc44;

export class LootView {
  private readonly beams = new Map<Entity, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  private ensure(e: Entity): THREE.Mesh {
    let m = this.beams.get(e);
    if (m) return m;
    m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    this.scene.add(m);
    this.beams.set(e, m);
    return m;
  }

  update(world: World): void {
    const seen = new Set<Entity>();
    const spin = performance.now() * 0.002;

    for (const e of world.query(C.LootDrop, C.Transform)) {
      seen.add(e);
      const ld = world.get<LootDrop>(e, C.LootDrop)!;
      const tr = world.get<Transform>(e, C.Transform)!;
      const m = this.ensure(e);
      m.position.set(tr.x, tr.y + 0.8, tr.z);
      m.rotation.y = spin;
      const color = ld.item ? RARITY_COLOR[ld.item.rarity] : GOLD_COLOR;
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
    }

    for (const [e, m] of this.beams) {
      if (seen.has(e)) continue;
      this.scene.remove(m);
      this.beams.delete(e);
    }
  }
}

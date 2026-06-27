// World markers for interactables: Oathstone obelisks (dormant grey → bright cyan once
// activated, with a gentle pulse) and vendor posts. Scanned from the world each frame;
// reads sim state, never mutates it. These are static props, so meshes are cached and
// never pruned. Emissive cues per docs/assets/ART_DIRECTION_PLAN.md.

import * as THREE from 'three';
import type { World, Entity } from '../core/ecs/world';
import { C, type Transform, type Oathstone } from '../core/ecs/components';

const DORMANT = 0x3a4a5a;
const ACTIVE = 0x49d6e0;
const VENDOR = 0xe0b44c;

export class InteractableView {
  private readonly oath = new Map<Entity, { orb: THREE.Mesh; pillar: THREE.Mesh }>();
  private readonly vendors = new Set<Entity>();

  constructor(private readonly scene: THREE.Scene) {}

  private ensureOath(e: Entity, x: number, y: number, z: number): { orb: THREE.Mesh; pillar: THREE.Mesh } {
    let m = this.oath.get(e);
    if (m) return m;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.42, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x222a33, emissive: DORMANT, emissiveIntensity: 0.4, roughness: 0.8, flatShading: true }),
    );
    pillar.position.set(x, y + 1.2, z);
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color: DORMANT, emissive: DORMANT, emissiveIntensity: 0.6, roughness: 0.3, flatShading: true }),
    );
    orb.position.set(x, y + 2.7, z);
    this.scene.add(pillar, orb);
    m = { orb, pillar };
    this.oath.set(e, m);
    return m;
  }

  private ensureVendor(e: Entity, x: number, y: number, z: number): void {
    if (this.vendors.has(e)) return;
    this.vendors.add(e);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 1, flatShading: true }),
    );
    post.position.set(x, y + 0.8, z);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x222a33, emissive: VENDOR, emissiveIntensity: 0.5, roughness: 0.6, flatShading: true }),
    );
    sign.position.set(x, y + 1.7, z);
    this.scene.add(post, sign);
  }

  update(world: World): void {
    const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(performance.now() * 0.004));

    for (const e of world.query(C.Oathstone, C.Transform)) {
      const tr = world.get<Transform>(e, C.Transform)!;
      const os = world.get<Oathstone>(e, C.Oathstone)!;
      const { orb, pillar } = this.ensureOath(e, tr.x, tr.y, tr.z);
      const color = os.activated ? ACTIVE : DORMANT;
      const orbMat = orb.material as THREE.MeshStandardMaterial;
      const pillarMat = pillar.material as THREE.MeshStandardMaterial;
      orbMat.color.setHex(color);
      orbMat.emissive.setHex(color);
      orbMat.emissiveIntensity = os.activated ? pulse : 0.5;
      pillarMat.emissive.setHex(color);
      pillarMat.emissiveIntensity = os.activated ? 0.5 * pulse : 0.3;
      orb.rotation.y += 0.01;
      orb.position.y = tr.y + 2.7 + (os.activated ? 0.12 * Math.sin(performance.now() * 0.003) : 0);
    }

    for (const e of world.query(C.Vendor, C.Transform)) {
      const tr = world.get<Transform>(e, C.Transform)!;
      this.ensureVendor(e, tr.x, tr.y - 0.9, tr.z); // transform is at capsule centre; drop to ground
    }
  }
}

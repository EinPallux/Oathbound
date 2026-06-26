// Renders pooled projectiles. The sim owns the projectile pool; this view keeps a
// matching pool of meshes and positions the visible ones each frame.

import * as THREE from 'three';
import type { Projectiles } from '../sim/projectiles';

export class ProjectileView {
  private readonly pool: THREE.Mesh[] = [];
  private readonly geo = new THREE.SphereGeometry(0.16, 8, 8);
  private readonly mat = new THREE.MeshBasicMaterial({ color: 0xffe08a });

  constructor(
    private readonly scene: THREE.Scene,
    private readonly projectiles: Projectiles,
  ) {}

  private mesh(i: number): THREE.Mesh {
    let m = this.pool[i];
    if (!m) {
      m = new THREE.Mesh(this.geo, this.mat);
      this.pool[i] = m;
      this.scene.add(m);
    }
    return m;
  }

  update(): void {
    let i = 0;
    for (const p of this.projectiles.list) {
      if (!p.active) continue;
      const m = this.mesh(i++);
      m.visible = true;
      m.position.set(p.x, p.y, p.z);
    }
    for (; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}

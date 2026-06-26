// Demonstration scene: many instanced cubes, each backed by an ECS Spinner entity.
// One InstancedMesh => one draw call for all cubes (proves instancing). The renderer
// interpolates each cube's rotation between fixed sim steps using `alpha`.
// This is placeholder tech-validation content, not gameplay — see the roadmap.

import * as THREE from 'three';
import type { World, Entity } from '../core/ecs/world';
import { C, type Spinner } from '../core/ecs/components';

export class DemoScene {
  private readonly mesh: THREE.InstancedMesh;
  private readonly entities: Entity[] = [];
  private readonly dummy = new THREE.Object3D();

  constructor(world: World, scene: THREE.Scene, count = 144) {
    const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const side = Math.ceil(Math.sqrt(count));
    const spacing = 1.6;
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const gx = i % side;
      const gz = Math.floor(i / side);
      const px = (gx - (side - 1) / 2) * spacing;
      const pz = (gz - (side - 1) / 2) * spacing;

      const e = world.createEntity();
      const angle = Math.random() * Math.PI * 2;
      const spinner: Spinner = {
        px,
        py: 0,
        pz,
        angle,
        prevAngle: angle,
        speed: 0.4 + Math.random() * 2.2,
      };
      world.set(e, C.Spinner, spinner);
      this.entities.push(e);

      color.setHSL(i / count, 0.6, 0.55);
      this.mesh.setColorAt(i, color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    scene.add(this.mesh);
  }

  /** Write interpolated transforms into the instance matrix once per rendered frame. */
  sync(world: World, alpha: number): void {
    for (let i = 0; i < this.entities.length; i++) {
      const s = world.get<Spinner>(this.entities[i], C.Spinner);
      if (!s) continue;
      const angle = s.prevAngle + (s.angle - s.prevAngle) * alpha;
      this.dummy.position.set(s.px, s.py, s.pz);
      this.dummy.rotation.set(0, angle, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

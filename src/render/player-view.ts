// The player's visual: a capsule body with a small nose cone indicating facing.
// Driven from the interpolated Transform each rendered frame.

import * as THREE from 'three';

export class PlayerView {
  readonly group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 1.0, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x6fb1ff, roughness: 0.5 }),
    );
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.5 }),
    );
    nose.rotation.x = Math.PI / 2; // point the cone along +Z (facing)
    nose.position.set(0, 0.15, 0.5);
    this.group.add(body, nose);
    scene.add(this.group);
  }

  update(x: number, y: number, z: number, yaw: number): void {
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
  }
}

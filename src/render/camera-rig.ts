// Third-person chase camera. Orbits the player using the control yaw/pitch/distance,
// and springs inward when terrain/props would occlude the view (camera collision).

import * as THREE from 'three';
import type { ControlState } from '../platform/input';

const EYE_HEIGHT = 1.4;
const SMOOTH = 0.25; // position smoothing per frame

export class CameraRig {
  private readonly current = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();
  private readonly origin = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private initialised = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly ctrl: ControlState,
    private readonly obstacles: THREE.Object3D[],
  ) {}

  update(px: number, py: number, pz: number): void {
    const eyeY = py + EYE_HEIGHT;
    const { yaw, pitch, dist } = this.ctrl;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const horiz = Math.cos(pitch) * dist;

    this.origin.set(px, eyeY, pz);
    this.desired.set(px - fx * horiz, eyeY + Math.sin(pitch) * dist, pz - fz * horiz);

    // Camera collision: cast from the head toward the desired position.
    this.dir.copy(this.desired).sub(this.origin);
    const len = this.dir.length();
    this.dir.divideScalar(len || 1);
    this.ray.set(this.origin, this.dir);
    this.ray.far = len;
    const hits = this.ray.intersectObjects(this.obstacles, false);
    if (hits.length > 0) {
      const d = Math.max(1.5, hits[0].distance - 0.3);
      this.desired.copy(this.origin).addScaledVector(this.dir, d);
    }

    if (!this.initialised) {
      this.current.copy(this.desired);
      this.initialised = true;
    } else {
      this.current.lerp(this.desired, SMOOTH);
    }
    this.camera.position.copy(this.current);
    this.camera.lookAt(px, eyeY - 0.3, pz);
  }
}

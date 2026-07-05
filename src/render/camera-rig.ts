// Third-person chase camera. Orbits the player using the control yaw/pitch/distance,
// and springs inward when terrain/props would occlude the view (camera collision).
//
// Terrain collision is ANALYTIC — it marches the camera ray and samples the heightfield —
// rather than raycasting the terrain mesh. The terrain is a >100k-triangle mesh with no BVH,
// and because the camera is always inside its bounding sphere, THREE.Raycaster fell through to
// scanning every triangle *every frame* (the single biggest hidden per-frame cost). Only the
// small prop/building obstacle set is still raycast.

import * as THREE from 'three';
import type { ControlState } from '../platform/input';
import type { Heightfield } from '../world/heightfield';

const EYE_HEIGHT = 1.4;
const SMOOTH = 0.25; // position smoothing per frame
const TERRAIN_MARGIN = 0.4; // keep the camera at least this far above the ground
const TERRAIN_STEP = 0.5; // ray-march resolution (m) for the analytic terrain test
const MIN_DIST = 1.5; // never pull the camera closer than this to the head

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
    /** Small occluders (props, buildings) — NOT the terrain mesh; that's handled analytically. */
    private readonly obstacles: THREE.Object3D[],
    private readonly field?: Heightfield,
  ) {}

  update(px: number, py: number, pz: number): void {
    const eyeY = py + EYE_HEIGHT;
    const { yaw, pitch, dist } = this.ctrl;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const horiz = Math.cos(pitch) * dist;

    this.origin.set(px, eyeY, pz);
    this.desired.set(px - fx * horiz, eyeY + Math.sin(pitch) * dist, pz - fz * horiz);

    this.dir.copy(this.desired).sub(this.origin);
    const len = this.dir.length();
    this.dir.divideScalar(len || 1);
    let maxDist = len;

    // Analytic terrain collision: march the ray from the head outward and stop just before the
    // camera would dip below the ground surface. O(dist/step) samples, no mesh scan.
    if (this.field && len > 0) {
      const steps = Math.ceil(len / TERRAIN_STEP);
      for (let i = 1; i <= steps; i++) {
        const t = Math.min(len, i * TERRAIN_STEP);
        const x = this.origin.x + this.dir.x * t;
        const y = this.origin.y + this.dir.y * t;
        const z = this.origin.z + this.dir.z * t;
        if (y < this.field.sample(x, z) + TERRAIN_MARGIN) {
          maxDist = Math.max(MIN_DIST, t - 0.3);
          break;
        }
      }
    }

    // Prop/building collision: raycast the (small) obstacle set within the current clamp.
    if (this.obstacles.length > 0) {
      this.ray.set(this.origin, this.dir);
      this.ray.far = maxDist;
      const hits = this.ray.intersectObjects(this.obstacles, false);
      if (hits.length > 0) maxDist = Math.max(MIN_DIST, hits[0].distance - 0.3);
    }

    if (maxDist < len) this.desired.copy(this.origin).addScaledVector(this.dir, maxDist);

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

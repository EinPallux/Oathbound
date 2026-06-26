// Visuals for enemies (target dummies): a capsule body, a billboarded HP bar, a hit
// flash on damage, and a spinning reticle ring under the current target. Reads sim
// state only; positions come from the (static) dummy transforms.

import * as THREE from 'three';

interface EnemyVisual {
  body: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  bar: THREE.Group;
  fill: THREE.Mesh;
  barWidth: number;
  height: number;
  baseY: number;
  flash: number;
}

const BODY_COLOR = 0xc06a4a;
const FLASH_COLOR = new THREE.Color(0xff4030);

export class EnemyView {
  private readonly visuals = new Map<number, EnemyVisual>();
  private readonly reticle: THREE.Mesh;
  private targetEntity: number | null = null;

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
    this.reticle.rotation.x = -Math.PI / 2; // lie flat on the ground
    this.reticle.visible = false;
    this.scene.add(this.reticle);
  }

  /** Create the visual for a dummy. `y` is the capsule centre; `half` its half-height. */
  add(entity: number, x: number, y: number, z: number, half: number): void {
    const material = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, half * 2 - 0.9, 6, 12), material);
    body.position.set(x, y, z);
    body.userData.entity = entity;
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
    bar.position.set(x, y + half + 0.5, z);
    this.scene.add(bar);

    this.visuals.set(entity, {
      body,
      material,
      bar,
      fill,
      barWidth,
      height: half,
      baseY: y - half,
      flash: 0,
    });
  }

  /** Update the HP fill (ratio in [0, 1]); the bar shrinks from the right. */
  setHealthRatio(entity: number, ratio: number): void {
    const v = this.visuals.get(entity);
    if (!v) return;
    const r = THREE.MathUtils.clamp(ratio, 0, 1);
    v.fill.scale.x = Math.max(1e-3, r);
    v.fill.position.x = -(v.barWidth * (1 - r)) / 2;
    (v.fill.material as THREE.MeshBasicMaterial).color.setRGB(
      r > 0.5 ? 1 - (r - 0.5) * 1.2 : 1,
      r > 0.5 ? 0.87 : 0.2 + r * 1.3,
      0.2,
    );
  }

  /** Trigger a hit flash on the body. */
  onHit(entity: number): void {
    const v = this.visuals.get(entity);
    if (v) v.flash = 1;
  }

  /** Show/hide a dummy (death/respawn). */
  setDead(entity: number, dead: boolean): void {
    const v = this.visuals.get(entity);
    if (!v) return;
    v.body.visible = !dead;
    v.bar.visible = !dead;
    if (dead && this.targetEntity === entity) this.reticle.visible = false;
  }

  setTarget(entity: number | null): void {
    this.targetEntity = entity;
  }

  /** Meshes eligible for click-selection (alive dummies). */
  pickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const v of this.visuals.values()) if (v.body.visible) out.push(v.body);
    return out;
  }

  update(camera: THREE.Camera, dt: number): void {
    for (const v of this.visuals.values()) {
      // Billboard the HP bar.
      v.bar.quaternion.copy(camera.quaternion);
      // Decay the hit flash.
      if (v.flash > 0) {
        v.flash = Math.max(0, v.flash - dt * 4);
        v.material.emissive.copy(FLASH_COLOR).multiplyScalar(v.flash);
      }
    }

    const t = this.targetEntity != null ? this.visuals.get(this.targetEntity) : undefined;
    if (t && t.body.visible) {
      this.reticle.visible = true;
      this.reticle.position.set(t.body.position.x, t.baseY + 0.05, t.body.position.z);
      this.reticle.rotation.z += dt * 1.5;
    } else {
      this.reticle.visible = false;
    }
  }
}

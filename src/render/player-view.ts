// The player's avatar: a chunky, low-poly, blocky humanoid built from primitives (no
// asset files) with a class-distinct weapon — Warrior sword + shield, Hunter bow, Priest
// staff — so other players can read your class at a glance. Bold and simple on purpose
// (few parts, solid colours). Animated procedurally: a walk cycle + idle breathing driven
// by speed, and a one-shot swing/draw/cast motion triggered by the AbilityUsed sim event.
// Render-only; the simulation is unaware of it.
//
// Non-destructive note: weapons here are purely cosmetic class identity. They are NOT the
// equipped item — equipped armour/weapons intentionally don't show on the model (yet), so
// a later "show equipped gear" feature can layer on without conflicting with this.

import * as THREE from 'three';
import type { ClassId } from '../core/ecs/components';

/** Vertical offset from the Transform centre (capsule centre) down to the feet. */
const FEET = 0.9; // = PLAYER_HALF

interface Palette {
  torso: number;
  limb: number;
  head: number;
}

const SKIN = 0xd9a878;
const PALETTES: Record<ClassId, Palette> = {
  warrior: { torso: 0x4a5670, limb: 0x39435a, head: SKIN },
  hunter: { torso: 0x3f6b44, limb: 0x2f4d34, head: SKIN },
  priest: { torso: 0xeae4d4, limb: 0xd6cfbc, head: SKIN },
};

function box(w: number, h: number, d: number, color: number, rough = 0.75): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 }),
  );
}

/** A pivot group at a joint, with a chunky limb box hanging below it (rotates about it). */
function limb(x: number, y: number, w: number, h: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const m = box(w, h, d, color);
  m.position.y = -h / 2;
  g.add(m);
  return g;
}

function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

export class PlayerView {
  readonly group = new THREE.Group();
  private body = new THREE.Group(); // upper body (torso/head/arms) — bobs/leans/spins
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group(); // off-hand (shield / bow-hold)
  private armR = new THREE.Group(); // weapon hand (sword / staff / draw)
  private orb: THREE.Mesh | null = null; // priest staff orb (emissive flash)
  private orbBase = 0.5;
  private classId: ClassId | '' = '';

  private t = 0;
  private walkPhase = 0;
  private walkBlend = 0;
  private actionT = 0;
  private actionDur = 0;
  private actionKind = '';

  constructor(scene: THREE.Scene) {
    this.build('warrior');
    scene.add(this.group);
  }

  /** (Re)build the chunky figure for a class — swaps body colour + weapon. */
  private build(classId: ClassId): void {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      disposeTree(c);
    }
    this.classId = classId;
    const p = PALETTES[classId];

    this.body = new THREE.Group();
    this.group.add(this.body);

    // Big chunky torso + a blocky head with simple eyes. (No belts/stripes/visor — kept
    // deliberately simple.)
    const torso = box(0.86, 0.95, 0.5, p.torso);
    torso.position.y = 1.42;
    const head = box(0.66, 0.64, 0.62, p.head);
    head.position.y = 2.06;
    const eyeL = box(0.1, 0.12, 0.04, 0x2a2a30);
    eyeL.position.set(0.15, 2.08, 0.32);
    const eyeR = eyeL.clone();
    eyeR.position.x = -0.15;
    this.body.add(torso, head, eyeL, eyeR);

    // Chunky arms (shoulders near the top of the torso).
    this.armL = limb(0.56, 1.82, 0.26, 0.84, 0.32, p.limb);
    this.armR = limb(-0.56, 1.82, 0.26, 0.84, 0.32, p.limb);
    this.body.add(this.armL, this.armR);

    // Chunky legs (children of the root so they stay grounded while the body bobs).
    this.legL = limb(0.22, 0.92, 0.32, 0.86, 0.36, p.limb);
    this.legR = limb(-0.22, 0.92, 0.32, 0.86, 0.36, p.limb);
    this.group.add(this.legL, this.legR);

    this.orb = null;
    if (classId === 'warrior') this.buildWarrior();
    else if (classId === 'hunter') this.buildHunter();
    else this.buildPriest();
  }

  private buildWarrior(): void {
    // Chunky sword in the right hand: grip + crossguard + a thick blade pointing up.
    const sword = new THREE.Group();
    const grip = box(0.08, 0.26, 0.08, 0x5a3a1e);
    const guard = box(0.36, 0.09, 0.12, 0xc2c6cd, 0.4);
    guard.position.y = 0.16;
    const blade = box(0.13, 0.98, 0.06, 0xd6dbe2, 0.3);
    blade.position.y = 0.7;
    sword.add(grip, guard, blade);
    sword.position.set(0, -0.84, 0.12);
    sword.rotation.set(Math.PI / 4, 0, 0.22); // rest angled forward (~45°), clear of the body
    this.armR.add(sword);

    // Blocky round-ish shield on the left forearm.
    const shield = box(0.56, 0.66, 0.12, 0x8a3b3b, 0.6);
    shield.position.set(0, -0.5, 0.2);
    const boss = box(0.16, 0.16, 0.06, 0xc2c6cd, 0.3);
    boss.position.set(0, -0.5, 0.27);
    this.armL.add(shield, boss);
  }

  private buildHunter(): void {
    // A tall vertical wooden bow held in the left hand + a bowstring chord.
    const bow = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5126, roughness: 0.7 });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 6, 20, Math.PI * 1.4), wood);
    arc.rotation.z = -Math.PI * 0.7;
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 1.0, 4),
      new THREE.MeshStandardMaterial({ color: 0xeae6d8, roughness: 0.5 }),
    );
    string.position.x = -0.36;
    bow.add(arc, string);
    bow.rotation.y = -Math.PI / 2;
    bow.position.set(0.06, -0.84, 0.06);
    this.armL.add(bow);

    // A nocked arrow in the draw (right) hand, pointing forward.
    const arrow = box(0.03, 0.03, 0.7, 0x8a7a55);
    arrow.position.set(0, -0.84, 0.22);
    const tip = box(0.06, 0.06, 0.08, 0xc2c6cd, 0.4);
    tip.position.set(0, -0.84, 0.58);
    this.armR.add(arrow, tip);
  }

  private buildPriest(): void {
    // A chunky staff in the right hand with a glowing orb on top.
    const staff = new THREE.Group();
    const shaft = box(0.08, 2.0, 0.08, 0x6b5a3a);
    shaft.position.y = 0.5;
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 0),
      new THREE.MeshStandardMaterial({
        color: 0xbfe6ff,
        emissive: 0x7fd0ff,
        emissiveIntensity: this.orbBase,
        roughness: 0.3,
      }),
    );
    orb.position.y = 1.55;
    staff.add(shaft, orb);
    staff.position.set(0, -0.8, 0.08);
    staff.rotation.set(Math.PI / 4, 0, 0.18); // rest angled forward (~45°), not dead vertical
    this.armR.add(staff);
    this.orb = orb;
  }

  /** Start a swing/draw/cast motion for an ability (kind chosen by class + targeting). */
  triggerAction(targeting: string, castTime: number): void {
    const cls = this.classId;
    if (cls === 'warrior') {
      this.actionKind = targeting === 'selfAoE' ? 'w-spin' : 'w-swing';
      this.actionDur = this.actionKind === 'w-spin' ? 0.55 : 0.42;
    } else if (cls === 'hunter') {
      this.actionKind = targeting === 'trap' ? 'h-place' : 'h-shoot';
      this.actionDur = this.actionKind === 'h-place' ? 0.5 : 0.45;
    } else {
      const channel = castTime > 0;
      this.actionKind =
        targeting === 'heal' || targeting === 'shield' || targeting === 'toggle' ? 'p-bless' : 'p-cast';
      this.actionDur = channel ? Math.max(0.4, castTime) : 0.5;
    }
    this.actionT = this.actionDur;
  }

  /** Apply the active action to the arms (and body/orb); returns overridden arm angles. */
  private applyAction(p: number, armRx: number, armLx: number): [number, number] {
    const arc = Math.sin(Math.min(1, p) * Math.PI); // 0→1→0 over the action
    switch (this.actionKind) {
      case 'w-swing':
        armRx = -2.2 + 2.9 * easeOut(p);
        armLx = -0.3 * arc;
        this.body.rotation.y = Math.sin(p * Math.PI) * 0.25;
        break;
      case 'w-spin':
        this.body.rotation.y = p * Math.PI * 2;
        armRx = -1.5;
        armLx = -1.2;
        break;
      case 'h-shoot': {
        armLx = -1.55;
        const draw = p < 0.7 ? p / 0.7 : 1 - (p - 0.7) / 0.3;
        armRx = -1.4 - draw * 0.7;
        break;
      }
      case 'h-place':
        armRx = 0.9 * arc;
        armLx = 0.6 * arc;
        this.body.rotation.x += 0.4 * arc;
        break;
      case 'p-cast':
        armRx = -1.7 + 0.7 * arc;
        armLx = -0.4 * arc;
        this.flashOrb(this.orbBase + 2.2 * arc);
        break;
      case 'p-bless':
        armRx = -2.2;
        armLx = -1.6 * arc;
        this.flashOrb(this.orbBase + 1.6 * arc);
        break;
    }
    return [armRx, armLx];
  }

  private flashOrb(intensity: number): void {
    if (this.orb) (this.orb.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
  }

  update(
    x: number,
    y: number,
    z: number,
    yaw: number,
    dt: number,
    speed: number,
    classId: ClassId,
  ): void {
    if (classId !== this.classId) this.build(classId);
    this.t += dt;

    this.group.position.set(x, y - FEET, z);
    this.group.rotation.y = yaw;

    // Walk blend + phase from movement speed.
    const target = Math.min(1, speed / 3.5);
    this.walkBlend += (target - this.walkBlend) * Math.min(1, dt * 10);
    if (speed > 0.05) this.walkPhase += dt * (4.5 + speed * 0.9);
    const wb = this.walkBlend;
    const sw = Math.sin(this.walkPhase);

    // Legs always follow the walk cycle; arms do unless an action overrides them.
    this.legR.rotation.x = sw * 0.6 * wb;
    this.legL.rotation.x = -sw * 0.6 * wb;
    let armRx = -sw * 0.45 * wb;
    let armLx = sw * 0.45 * wb;

    // Body bob (walk) + subtle idle breathing + a slight forward lean while moving.
    const breathe = Math.sin(this.t * 1.6) * 0.025 * (1 - wb);
    this.body.position.y = Math.abs(Math.sin(this.walkPhase * 2)) * 0.07 * wb + breathe;
    this.body.rotation.x = 0.06 * wb;
    this.body.rotation.y = 0;

    if (this.actionT > 0) {
      this.actionT = Math.max(0, this.actionT - dt);
      const p = this.actionDur > 0 ? 1 - this.actionT / this.actionDur : 1;
      [armRx, armLx] = this.applyAction(p, armRx, armLx);
      if (this.actionT === 0) this.flashOrb(this.orbBase);
    }

    this.armR.rotation.x = armRx;
    this.armL.rotation.x = armLx;
  }
}

function easeOut(p: number): number {
  return 1 - (1 - p) * (1 - p);
}

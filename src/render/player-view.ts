// The player's avatar: a procedural low-poly humanoid built from primitives (no asset
// files), with a class-distinct weapon — Warrior sword + shield, Hunter bow, Priest staff
// + halo — so other players can read your class at a glance. Animated procedurally:
// a walk cycle + idle breathing driven by speed, and a one-shot swing/draw/cast motion
// triggered by the AbilityUsed sim event. Render-only; the simulation is unaware of it.
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
  accent: number;
  skin: number;
  belt: number;
}

const PALETTES: Record<ClassId, Palette> = {
  warrior: { torso: 0x49566b, limb: 0x394155, accent: 0xb23b3b, skin: 0xd9b08c, belt: 0x2c2f3a },
  hunter: { torso: 0x3f6b44, limb: 0x2e4a33, accent: 0x7a5c3a, skin: 0xd9b08c, belt: 0x4a3826 },
  priest: { torso: 0xe7e2d4, limb: 0xcfc8b6, accent: 0xd4af37, skin: 0xd9b08c, belt: 0xb9a06a },
};

function box(w: number, h: number, d: number, color: number, rough = 0.7): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 }),
  );
}

/** A pivot group at a joint, with a limb box hanging below it (rotating about the joint). */
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
  private orbBase = 0.4;
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

  /** (Re)build the figure for a class — swaps accent colours, headgear and weapon. */
  private build(classId: ClassId): void {
    // Clear any previous rig.
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      disposeTree(c);
    }
    this.classId = classId;
    const p = PALETTES[classId];

    this.body = new THREE.Group();
    this.group.add(this.body);

    // Torso + chest accent + belt + pelvis + head + face visor.
    const torso = box(0.52, 0.6, 0.3, p.torso);
    torso.position.y = 1.22;
    const accent = box(0.22, 0.5, 0.02, p.accent);
    accent.position.set(0, 1.2, 0.16);
    const belt = box(0.56, 0.1, 0.32, p.belt);
    belt.position.y = 0.95;
    const pelvis = box(0.48, 0.2, 0.3, p.limb);
    pelvis.position.y = 1.0;
    const head = box(0.34, 0.34, 0.32, p.skin);
    head.position.y = 1.72;
    const visor = box(0.3, 0.08, 0.02, 0x20242c);
    visor.position.set(0, 1.74, 0.16);
    this.body.add(torso, accent, belt, pelvis, head, visor);

    // Arms (shoulders at y≈1.5).
    this.armL = limb(0.34, 1.5, 0.15, 0.58, 0.17, p.limb);
    this.armR = limb(-0.34, 1.5, 0.15, 0.58, 0.17, p.limb);
    this.body.add(this.armL, this.armR);

    // Legs (hips at y≈0.95) — children of the root so they stay grounded while the
    // upper body bobs.
    this.legL = limb(0.15, 0.95, 0.18, 0.85, 0.22, p.limb);
    this.legR = limb(-0.15, 0.95, 0.18, 0.85, 0.22, p.limb);
    const footL = box(0.2, 0.12, 0.34, p.belt);
    footL.position.set(0, -0.85, 0.06);
    const footR = footL.clone();
    this.legL.add(footL);
    this.legR.add(footR);
    this.group.add(this.legL, this.legR);

    this.orb = null;
    if (classId === 'warrior') this.buildWarrior(p);
    else if (classId === 'hunter') this.buildHunter(p);
    else this.buildPriest(p);
  }

  private buildWarrior(p: Palette): void {
    // Shoulder pads + a simple helmet crest.
    const padL = box(0.2, 0.16, 0.26, p.accent);
    padL.position.set(0.34, 1.5, 0);
    const padR = padL.clone();
    padR.position.x = -0.34;
    const crest = box(0.06, 0.18, 0.26, p.accent);
    crest.position.set(0, 1.96, 0);
    this.body.add(padL, padR, crest);

    // Sword in the right hand: grip + crossguard + blade pointing up.
    const sword = new THREE.Group();
    const grip = box(0.05, 0.2, 0.05, 0x5a3a1e);
    const guard = box(0.28, 0.06, 0.07, 0xb9bcc4, 0.4);
    guard.position.y = 0.12;
    const blade = box(0.08, 0.72, 0.03, 0xd6dbe2, 0.3);
    blade.position.y = 0.5;
    sword.add(grip, guard, blade);
    sword.position.set(0, -0.6, 0.08);
    this.armR.add(sword);

    // Round shield on the left forearm.
    const shield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.06, 14),
      new THREE.MeshStandardMaterial({ color: 0x8a3b3b, roughness: 0.6, metalness: 0.2 }),
    );
    shield.rotation.x = Math.PI / 2; // face forward (+z)
    shield.position.set(0, -0.42, 0.14);
    const boss = box(0.1, 0.1, 0.04, 0xb0b6bd, 0.3);
    boss.position.set(0, -0.42, 0.18);
    this.armL.add(shield, boss);
  }

  private buildHunter(p: Palette): void {
    // Hood (a low cone over the head).
    const hood = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.4, 6),
      new THREE.MeshStandardMaterial({ color: p.torso, roughness: 0.8 }),
    );
    hood.position.set(0, 1.95, -0.02);
    this.body.add(hood);

    // Bow held in the left hand: a tall vertical wooden arc + a bowstring chord. Built
    // in the local XY plane (belly on +X, opening on −X), then turned 90° so the belly
    // faces forward (+Z) and the string faces the archer.
    const bow = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5126, roughness: 0.7 });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 6, 20, Math.PI * 1.4), wood);
    arc.rotation.z = -Math.PI * 0.7; // centre the 1.4π arc symmetrically about +X
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 0.74, 4),
      new THREE.MeshStandardMaterial({ color: 0xeae6d8, roughness: 0.5 }),
    );
    string.position.x = -0.27; // chord across the open side
    bow.add(arc, string);
    bow.rotation.y = -Math.PI / 2;
    bow.position.set(0.05, -0.58, 0.05);
    this.armL.add(bow);

    // A nocked arrow in the draw (right) hand, pointing forward.
    const arrow = box(0.02, 0.02, 0.55, 0x8a7a55);
    arrow.position.set(0, -0.58, 0.16);
    const tip = box(0.04, 0.04, 0.06, 0xb9bcc4, 0.4);
    tip.position.set(0, -0.58, 0.44);
    this.armR.add(arrow, tip);
  }

  private buildPriest(p: Palette): void {
    // Hood + a holy halo (emissive ring) above the head.
    const hood = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: p.torso, roughness: 0.85 }),
    );
    hood.position.set(0, 1.96, -0.02);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.025, 8, 20),
      new THREE.MeshStandardMaterial({ color: p.accent, emissive: 0xffd870, emissiveIntensity: 0.7, roughness: 0.4 }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 2.12, 0);
    this.body.add(hood, halo);

    // Staff in the right hand: a long shaft with a glowing orb on top.
    const staff = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.7 }),
    );
    shaft.position.y = 0.35;
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12, 0),
      new THREE.MeshStandardMaterial({
        color: 0xbfe6ff,
        emissive: 0x7fd0ff,
        emissiveIntensity: this.orbBase,
        roughness: 0.3,
      }),
    );
    orb.position.y = 1.12;
    staff.add(shaft, orb);
    staff.position.set(0, -0.58, 0.06);
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
      this.actionKind = targeting === 'heal' || targeting === 'shield' || targeting === 'toggle' ? 'p-bless' : 'p-cast';
      this.actionDur = channel ? Math.max(0.4, castTime) : 0.5;
    }
    this.actionT = this.actionDur;
  }

  /** Apply the active action to the arms (and body/orb); returns overridden arm angles. */
  private applyAction(p: number, armRx: number, armLx: number): [number, number] {
    const arc = Math.sin(Math.min(1, p) * Math.PI); // 0→1→0 over the action
    switch (this.actionKind) {
      case 'w-swing': {
        // Overhead wind-up → downward follow-through.
        armRx = -2.2 + 2.9 * easeOut(p);
        armLx = -0.3 * arc;
        this.body.rotation.y = Math.sin(p * Math.PI) * 0.25;
        break;
      }
      case 'w-spin': {
        // A whirling cleave: full body spin, sword arm out.
        this.body.rotation.y = p * Math.PI * 2;
        armRx = -1.5;
        armLx = -1.2;
        break;
      }
      case 'h-shoot': {
        // Raise the bow arm forward, draw the string hand back, then twang.
        armLx = -1.55;
        const draw = p < 0.7 ? p / 0.7 : 1 - (p - 0.7) / 0.3;
        armRx = -1.4 - draw * 0.7;
        break;
      }
      case 'h-place': {
        // Crouch + reach down to set a trap.
        armRx = 0.9 * arc;
        armLx = 0.6 * arc;
        this.body.rotation.x += 0.4 * arc;
        break;
      }
      case 'p-cast': {
        // Thrust the staff forward; orb flares.
        armRx = -1.7 + 0.7 * arc;
        armLx = -0.4 * arc;
        this.flashOrb(0.4 + 2.2 * arc);
        break;
      }
      case 'p-bless': {
        // Raise the staff high; sustained glow.
        armRx = -2.2;
        armLx = -1.6 * arc;
        this.flashOrb(0.4 + 1.6 * arc);
        break;
      }
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
    if (speed > 0.05) this.walkPhase += dt * (5 + speed * 0.9);
    const wb = this.walkBlend;
    const sw = Math.sin(this.walkPhase);

    // Legs always follow the walk cycle; arms do unless an action overrides them.
    this.legR.rotation.x = sw * 0.6 * wb;
    this.legL.rotation.x = -sw * 0.6 * wb;
    let armRx = -sw * 0.45 * wb;
    let armLx = sw * 0.45 * wb;

    // Body bob (walk) + subtle idle breathing + a slight forward lean while moving.
    const breathe = Math.sin(this.t * 1.6) * 0.02 * (1 - wb);
    this.body.position.y = Math.abs(Math.sin(this.walkPhase * 2)) * 0.05 * wb + breathe;
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

// The player's avatar: a chunky, voxel-style humanoid built from box primitives (no asset
// files), skinned per class to read at a glance — a plate Warrior with sword + kite shield,
// a cloaked Ranger with bow + quiver, a robed Priest with a glowing staff. Bold, blocky and
// solid-coloured to match the game's Cube World look. Animated procedurally: a walk cycle +
// idle breathing driven by speed, and a one-shot swing/draw/cast motion triggered by the
// AbilityUsed sim event. Render-only; the simulation is unaware of it.
//
// Non-destructive note: the class kit (armour + weapon) here is purely cosmetic class
// identity, NOT the equipped item — equipped gear intentionally doesn't show on the model
// (yet), so a later "show equipped gear" feature can layer on without conflicting.
//
// The rig: a `body` group (torso/head/arms/pauldrons — bobs/leans/spins) with two arm pivots
// at the shoulders; two leg pivots parented to the root so they stay grounded while the body
// bobs; static drapery (tabards/cloaks/robe skirt) is parented to the root so it hangs clean
// over the swinging legs. Feet sit at local y=0; the whole figure is uniformly scaled by
// MODEL_SCALE (owner-requested: a touch bigger so the detailed models don't look squished).

import * as THREE from 'three';
import type { ClassId } from '../core/ecs/components';

/** Vertical offset from the Transform centre (capsule centre) down to the feet. */
const FEET = 0.9; // = PLAYER_HALF
/** Uniform visual scale of the whole avatar (feet stay grounded — the group origin is at the feet). */
const MODEL_SCALE = 1.22;
/** Unscaled height (m) to the top of the head — used to float the nameplate above the model. */
const HEAD_TOP = 2.42;
/** Rest tilt for a held weapon: leaned so it sits at ~65° above the ground (i.e. 25° off
 *  vertical) — a clean forward diagonal, shared so all three classes match. */
const HOLD_ANGLE = ((90 - 65) * Math.PI) / 180;
/** Sideways tilt for the warrior's shield. */
const SHIELD_ANGLE = (50 * Math.PI) / 180;
/** How far the rider lifts (local m) to sit on the wolf's saddle when mounted. */
const SEAT_Y = 0.78;

const SKIN = 0xd9a878;
const HAIR = 0x6b4526;
const BROW = 0x4a3018;

function box(w: number, h: number, d: number, color: number, rough = 0.75): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 }),
  );
}

/** Create a box, place it at (x,y,z) in `parent`'s local space, add it, and return it (for rotation). */
function put(
  parent: THREE.Object3D,
  w: number, h: number, d: number, color: number,
  x: number, y: number, z: number, rough = 0.75,
): THREE.Mesh {
  const m = box(w, h, d, color, rough);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
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

/** Draw the player's name + level onto the nameplate canvas (matches the enemy style). */
function drawNameplate(ctx: CanvasRenderingContext2D, name: string, level: number): void {
  ctx.clearRect(0, 0, 512, 140);
  const font = "'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Name (auto-shrink to fit long names), warm gold so "you" reads friendly.
  let fs = 56;
  do {
    ctx.font = `bold ${fs}px ${font}`;
    fs -= 2;
  } while (ctx.measureText(name).width > 496 && fs > 26);
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  ctx.strokeText(name, 256, 50);
  ctx.fillStyle = '#f6e7c1';
  ctx.fillText(name, 256, 50);

  // Level line.
  ctx.font = `600 36px ${font}`;
  const lv = `Lv ${level}`;
  ctx.lineWidth = 8;
  ctx.strokeText(lv, 256, 104);
  ctx.fillStyle = '#cdd6e0';
  ctx.fillText(lv, 256, 104);
}

export class PlayerView {
  readonly group = new THREE.Group();
  private readonly scene: THREE.Scene;
  private nameplate: THREE.Sprite | null = null;
  private npCtx: CanvasRenderingContext2D | null = null;
  private npTexture: THREE.CanvasTexture | null = null;
  private npKey = '';
  private figure = new THREE.Group(); // the whole rider (body + legs + drapery) — lifts when mounted
  private body = new THREE.Group(); // upper body (torso/head/arms) — bobs/leans/spins
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group(); // off-hand (shield / bow-hold)
  private armR = new THREE.Group(); // weapon hand (sword / staff / draw)
  private orb: THREE.Mesh | null = null; // priest staff gem (emissive flash)
  private orbBase = 0.6;
  private classId: ClassId | '' = '';
  private mount: THREE.Group | null = null; // persistent wolf mount (shown only while riding)
  private mountLegs: THREE.Group[] = []; // [FL, FR, BL, BR] leg pivots for the trot cycle
  private mountBody: THREE.Group | null = null; // wolf torso — breathes when idle
  private mountHead: THREE.Group | null = null; // wolf head — nods
  private mountTail: THREE.Group | null = null; // wolf tail — sways
  private mountBlend = 0; // 0 on foot → 1 fully mounted (smooths the seat/pose transition)
  private wolfPhase = 0;

  private t = 0;
  private walkPhase = 0;
  private walkBlend = 0;
  private actionT = 0;
  private actionDur = 0;
  private actionKind = '';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.build('warrior');
    this.group.scale.setScalar(MODEL_SCALE);
    scene.add(this.group);
    this.initNameplate();
  }

  /** Create the billboarded name+level sprite that floats above the player's head.
   *  Added to the scene (not the figure group) so a class-switch rebuild can't free it. */
  private initNameplate(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.npCtx = ctx;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.npTexture = texture;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    sprite.scale.set(2.9, 0.8, 1);
    this.nameplate = sprite;
    this.scene.add(sprite);
  }

  /** Set the name + level shown on the overhead plate (redraws only when it changes). */
  setLabel(name: string, level: number): void {
    const key = `${name}|${level}`;
    if (key === this.npKey || !this.npCtx || !this.npTexture) return;
    this.npKey = key;
    drawNameplate(this.npCtx, name || 'Adventurer', level);
    this.npTexture.needsUpdate = true;
  }

  /** (Re)build the voxel figure for a class — fresh body + rig + class kit. */
  private build(classId: ClassId): void {
    for (const c of [...this.group.children]) {
      if (c === this.mount) continue; // keep the persistent mount across class rebuilds
      this.group.remove(c);
      disposeTree(c);
    }
    this.classId = classId;
    this.orb = null;

    // Fresh rig under a `figure` group (so the whole rider can lift onto the mount). Arms
    // pivot at the shoulders (children of the body so they follow its lean); legs pivot at
    // the hips (children of the figure so they stay grounded as the body bobs).
    this.figure = new THREE.Group();
    this.group.add(this.figure);
    this.body = new THREE.Group();
    this.figure.add(this.body);
    this.armL = new THREE.Group(); this.armL.position.set(0.56, 1.82, 0); this.body.add(this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(-0.56, 1.82, 0); this.body.add(this.armR);
    this.legL = new THREE.Group(); this.legL.position.set(0.24, 0.92, 0); this.figure.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(-0.24, 0.92, 0); this.figure.add(this.legR);

    if (classId === 'warrior') this.buildWarrior();
    else if (classId === 'hunter') this.buildHunter();
    else this.buildPriest();

    // Build the wolf mount once; it persists across class switches (hidden until riding).
    if (!this.mount) {
      const wolf = buildWolf();
      this.mount = wolf.group;
      this.mountLegs = wolf.legs;
      this.mountBody = wolf.body;
      this.mountHead = wolf.head;
      this.mountTail = wolf.tail;
      this.mount.visible = false;
      this.group.add(this.mount);
    }
  }

  /** Skin+hair+eyes shared by every class (hair styling is added by the caller). */
  private buildFace(eyeColor: number): void {
    const b = this.body;
    put(b, 0.62, 0.58, 0.58, SKIN, 0, 2.04, 0);            // head
    put(b, 0.16, 0.05, 0.04, BROW, 0.15, 2.15, 0.30);    // brows
    put(b, 0.16, 0.05, 0.04, BROW, -0.15, 2.15, 0.30);
    put(b, 0.09, 0.11, 0.04, 0xffffff, 0.15, 2.04, 0.30, 0.4); // eye whites
    put(b, 0.09, 0.11, 0.04, 0xffffff, -0.15, 2.04, 0.30, 0.4);
    put(b, 0.07, 0.09, 0.05, eyeColor, 0.15, 2.03, 0.31, 0.35); // irises
    put(b, 0.07, 0.09, 0.05, eyeColor, -0.15, 2.03, 0.31, 0.35);
    put(b, 0.16, 0.05, 0.04, 0x9c6b45, 0, 1.86, 0.30);   // mouth line
  }

  // ── Warrior: steel plate over a navy gambeson, red scarf/tabard, sword + kite shield ──
  private buildWarrior(): void {
    const b = this.body;
    const STEEL = 0x969ca6, STEEL_DK = 0x6c727c, STEEL_LT = 0xb6bcc4;
    const NAVY = 0x2c3346, NAVY_DK = 0x232838;
    const RED = 0x8f3a34, LEATHER = 0x5a3a1e, LEATHER_DK = 0x3f2814;
    const GOLD = 0xc9a94e, BLADE = 0xd6dbe2, SHIELD = 0x2f3e63;

    this.buildFace(0x2f5fa0);
    // Tufty brown hair.
    put(b, 0.7, 0.24, 0.66, HAIR, 0, 2.36, 0);
    put(b, 0.62, 0.16, 0.12, HAIR, 0, 2.28, 0.28);
    put(b, 0.12, 0.42, 0.5, HAIR, 0.33, 2.12, -0.02);
    put(b, 0.12, 0.42, 0.5, HAIR, -0.33, 2.12, -0.02);
    put(b, 0.66, 0.3, 0.14, HAIR, 0, 2.22, -0.3);
    for (const [hx, hz] of [[-0.2, 0.1], [0.05, 0.16], [0.24, 0.02], [-0.28, -0.05]] as const)
      put(b, 0.18, 0.14, 0.18, HAIR, hx, 2.5, hz);

    // Red scarf bunched at the collar (sits below the chin).
    put(b, 0.56, 0.2, 0.18, RED, 0, 1.68, 0.2);
    put(b, 0.2, 0.26, 0.46, RED, 0.24, 1.7, 0);
    put(b, 0.2, 0.26, 0.46, RED, -0.24, 1.7, 0);
    put(b, 0.5, 0.28, 0.16, RED, 0, 1.64, -0.22);

    // Torso: navy gambeson core + steel chest plate + baldric + belt.
    put(b, 0.8, 0.92, 0.46, NAVY, 0, 1.42, 0);
    put(b, 0.74, 0.54, 0.5, STEEL, 0, 1.58, 0.02);
    put(b, 0.16, 0.5, 0.52, STEEL_LT, 0, 1.58, 0.03);
    put(b, 0.74, 0.06, 0.5, GOLD, 0, 1.32, 0.02);       // waist trim of the plate
    put(b, 0.12, 1.12, 0.05, LEATHER, 0, 1.46, 0.26).rotation.z = -0.6; // baldric across chest
    put(b, 0.86, 0.16, 0.5, LEATHER, 0, 1.0, 0);         // belt
    put(b, 0.2, 0.18, 0.06, GOLD, 0, 1.0, 0.25);         // buckle

    // Steel pauldrons with gold trim (on the body so they sit still as the arms swing).
    for (const s of [1, -1]) {
      put(b, 0.42, 0.3, 0.46, STEEL, 0.56 * s, 1.86, 0);
      put(b, 0.44, 0.14, 0.48, STEEL_DK, 0.56 * s, 1.98, 0);
      put(b, 0.44, 0.05, 0.49, GOLD, 0.56 * s, 1.77, 0);
    }

    // Arms: navy upper, leather bracer with gold trim, steel gauntlet.
    for (const arm of [this.armL, this.armR]) {
      put(arm, 0.28, 0.42, 0.32, NAVY_DK, 0, -0.22, 0);
      put(arm, 0.3, 0.34, 0.34, LEATHER, 0, -0.58, 0);
      put(arm, 0.31, 0.05, 0.35, GOLD, 0, -0.42, 0);
      put(arm, 0.26, 0.2, 0.3, STEEL, 0, -0.84, 0);
    }

    // Legs: navy trousers, steel knee guard + gold trim, brown boots.
    for (const leg of [this.legL, this.legR]) {
      put(leg, 0.34, 0.46, 0.38, NAVY, 0, -0.24, 0);
      put(leg, 0.36, 0.16, 0.4, STEEL, 0, -0.5, 0.02);
      put(leg, 0.36, 0.05, 0.41, GOLD, 0, -0.42, 0.03);
      put(leg, 0.32, 0.24, 0.36, NAVY_DK, 0, -0.68, 0);
      put(leg, 0.36, 0.2, 0.4, LEATHER, 0, -0.84, 0.04);
      put(leg, 0.36, 0.14, 0.18, LEATHER_DK, 0, -0.88, 0.24);
    }

    // Red tabard hanging over the groin (figure-parented so it stays over the legs and
    // lifts with the rider when mounted).
    put(this.figure, 0.42, 0.82, 0.08, RED, 0, 0.56, 0.25);
    put(this.figure, 0.3, 0.2, 0.08, RED, 0, 0.18, 0.25);
    put(this.figure, 0.44, 0.06, 0.09, GOLD, 0, 0.94, 0.25);

    // Sword slung diagonally across the back (hilt over the left shoulder).
    const back = new THREE.Group();
    back.position.set(0.05, 1.45, -0.32);
    back.rotation.set(0.12, 0, -0.7);
    put(back, 0.15, 1.3, 0.11, LEATHER_DK, 0, 0, 0);
    put(back, 0.36, 0.09, 0.13, GOLD, 0, 0.62, 0);
    put(back, 0.08, 0.24, 0.09, LEATHER, 0, 0.75, 0);
    put(back, 0.13, 0.13, 0.13, GOLD, 0, 0.9, 0);
    b.add(back);

    // Bigger (beefier) sword in the right hand, held at a forward angle (swings up on attack).
    const sword = new THREE.Group();
    sword.position.set(0, -0.84, 0.16);
    sword.rotation.x = -HOLD_ANGLE;
    put(sword, 0.15, 0.15, 0.15, GOLD, 0, 0.18, 0);        // pommel
    put(sword, 0.1, 0.3, 0.1, LEATHER, 0, 0, 0);           // grip
    put(sword, 0.5, 0.14, 0.15, GOLD, 0, -0.2, 0);         // crossguard
    put(sword, 0.2, 0.82, 0.07, BLADE, 0, -0.63, 0, 0.3);  // blade (wider)
    put(sword, 0.14, 0.22, 0.07, BLADE, 0, -1.14, 0, 0.3); // tip
    this.armR.add(sword);

    // Bigger navy kite shield (gold border + gold diamond emblem) angled out to the side.
    const shield = new THREE.Group();
    shield.position.set(0.14, -0.5, 0.2);
    shield.rotation.y = SHIELD_ANGLE;
    put(shield, 0.84, 1.3, 0.07, GOLD, 0, 0.02, -0.02);    // gold border (shows around the plates)
    put(shield, 0.74, 0.64, 0.09, SHIELD, 0, 0.28, 0.02);
    put(shield, 0.64, 0.5, 0.09, SHIELD, 0, -0.22, 0.02);
    put(shield, 0.4, 0.42, 0.09, SHIELD, 0, -0.66, 0.02);
    put(shield, 0.2, 0.56, 0.05, GOLD, 0, 0.02, 0.09);     // emblem: vertical bar
    put(shield, 0.3, 0.3, 0.05, GOLD, 0, 0.02, 0.09).rotation.z = Math.PI / 4; // emblem: diamond
    put(shield, 0.15, 0.15, 0.06, SHIELD, 0, 0.02, 0.12).rotation.z = Math.PI / 4; // diamond centre
    this.armL.add(shield);
  }

  // ── Ranger: green cloak + hood, leather armour with a gold stag, bow + back quiver ──
  private buildHunter(): void {
    const b = this.body;
    const GREEN = 0x415f30, GREEN_DK = 0x2f4826;
    const LEATHER = 0x5a3a1e, LEATHER_DK = 0x3f2814, LEATHER_LT = 0x6e4a2a;
    const GOLD = 0xc9a94e, WOOD = 0x7a5126, STRING = 0xd8d2c0, FLETCH = 0xeae6d8;

    this.buildFace(0x3f6b3a);
    // Brown hair under a pushed-back green hood.
    put(b, 0.68, 0.22, 0.62, HAIR, 0, 2.34, 0);
    put(b, 0.6, 0.14, 0.12, HAIR, 0, 2.28, 0.28);
    put(b, 0.12, 0.36, 0.48, HAIR, 0.32, 2.14, -0.02);
    put(b, 0.12, 0.36, 0.48, HAIR, -0.32, 2.14, -0.02);
    for (const [hx, hz] of [[-0.18, 0.08], [0.14, 0.12], [0.24, -0.04]] as const)
      put(b, 0.16, 0.12, 0.16, HAIR, hx, 2.48, hz);
    put(b, 0.56, 0.34, 0.24, GREEN, 0, 1.82, -0.26);      // hood bunched behind the neck
    put(b, 0.7, 0.22, 0.34, GREEN_DK, 0, 1.68, -0.2);

    // Torso: green tunic + leather harness + gold stag emblem + belt.
    put(b, 0.8, 0.92, 0.46, GREEN, 0, 1.42, 0);
    put(b, 0.72, 0.52, 0.5, LEATHER, 0, 1.6, 0.02);
    put(b, 0.72, 0.06, 0.5, LEATHER_LT, 0, 1.36, 0.02);
    put(b, 0.12, 1.1, 0.05, LEATHER, 0, 1.46, 0.26).rotation.z = 0.6; // quiver strap
    put(b, 0.86, 0.16, 0.5, LEATHER, 0, 1.0, 0);          // belt
    put(b, 0.2, 0.18, 0.06, GOLD, 0, 1.0, 0.25);          // buckle
    put(b, 0.22, 0.2, 0.06, LEATHER_DK, 0.36, 1.0, 0.22); // belt pouch
    // Gold stag emblem on the chest (face + antlers).
    put(b, 0.16, 0.18, 0.04, GOLD, 0, 1.52, 0.27);
    for (const s of [1, -1]) {
      put(b, 0.06, 0.16, 0.04, GOLD, 0.1 * s, 1.66, 0.27).rotation.z = 0.4 * s;
      put(b, 0.06, 0.12, 0.04, GOLD, 0.18 * s, 1.74, 0.27).rotation.z = 0.6 * s;
      put(b, 0.05, 0.09, 0.04, GOLD, 0.05 * s, 1.72, 0.27);
    }

    // Layered leather pauldrons with a gold stud.
    for (const s of [1, -1]) {
      put(b, 0.42, 0.28, 0.46, LEATHER, 0.56 * s, 1.86, 0);
      put(b, 0.44, 0.14, 0.48, LEATHER_LT, 0.56 * s, 1.96, 0);
      put(b, 0.1, 0.1, 0.1, GOLD, 0.56 * s, 1.86, 0.24);
    }

    // Arms: green sleeve, leather bracer, dark glove.
    for (const arm of [this.armL, this.armR]) {
      put(arm, 0.28, 0.42, 0.32, GREEN_DK, 0, -0.22, 0);
      put(arm, 0.3, 0.32, 0.34, LEATHER, 0, -0.58, 0);
      put(arm, 0.31, 0.05, 0.35, GOLD, 0, -0.44, 0);
      put(arm, 0.26, 0.2, 0.3, LEATHER_DK, 0, -0.84, 0);
    }

    // Legs: dark-green trousers, leather boots with gold trim.
    for (const leg of [this.legL, this.legR]) {
      put(leg, 0.34, 0.5, 0.38, GREEN_DK, 0, -0.26, 0);
      put(leg, 0.32, 0.26, 0.36, LEATHER, 0, -0.62, 0);
      put(leg, 0.36, 0.22, 0.4, LEATHER, 0, -0.84, 0.04);
      put(leg, 0.36, 0.05, 0.41, GOLD, 0, -0.74, 0.05);
      put(leg, 0.36, 0.14, 0.18, LEATHER_DK, 0, -0.88, 0.24);
    }

    // Big quiver spanning the whole back (leather case + a fan of arrows over the shoulder).
    const quiver = new THREE.Group();
    quiver.position.set(-0.02, 1.34, -0.34);
    quiver.rotation.z = 0.12;
    put(quiver, 0.44, 1.06, 0.24, LEATHER, 0, 0, 0);      // case (covers the back)
    put(quiver, 0.48, 0.1, 0.28, LEATHER_LT, 0, 0.5, 0);  // top rim
    put(quiver, 0.48, 0.1, 0.28, LEATHER_DK, 0, -0.42, 0); // bottom cap
    put(quiver, 0.5, 0.08, 0.26, LEATHER_DK, 0, 0.16, 0);  // strap band
    for (const [ax, az] of [[-0.14, 0], [-0.05, 0.05], [0.05, 0.02], [0.14, -0.03]] as const) {
      put(quiver, 0.045, 0.6, 0.045, WOOD, ax, 0.62, az);  // shafts
      put(quiver, 0.08, 0.2, 0.08, FLETCH, ax, 0.98, az);  // white fletching
    }
    b.add(quiver);

    // Bigger recurve bow carried in the left hand — gripped mid-riser, nearly vertical.
    const bow = new THREE.Group();
    bow.position.set(0.2, -0.86, 0.2);
    bow.rotation.x = (12 * Math.PI) / 180; // only a slight forward lean (mostly vertical)
    put(bow, 0.12, 0.62, 0.12, WOOD, 0, 0, 0);              // riser (grip, at the hand)
    put(bow, 0.09, 0.64, 0.1, WOOD, 0, 0.56, 0.08).rotation.x = -0.4;  // upper limb (bows forward)
    put(bow, 0.07, 0.42, 0.09, WOOD, 0, 0.94, 0.03).rotation.x = 0.5;  // upper tip (recurves back)
    put(bow, 0.09, 0.64, 0.1, WOOD, 0, -0.56, 0.08).rotation.x = 0.4;  // lower limb
    put(bow, 0.07, 0.42, 0.09, WOOD, 0, -0.94, 0.03).rotation.x = -0.5; // lower tip
    put(bow, 0.03, 2.2, 0.03, STRING, 0, 0, -0.04, 0.5);   // string (straight, near side)
    this.armL.add(bow);
  }

  // ── Priest: hooded cream robe with gold trim, blue front + cross, gem staff ──
  private buildPriest(): void {
    const b = this.body;
    const ROBE = 0xe8e0cc, ROBE_LT = 0xf2ecda, ROBE_SH = 0xd6ccb4;
    const BLUE = 0x39568a, GOLD = 0xc9a94e, GOLD_DK = 0xa8842e;
    const GEM = 0x4aa8e8, BELT = 0x5a3a1e, STAFF = 0x4a3a2a;

    this.buildFace(0x2f5fa0);
    // Brown fringe peeking out under a raised cream hood with gold trim.
    put(b, 0.5, 0.14, 0.1, HAIR, 0, 2.24, 0.27);
    put(b, 0.12, 0.24, 0.2, HAIR, 0.28, 2.1, 0.2);
    put(b, 0.12, 0.24, 0.2, HAIR, -0.28, 2.1, 0.2);
    put(b, 0.8, 0.3, 0.78, ROBE, 0, 2.44, -0.02);          // hood crown
    put(b, 0.76, 0.64, 0.22, ROBE, 0, 2.12, -0.34);        // hood back
    put(b, 0.18, 0.72, 0.66, ROBE, 0.36, 2.06, 0.02);      // hood side
    put(b, 0.18, 0.72, 0.66, ROBE, -0.36, 2.06, 0.02);
    put(b, 0.72, 0.16, 0.22, ROBE, 0, 2.36, 0.28);         // hood brow
    put(b, 0.74, 0.06, 0.24, GOLD, 0, 2.28, 0.3);          // gold trim on the hood brow
    put(b, 0.06, 0.6, 0.66, GOLD, 0.37, 2.06, 0.06);       // gold trim down the hood sides
    put(b, 0.06, 0.6, 0.66, GOLD, -0.37, 2.06, 0.06);

    // Robe torso: cream core, blue front panel + gold trims + a gold cross.
    put(b, 0.84, 0.96, 0.5, ROBE, 0, 1.42, 0);
    put(b, 0.34, 0.94, 0.52, BLUE, 0, 1.4, 0.01);
    put(b, 0.05, 0.94, 0.53, GOLD, 0.19, 1.4, 0.02);
    put(b, 0.05, 0.94, 0.53, GOLD, -0.19, 1.4, 0.02);
    put(b, 0.08, 0.32, 0.04, GOLD, 0, 1.36, 0.28);         // cross: vertical
    put(b, 0.24, 0.08, 0.04, GOLD, 0, 1.44, 0.28);         // cross: horizontal

    // Ornate gold-and-cream mantle over the shoulders, with blue gems.
    put(b, 0.9, 0.3, 0.58, ROBE_LT, 0, 1.84, 0);
    put(b, 0.91, 0.08, 0.59, GOLD, 0, 1.72, 0);
    put(b, 0.48, 0.16, 0.3, GOLD, 0, 1.88, 0.18);          // gold collar (front)
    put(b, 0.09, 0.09, 0.06, GEM, 0, 1.9, 0.32, 0.3);
    for (const s of [1, -1]) {
      put(b, 0.32, 0.18, 0.42, GOLD, 0.5 * s, 1.9, 0);     // gold shoulder cap
      put(b, 0.32, 0.06, 0.44, ROBE_LT, 0.5 * s, 2.0, 0);
      put(b, 0.09, 0.09, 0.09, GEM, 0.5 * s, 1.9, 0.23, 0.3);
    }
    // Brown belt + round gold buckle.
    put(b, 0.86, 0.16, 0.52, BELT, 0, 1.02, 0);
    put(b, 0.22, 0.2, 0.06, GOLD, 0, 1.02, 0.26);

    // Wide robed sleeves: cream, gold cuff, brown glove.
    for (const arm of [this.armL, this.armR]) {
      put(arm, 0.36, 0.5, 0.42, ROBE, 0, -0.26, 0);
      put(arm, 0.34, 0.1, 0.44, GOLD, 0, -0.54, 0);
      put(arm, 0.3, 0.22, 0.36, ROBE_SH, 0, -0.7, 0);
      put(arm, 0.24, 0.2, 0.28, BELT, 0, -0.86, 0);
    }

    // Full robed legs (cream) + shoes with a gold ankle trim (no separate skirt).
    for (const leg of [this.legL, this.legR]) {
      put(leg, 0.36, 0.72, 0.4, ROBE, 0, -0.42, 0);
      put(leg, 0.37, 0.06, 0.42, ROBE_SH, 0, -0.06, 0);
      put(leg, 0.34, 0.24, 0.46, BELT, 0, -0.84, 0.06);
      put(leg, 0.35, 0.05, 0.47, GOLD, 0, -0.72, 0.06);
    }
    // Short blue front drape from the belt (keeps the robe's blue + gold front, no leg skirt).
    put(this.figure, 0.32, 0.66, 0.1, BLUE, 0, 0.62, 0.24);
    put(this.figure, 0.05, 0.66, 0.11, GOLD, 0.17, 0.62, 0.24);
    put(this.figure, 0.05, 0.66, 0.11, GOLD, -0.17, 0.62, 0.24);
    put(this.figure, 0.34, 0.06, 0.12, GOLD, 0, 0.31, 0.24);

    // Ornate staff in the right hand, gripped near the MIDDLE of the shaft (shaft centred on
    // the group origin) and held at a bolder forward angle than the other classes.
    const staff = new THREE.Group();
    staff.position.set(0, -0.82, 0.12);
    staff.rotation.set((42 * Math.PI) / 180, 0, 0.1);
    put(staff, 0.08, 2.0, 0.08, STAFF, 0, 0, 0);          // shaft (centre at the hand)
    put(staff, 0.1, 0.07, 0.1, GOLD, 0, -0.9, 0);         // butt cap
    put(staff, 0.1, 0.07, 0.1, GOLD_DK, 0, -0.25, 0);     // grip ring
    put(staff, 0.1, 0.07, 0.1, GOLD, 0, 0.55, 0);         // upper ring
    // Gold diamond frame around the gem near the top (four bars).
    for (const [dx, dy] of [[0, 0.22], [0, -0.22], [0.22, 0], [-0.22, 0]] as const)
      put(staff, 0.12, 0.12, 0.07, GOLD, dx, 0.92 + dy, 0).rotation.z = Math.PI / 4;
    const gem = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.17, 0),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: GEM, emissiveIntensity: this.orbBase, roughness: 0.25 }),
    );
    gem.position.set(0, 0.92, 0);
    staff.add(gem);
    this.armR.add(staff);
    this.orb = gem;
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
    mounted = false,
  ): void {
    if (classId !== this.classId) this.build(classId);
    this.t += dt;

    this.group.position.set(x, y - FEET, z);
    this.group.rotation.y = yaw;

    // Mount blend (smooth seat/dismount) + lift the rider onto the wolf.
    this.mountBlend += ((mounted ? 1 : 0) - this.mountBlend) * Math.min(1, dt * 8);
    const mb = this.mountBlend;
    if (this.mount) this.mount.visible = mb > 0.02;
    this.figure.position.y = SEAT_Y * mb;

    // Float the name+level plate above the (scaled) head — higher when sat up on the wolf.
    if (this.nameplate)
      this.nameplate.position.set(x, y - FEET + (HEAD_TOP + 0.55 + SEAT_Y * mb) * MODEL_SCALE, z);

    // Walk blend + phase from movement speed (leg-walk is suppressed while mounted).
    const target = Math.min(1, speed / 3.5);
    this.walkBlend += (target - this.walkBlend) * Math.min(1, dt * 10);
    if (speed > 0.05) this.walkPhase += dt * (4.5 + speed * 0.9);
    const wb = this.walkBlend * (1 - mb);
    const sw = Math.sin(this.walkPhase);

    // Legs: walk cycle on foot; astride (dropped down the wolf's sides, splayed) while
    // mounted — mostly hanging with a slight forward angle so they clear the barrel.
    this.legR.rotation.x = sw * 0.6 * wb + 0.36 * mb;
    this.legL.rotation.x = -sw * 0.6 * wb + 0.36 * mb;
    this.legR.rotation.z = -0.44 * mb;
    this.legL.rotation.z = 0.44 * mb;
    let armRx = -sw * 0.45 * wb + 0.3 * mb;
    let armLx = sw * 0.45 * wb + 0.3 * mb;

    // Body bob/breathing (suppressed while mounted) + a slight forward lean.
    const breathe = Math.sin(this.t * 1.6) * 0.025 * (1 - this.walkBlend);
    this.body.position.y = (Math.abs(Math.sin(this.walkPhase * 2)) * 0.07 * wb + breathe) * (1 - mb);
    this.body.rotation.x = 0.06 * wb + 0.1 * mb;
    this.body.rotation.y = 0;

    // Ability action overrides the arms (and body) — suppressed while mounted to avoid odd
    // seated swings, but its timer/orb still resolve.
    if (this.actionT > 0) {
      this.actionT = Math.max(0, this.actionT - dt);
      if (mb < 0.5) {
        const p = this.actionDur > 0 ? 1 - this.actionT / this.actionDur : 1;
        [armRx, armLx] = this.applyAction(p, armRx, armLx);
      }
      if (this.actionT === 0) this.flashOrb(this.orbBase);
    }

    this.armR.rotation.x = armRx;
    this.armL.rotation.x = armLx;

    // Wolf idle + trot while ridden: a breathing body bob (the rider rides along with it), a
    // swaying tail and gentle head nod when standing, and a diagonal-pair leg trot that ramps
    // with speed — so it never looks frozen when AFK.
    if (this.mount && mb > 0.02) {
      const trot = Math.min(1, speed / 6);
      const still = 1 - Math.min(1, speed / 2);
      const breathe = Math.sin(this.t * 1.6) * 0.04 * still * mb;
      this.mountBody!.position.y = breathe;
      this.figure.position.y = SEAT_Y * mb + breathe; // the rider breathes with the mount
      this.mountTail!.rotation.y = Math.sin(this.t * 2.3) * (0.14 + 0.16 * still) * mb;
      this.mountHead!.rotation.x = Math.sin(this.t * 1.6 + 0.7) * 0.06 * still * mb;
      this.mountHead!.rotation.y = Math.sin(this.t * 0.9) * 0.04 * still * mb;
      if (speed > 0.05) this.wolfPhase += dt * (2.5 + speed * 0.8);
      const ws = Math.sin(this.wolfPhase) * 0.5 * trot * mb;
      const signs = [1, -1, -1, 1]; // FL, FR, BL, BR
      for (let i = 0; i < this.mountLegs.length; i++) this.mountLegs[i].rotation.x = ws * signs[i];
    }
  }
}

function easeOut(p: number): number {
  return 1 - (1 - p) * (1 - p);
}

// ── The wolf mount ────────────────────────────────────────────────────────────
// A chunky voxel dire-wolf (grey back, cream underside + legs, amber eyes) with a leather
// saddle, chest harness with a gold medallion, and rear saddlebags — faithful to the
// reference. Feet at y=0, facing +Z (same as the rider). Returns the group plus the four
// leg pivots [FL, FR, BL, BR] for the trot cycle. Scaled with the player (a child of the
// scaled root). The saddle seat sits at ~y1.82 so the lifted rider (SEAT_Y) straddles it.
interface Wolf {
  group: THREE.Group;
  legs: THREE.Group[];
  body: THREE.Group; // torso/neck/saddle/harness — breathes (subtle Y bob) when idle
  head: THREE.Group; // nods gently
  tail: THREE.Group; // sways
}
function buildWolf(): Wolf {
  const g = new THREE.Group();
  g.name = 'wolf-mount';
  const FUR_DK = 0x4a4952, FUR = 0x6d6a70, FUR_LT = 0xcdbb98, FUR_TAN = 0xa8906e;
  const NOSE = 0x1b1a1e, EYE = 0xd8a12a;
  const SADDLE = 0x6e4a2e, SADDLE_DK = 0x4f3622, SEATR = 0x7d3a2a, GOLD = 0xc9a94e, STRAP = 0x5a3a1e;

  // The body carries everything except the (planted) legs, so it can breathe as one unit.
  // The head + tail are pivoted sub-groups of the body so they can nod / sway on top of it.
  const body = new THREE.Group();
  g.add(body);
  const head = new THREE.Group(); head.position.set(0, 1.62, 1.15); body.add(head);
  const tail = new THREE.Group(); tail.position.set(0, 1.5, -1.15); body.add(tail);

  // Torso + dark back, cream belly, rear haunch, front chest, neck + mane.
  put(body, 0.82, 0.8, 1.5, FUR, 0, 1.2, -0.15);
  put(body, 0.72, 0.26, 1.5, FUR_DK, 0, 1.5, -0.15);
  put(body, 0.7, 0.32, 1.4, FUR_LT, 0, 0.9, -0.15);
  put(body, 0.86, 0.86, 0.62, FUR, 0, 1.16, -0.95);
  put(body, 0.72, 0.3, 0.62, FUR_DK, 0, 1.52, -0.95);
  put(body, 0.78, 0.78, 0.5, FUR, 0, 1.14, 0.62);
  put(body, 0.62, 0.42, 0.5, FUR_LT, 0, 0.9, 0.64);
  put(body, 0.52, 0.66, 0.5, FUR, 0, 1.54, 0.95);   // neck
  put(body, 0.44, 0.32, 0.5, FUR_DK, 0, 1.82, 0.92); // mane

  // Head (relative to the head pivot at 0,1.62,1.15): snout, nose, ears, amber eyes, brow.
  put(head, 0.56, 0.52, 0.56, FUR, 0, 0.1, 0.27);
  put(head, 0.5, 0.28, 0.32, FUR_LT, 0, -0.07, 0.41);
  put(head, 0.34, 0.34, 0.42, FUR_LT, 0, -0.02, 0.65);
  put(head, 0.18, 0.14, 0.12, NOSE, 0, 0.04, 0.85);
  for (const s of [1, -1]) {
    put(head, 0.16, 0.26, 0.14, FUR_DK, 0.18 * s, 0.4, 0.19);
    put(head, 0.09, 0.14, 0.09, FUR_TAN, 0.18 * s, 0.38, 0.25);
    put(head, 0.1, 0.12, 0.08, EYE, 0.17 * s, 0.16, 0.54);
    put(head, 0.15, 0.05, 0.07, FUR_DK, 0.17 * s, 0.25, 0.53);
  }

  // Bushy tail (relative to the tail pivot at 0,1.5,-1.15), sweeping up and back.
  put(tail, 0.32, 0.32, 0.5, FUR, 0, 0, -0.19).rotation.x = -0.6;
  put(tail, 0.36, 0.36, 0.5, FUR_DK, 0, 0.28, -0.43).rotation.x = -0.5;
  put(tail, 0.26, 0.26, 0.3, FUR_LT, 0, 0.5, -0.63).rotation.x = -0.5;

  // Four legs (pivot groups for the trot) — planted on the root so they don't lift as the
  // body breathes: upper fur, cream shin, dark paw.
  const legs: THREE.Group[] = [];
  const makeLeg = (x: number, z: number, topY: number): THREE.Group => {
    const L = new THREE.Group();
    L.position.set(x, topY, z);
    put(L, 0.26, 0.5, 0.28, FUR, 0, -0.24, 0);
    put(L, 0.2, 0.52, 0.22, FUR_LT, 0, -0.72, 0.02);
    put(L, 0.24, 0.16, 0.34, NOSE, 0, -1.0, 0.07);
    g.add(L);
    legs.push(L);
    return L;
  };
  makeLeg(0.3, 0.52, 1.14);   // FL
  makeLeg(-0.3, 0.52, 1.14);  // FR
  makeLeg(0.32, -0.78, 1.2);  // BL
  makeLeg(-0.32, -0.78, 1.2); // BR

  // Saddle: blanket, seat + gold rim, pommel/cantle, side skirts.
  put(body, 0.88, 0.14, 1.02, SADDLE_DK, 0, 1.62, -0.1);
  put(body, 0.68, 0.16, 0.82, SADDLE, 0, 1.74, -0.1);
  put(body, 0.52, 0.14, 0.58, SEATR, 0, 1.82, -0.1);
  put(body, 0.56, 0.05, 0.64, GOLD, 0, 1.9, -0.1);
  put(body, 0.36, 0.22, 0.16, SADDLE_DK, 0, 1.92, 0.26);   // pommel
  put(body, 0.4, 0.05, 0.18, GOLD, 0, 2.03, 0.26);
  put(body, 0.42, 0.26, 0.16, SADDLE_DK, 0, 1.96, -0.46);  // cantle
  put(body, 0.46, 0.05, 0.18, GOLD, 0, 2.09, -0.46);
  put(body, 0.1, 0.42, 0.72, SADDLE, 0.45, 1.48, -0.1);    // side skirts
  put(body, 0.1, 0.42, 0.72, SADDLE, -0.45, 1.48, -0.1);
  // Rear saddlebags with gold buckles.
  for (const s of [1, -1]) {
    put(body, 0.16, 0.42, 0.36, SADDLE, 0.48 * s, 1.32, -0.6);
    put(body, 0.18, 0.14, 0.38, SADDLE_DK, 0.48 * s, 1.5, -0.6);
    put(body, 0.08, 0.1, 0.1, GOLD, 0.55 * s, 1.34, -0.44);
  }

  // Harness: chest strap + a gold medallion, and a girth band round the barrel.
  put(body, 0.82, 0.14, 0.14, STRAP, 0, 1.16, 0.86);
  put(body, 0.14, 0.6, 0.12, STRAP, 0.34, 1.35, 0.7).rotation.x = -0.3;
  put(body, 0.14, 0.6, 0.12, STRAP, -0.34, 1.35, 0.7).rotation.x = -0.3;
  put(body, 0.22, 0.22, 0.1, GOLD, 0, 1.02, 0.9);
  put(body, 0.11, 0.11, 0.12, SADDLE_DK, 0, 1.02, 0.93);
  put(body, 0.86, 0.14, 0.34, STRAP, 0, 1.18, 0.18);

  return { group: g, legs, body, head, tail };
}

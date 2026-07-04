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
/** Local Y the player's head pivots about (neck base) so it can nod/turn on the torso. */
const HEAD_PIVOT = 1.72;

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
  private body = new THREE.Group(); // upper body (torso/arms) — bobs/leans/twists
  private head = new THREE.Group(); // head + hair (child of body) — nods/turns
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
    this.head = new THREE.Group(); this.head.position.set(0, HEAD_PIVOT, 0); this.body.add(this.head);
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

  /** Add a box to the head sub-group using absolute (torso-space) coords — the head pivots
   *  about HEAD_PIVOT, so it can nod/turn while everything reads at the same rest position. */
  private putHead(w: number, h: number, d: number, color: number, x: number, y: number, z: number, rough = 0.75): THREE.Mesh {
    const m = box(w, h, d, color, rough);
    m.position.set(x, y - HEAD_PIVOT, z);
    this.head.add(m);
    return m;
  }

  /** Skin+hair+eyes shared by every class (hair styling is added by the caller). */
  private buildFace(eyeColor: number): void {
    this.putHead(0.62, 0.58, 0.58, SKIN, 0, 2.04, 0);            // head
    this.putHead(0.16, 0.05, 0.04, BROW, 0.15, 2.15, 0.30);     // brows
    this.putHead(0.16, 0.05, 0.04, BROW, -0.15, 2.15, 0.30);
    this.putHead(0.09, 0.11, 0.04, 0xffffff, 0.15, 2.04, 0.30, 0.4); // eye whites
    this.putHead(0.09, 0.11, 0.04, 0xffffff, -0.15, 2.04, 0.30, 0.4);
    this.putHead(0.07, 0.09, 0.05, eyeColor, 0.15, 2.03, 0.31, 0.35); // irises
    this.putHead(0.07, 0.09, 0.05, eyeColor, -0.15, 2.03, 0.31, 0.35);
    this.putHead(0.16, 0.05, 0.04, 0x9c6b45, 0, 1.86, 0.30);   // mouth line
  }

  // ── Warrior: steel plate over a navy gambeson, red scarf/tabard, sword + kite shield ──
  private buildWarrior(): void {
    const b = this.body;
    const STEEL = 0x969ca6, STEEL_DK = 0x6c727c, STEEL_LT = 0xb6bcc4;
    const NAVY = 0x2c3346, NAVY_DK = 0x232838;
    const RED = 0x8f3a34, LEATHER = 0x5a3a1e, LEATHER_DK = 0x3f2814;
    const GOLD = 0xc9a94e, BLADE = 0xd6dbe2, SHIELD = 0x2f3e63;

    this.buildFace(0x2f5fa0);
    // Tufty brown hair (on the head pivot).
    this.putHead(0.7, 0.24, 0.66, HAIR, 0, 2.36, 0);
    this.putHead(0.62, 0.16, 0.12, HAIR, 0, 2.28, 0.28);
    this.putHead(0.12, 0.42, 0.5, HAIR, 0.33, 2.12, -0.02);
    this.putHead(0.12, 0.42, 0.5, HAIR, -0.33, 2.12, -0.02);
    this.putHead(0.66, 0.3, 0.14, HAIR, 0, 2.22, -0.3);
    for (const [hx, hz] of [[-0.2, 0.1], [0.05, 0.16], [0.24, 0.02], [-0.28, -0.05]] as const)
      this.putHead(0.18, 0.14, 0.18, HAIR, hx, 2.5, hz);

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
    // Brown hair under a pushed-back green hood (hair on the head pivot; hood stays on the body).
    this.putHead(0.68, 0.22, 0.62, HAIR, 0, 2.34, 0);
    this.putHead(0.6, 0.14, 0.12, HAIR, 0, 2.28, 0.28);
    this.putHead(0.12, 0.36, 0.48, HAIR, 0.32, 2.14, -0.02);
    this.putHead(0.12, 0.36, 0.48, HAIR, -0.32, 2.14, -0.02);
    for (const [hx, hz] of [[-0.18, 0.08], [0.14, 0.12], [0.24, -0.04]] as const)
      this.putHead(0.16, 0.12, 0.16, HAIR, hx, 2.48, hz);
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
    // Brown fringe peeking out under a raised cream hood with gold trim (fringe on the head pivot).
    this.putHead(0.5, 0.14, 0.1, HAIR, 0, 2.24, 0.27);
    this.putHead(0.12, 0.24, 0.2, HAIR, 0.28, 2.1, 0.2);
    this.putHead(0.12, 0.24, 0.2, HAIR, -0.28, 2.1, 0.2);
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

  /** Start a swing/draw/cast motion for an ability (kind + duration chosen by class + targeting). */
  triggerAction(targeting: string, castTime: number): void {
    const cls = this.classId;
    if (cls === 'warrior') {
      if (targeting === 'selfAoE') { this.actionKind = 'w-spin'; this.actionDur = 0.62; }
      else if (targeting === 'groundAoE') { this.actionKind = 'w-slam'; this.actionDur = 0.58; }
      else if (targeting === 'charge' || targeting === 'dash') { this.actionKind = 'w-thrust'; this.actionDur = 0.44; }
      else if (targeting === 'self') { this.actionKind = 'w-shout'; this.actionDur = 0.6; }
      else { this.actionKind = 'w-swing'; this.actionDur = 0.5; }
    } else if (cls === 'hunter') {
      if (targeting === 'trap') { this.actionKind = 'h-place'; this.actionDur = 0.55; }
      else if (targeting === 'cone') { this.actionKind = 'h-multi'; this.actionDur = 0.6; }
      else { this.actionKind = 'h-shoot'; this.actionDur = 0.55; }
    } else {
      const channel = castTime > 0;
      if (targeting === 'heal' || targeting === 'shield' || targeting === 'toggle' || targeting === 'self')
        this.actionKind = 'p-bless';
      else if (targeting === 'groundAoE') this.actionKind = 'p-smite';
      else this.actionKind = 'p-cast';
      this.actionDur = channel ? Math.max(0.4, castTime) : 0.55;
    }
    this.actionT = this.actionDur;
  }

  /** Apply the active action to the whole rig (arms/body/head/legs/figure/orb); returns arm-x
   *  angles for the caller to commit. Each move drives more than the arms — a wind-up, a torso
   *  whip/lunge, a step, head tracking and (for the priest) a gem flare — so combat reads big. */
  private applyAction(p: number, armRx: number, armLx: number): [number, number] {
    const q = Math.min(1, p);
    const arc = Math.sin(q * Math.PI); // 0→1→0 over the action
    switch (this.actionKind) {
      case 'w-swing': {
        // Coil the sword up and back, then a diagonal downswing with a lunging step + follow-through.
        let sx: number, sz: number;
        if (p < 0.3) { const s = p / 0.3; sx = -2.6 * easeOut(s); sz = 0.5 * s; }
        else if (p < 0.55) { const s = (p - 0.3) / 0.25; sx = -2.6 + 3.7 * s * s; sz = 0.5 - 1.05 * s; }
        else { const s = (p - 0.55) / 0.45; sx = 1.1 * (1 - easeOut(s)); sz = -0.55 * (1 - easeOut(s)); }
        armRx = sx; this.armR.rotation.z = sz;
        let twist: number;
        if (p < 0.3) twist = -0.35 * (p / 0.3);
        else if (p < 0.55) { const s = (p - 0.3) / 0.25; twist = -0.35 + 0.78 * s; }
        else { const s = (p - 0.55) / 0.45; twist = 0.43 * (1 - easeOut(s)); }
        this.body.rotation.y = twist;
        const lunge = p > 0.3 ? Math.sin(Math.min(1, (p - 0.3) / 0.7) * Math.PI) : 0;
        this.body.position.z = lunge * 0.28;
        this.body.rotation.x += lunge * 0.34;
        this.head.rotation.x = lunge * 0.3;
        this.head.rotation.y = twist * 0.5;                            // head tracks the target
        armLx = -0.45 * lunge; this.armL.rotation.z = 0.4 * lunge;     // shield braces across
        this.legR.rotation.x = 0.5 * lunge; this.legL.rotation.x = -0.28 * lunge; // step into it
        break;
      }
      case 'w-spin': {
        // A rising whirlwind: >1 full turn (ease in/out) with sword + shield flung out, a lean
        // into the rotation and a wide braced stance.
        this.body.rotation.y = easeInOut(q) * Math.PI * 2.2;
        armRx = -1.5; armLx = -1.45;
        this.armR.rotation.z = -0.6 * arc; this.armL.rotation.z = 0.6 * arc;
        this.body.rotation.z = 0.15 * arc;
        this.body.position.y += 0.06 * arc;
        this.head.rotation.x = 0.12 * arc;
        this.legR.rotation.x = 0.22 * arc; this.legL.rotation.x = -0.22 * arc;
        break;
      }
      case 'w-thrust': {
        // A charging lunge-stab: sword drives forward to horizontal over a deep lead step.
        const punch = arc;
        armRx = -1.4 * punch; this.armR.rotation.z = 0.15 * punch;
        armLx = -0.5 * punch;
        this.body.position.z = 0.5 * punch;
        this.body.rotation.x += 0.22 * punch;
        this.head.rotation.x = 0.18 * punch;
        this.legR.rotation.x = 0.75 * punch;                           // deep lead step
        this.legL.rotation.x = -0.5 * punch; this.legL.rotation.z = 0.12 * punch; // trailing drive
        break;
      }
      case 'w-slam': {
        // Raise the blade high overhead, then slam it down and land in a crouch — a ground pound.
        let sx: number;
        if (p < 0.4) { const s = p / 0.4; sx = -2.7 * easeOut(s); }
        else if (p < 0.6) { const s = (p - 0.4) / 0.2; sx = -2.7 + 3.9 * s * s; }
        else { const s = (p - 0.6) / 0.4; sx = 1.2 * (1 - easeOut(s)); }
        armRx = sx; armLx = sx * 0.7;                                  // two-handed grip
        const raise = p < 0.4 ? p / 0.4 : 1;
        const impact = p > 0.4 ? Math.sin(Math.min(1, (p - 0.4) / 0.6) * Math.PI) : 0;
        this.body.rotation.x += -0.2 * raise + 0.5 * impact;           // arch back, then crunch down
        this.body.position.y += 0.08 * raise - 0.3 * impact;           // rise, then drop into a crouch
        this.legR.rotation.x = 0.5 * impact; this.legL.rotation.x = 0.5 * impact;
        this.head.rotation.x = -0.2 * raise + 0.35 * impact;
        break;
      }
      case 'w-shout': {
        // A defiant battle cry: thrust the sword skyward, chest out, head up, held then settled.
        const hold = easeOut(Math.min(1, p / 0.3)) * (p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1);
        armRx = -2.5 * hold; armLx = -1.0 * hold; this.armL.rotation.z = 0.3 * hold;
        this.body.rotation.x += -0.18 * hold;
        this.head.rotation.x = -0.35 * hold;
        this.body.position.y += 0.05 * hold;
        break;
      }
      case 'h-shoot': {
        // A bladed archer's stance: bow up and aiming, body turned side-on while the head sights
        // forward; draw to full, hold, then loose with a recoil kick.
        armLx = -1.55;
        this.body.rotation.y = -0.4;
        this.head.rotation.y = 0.42;
        if (p < 0.5) { const s = p / 0.5; armRx = -1.4 - 0.85 * easeOut(s); }
        else if (p < 0.64) armRx = -2.25;
        else { const s = (p - 0.64) / 0.36; armRx = -2.25 + 2.75 * easeOut(s); }
        const rel = p > 0.64 ? Math.sin(((p - 0.64) / 0.36) * Math.PI) : 0;
        this.body.rotation.x += -0.14 * rel;                           // rock back from the loose
        this.armL.rotation.x += 0.18 * rel;                            // the bow kicks
        this.head.rotation.x = -0.06 * rel;
        break;
      }
      case 'h-multi': {
        // A sweeping fan of arrows: bow held up, the stance sweeps across a cone while the draw
        // hand fires three rapid shots.
        armLx = -1.55;
        const sweep = (q - 0.5) * 1.0;
        this.body.rotation.y = sweep;
        this.head.rotation.y = 0.2 - sweep * 0.6;
        armRx = -1.5 - 0.7 * Math.abs(Math.sin(q * Math.PI * 3));       // three rapid draws
        break;
      }
      case 'h-place': {
        // Bend over to set a trap: a modest forward lean + dip while both hands reach down to
        // the ground and the head looks at it, then rise. Kept gentle because the torso pivots
        // at the feet, so a big pitch would swing the whole body over.
        const dip = arc;
        this.body.position.y += -0.14 * dip;
        this.body.rotation.x += 0.28 * dip;
        armRx = 1.05 * dip; armLx = 0.9 * dip;
        this.head.rotation.x = 0.32 * dip;
        break;
      }
      case 'p-cast': {
        // Gather power (raise the staff, the gem builds), then hurl it forward with a body push.
        if (p < 0.5) {
          const s = p / 0.5;
          armRx = -1.75 * easeOut(s); armLx = -0.9 * easeOut(s);
          this.body.rotation.x += -0.14 * s;
          this.head.rotation.x = -0.12 * s;
          this.flashOrb(this.orbBase + 2.6 * s);
        } else {
          const s = (p - 0.5) / 0.5;
          armRx = -1.75 + 2.05 * easeOut(s); armLx = -0.9 + 0.95 * easeOut(s);
          this.body.rotation.x += -0.14 + 0.6 * easeOut(s);
          this.body.position.z = 0.2 * Math.sin(s * Math.PI);
          this.head.rotation.x = 0.22 * Math.sin(s * Math.PI);
          this.flashOrb(this.orbBase + 3.6 * (1 - s));
        }
        break;
      }
      case 'p-smite': {
        // Raise the staff overhead as the gem charges, then swing it down and flare — a smite bolt.
        let sx: number;
        if (p < 0.5) { const s = p / 0.5; sx = -2.6 * easeOut(s); }
        else if (p < 0.68) { const s = (p - 0.5) / 0.18; sx = -2.6 + 3.4 * s * s; }
        else { const s = (p - 0.68) / 0.32; sx = 0.8 * (1 - easeOut(s)); }
        armRx = sx;
        const charge = p < 0.5 ? p / 0.5 : 1;
        const impact = p > 0.5 ? Math.sin(Math.min(1, (p - 0.5) / 0.5) * Math.PI) : 0;
        armLx = -1.2 * charge; this.armL.rotation.z = -0.2 * charge;
        this.body.rotation.x += -0.15 * charge + 0.4 * impact;
        this.body.position.y += 0.05 * charge - 0.12 * impact;
        this.head.rotation.x = -0.25 * charge + 0.3 * impact;
        this.flashOrb(this.orbBase + 2.4 * charge + 3.6 * impact);
        break;
      }
      case 'p-bless': {
        // Raise the staff aloft and hold it high, head tilted up, floating a touch while the gem
        // pulses a steady radiance; lower at the very end.
        const raise = Math.min(1, p / 0.25);
        const lower = p > 0.8 ? (p - 0.8) / 0.2 : 0;
        const hold = easeOut(raise) * (1 - lower);
        armRx = -2.4 * hold; armLx = -2.0 * hold;
        this.body.rotation.x += -0.12 * hold;
        this.head.rotation.x = -0.32 * hold;
        this.figure.position.y += 0.12 * hold;
        this.body.position.y += 0.04 * hold;
        this.flashOrb(this.orbBase + (1.8 + Math.sin(this.t * 12) * 0.5) * hold);
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
    const wb = this.walkBlend * (1 - mb);           // on-foot walk weight
    const idle = (1 - this.walkBlend) * (1 - mb);   // on-foot standing weight
    const sw = Math.sin(this.walkPhase);            // stride (1 per step-pair)
    const sw2 = Math.sin(this.walkPhase * 2);       // footfall (2 per step-pair)

    // Legs: a bigger walk swing on foot; astride (dropped down the wolf's sides, splayed)
    // while mounted — hanging with a slight forward angle so they clear the barrel.
    this.legR.rotation.x = sw * 0.72 * wb + 0.36 * mb;
    this.legL.rotation.x = -sw * 0.72 * wb + 0.36 * mb;
    this.legR.rotation.z = -0.44 * mb;
    this.legL.rotation.z = 0.44 * mb;

    // Arms counter-swing to the legs; a breath-driven drift keeps them alive when idle.
    const breath = Math.sin(this.t * 1.5);
    let armRx = -sw * 0.58 * wb + 0.3 * mb + breath * 0.03 * idle;
    let armLx = sw * 0.58 * wb + 0.3 * mb + breath * 0.03 * idle;

    // Torso: a footfall bob + breathing lift; a slight forward lean when walking; a shoulder
    // twist that counter-rotates the hips (walk) and a slow weight-shift sway (idle).
    this.body.position.y = (Math.abs(sw2) * 0.08 * wb + breath * 0.03 * idle) * (1 - mb);
    this.body.rotation.x = 0.08 * wb + 0.1 * mb;
    this.body.rotation.y = -sw * 0.13 * wb + Math.sin(this.t * 0.5) * 0.05 * idle;
    this.body.rotation.z = sw * 0.05 * wb + Math.sin(this.t * 0.4) * 0.03 * idle;

    // Head: bobs with each footfall and partly counter-turns so the gaze stays forward when
    // walking; drifts in a slow look-around when idle.
    this.head.rotation.x = -sw2 * 0.05 * wb + Math.sin(this.t * 0.65) * 0.04 * idle;
    this.head.rotation.y = sw * 0.08 * wb + Math.sin(this.t * 0.4 + 1.3) * 0.14 * idle;
    this.head.rotation.z = Math.sin(this.t * 0.5) * 0.03 * idle;

    // Combat-only channels (arm twist/cross, torso lunge) rest at zero each frame so an action
    // can drive them and they revert the instant it ends.
    this.armR.rotation.z = 0; this.armL.rotation.z = 0;
    this.armR.rotation.y = 0; this.armL.rotation.y = 0;
    this.body.position.z = 0;

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

    // Wolf while ridden: idle breathing/tail/head sway when standing, and a lively bounding
    // gallop when moving — the body rocks and bobs, the rider posts and leans into it, the
    // tail streams and the legs bound in front/back pairs. All gated by `mb` so it fades in/out
    // cleanly on mount/dismount, and by speed so an AFK mount never looks frozen.
    if (this.mount && mb > 0.02) {
      const gait = Math.min(1, speed / 6);           // 0 standing → 1 full gallop
      const still = 1 - Math.min(1, speed / 2);      // 1 standing → 0 moving
      if (speed > 0.05) this.wolfPhase += dt * (2.2 + speed * 0.85);
      const gp = this.wolfPhase;
      const gs = Math.sin(gp);

      // Wolf body: gentle breathing when idle; vertical suspension + fore/aft rock when bounding.
      const idleBob = Math.sin(this.t * 1.6) * 0.04 * still;
      const bound = Math.abs(gs) * 0.13 * gait;
      const mountBob = (idleBob + bound) * mb;
      this.mountBody!.position.y = mountBob;
      this.mountBody!.rotation.x = Math.sin(gp + 0.7) * 0.11 * gait * mb;

      // Rider: rides the bob glued to the saddle, posts a little extra, and leans into the
      // gallop while rocking subtly with each bound.
      const posting = Math.abs(Math.sin(gp + 0.4)) * 0.06 * gait * mb;
      this.figure.position.y = SEAT_Y * mb + mountBob + posting;
      this.body.rotation.x += (0.2 * gait + gs * 0.05 * gait) * mb;  // lean forward + rock
      this.body.rotation.z += gs * 0.04 * gait * mb;                 // sway with the gallop
      this.head.rotation.x =
        (-0.06 + Math.sin(gp + 0.5) * 0.05) * gait * mb + Math.sin(this.t * 1.4) * 0.03 * still * mb;
      this.head.rotation.y = 0;
      const reinBob = gs * 0.06 * gait * mb;
      this.armR.rotation.x += reinBob;                               // hands ride the reins
      this.armL.rotation.x += reinBob;
      this.legR.rotation.x += gs * 0.05 * gait * mb;                 // legs flex with the gait
      this.legL.rotation.x -= gs * 0.05 * gait * mb;

      // Tail: sways side-to-side when idle; pumps up/down streaming behind at the gallop.
      this.mountTail!.rotation.y = Math.sin(this.t * 2.3) * (0.14 + 0.16 * still) * mb;
      this.mountTail!.rotation.x = -gs * 0.2 * gait * mb;

      // Head: gentle nod/look when idle; reaches with the bounding rhythm when galloping.
      this.mountHead!.rotation.x =
        Math.sin(this.t * 1.6 + 0.7) * 0.06 * still * mb + Math.sin(gp + 3.0) * 0.12 * gait * mb;
      this.mountHead!.rotation.y = Math.sin(this.t * 0.9) * 0.04 * still * mb;

      // Legs: a bounding gallop — the front pair reaches as the back pair pushes (offset ~π),
      // with a slight lead within each pair so it reads as a real 4-beat gait; amplitude ramps.
      const legAmp = 0.62 * gait * mb;
      const legPhase = [Math.PI + 0.5, Math.PI, 0.5, 0]; // FL, FR, BL, BR
      for (let i = 0; i < this.mountLegs.length; i++)
        this.mountLegs[i].rotation.x = Math.sin(gp + legPhase[i]) * legAmp;
    }
  }
}

function easeOut(p: number): number {
  return 1 - (1 - p) * (1 - p);
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
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

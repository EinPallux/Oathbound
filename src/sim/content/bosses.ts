// World bosses (0.6.0 CP2): three hand-authored, solo-beatable open-world bosses, one
// each in the three highest frontiers. Unlike the data-scaled standard/elite/rare
// enemies (enemies.ts), bosses are bespoke uniques — big HP, multi-phase escalation,
// and a telegraphed heavy ground attack you must step out of. Pure simulation (no
// Three.js/DOM): the boss is an `Enemy` (so enemy-ai drives locomotion + basic swings,
// tier `boss`) plus a `Boss` component the boss-ai system reads. See ENEMY_DESIGN.md.

import type { World, Entity } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Health,
  type Offense,
  type Defense,
  type Statuses,
  type Targetable,
  type EnemyInfo,
  type Enemy,
  type Boss,
  type DamageType,
} from '../../core/ecs/components';
import type { Heightfield } from '../../world/heightfield';
import { CRIT_MULT } from '../stats';

const ENEMY_HALF = 0.9;

export type BossId = 'emberhorn' | 'rimewyrm' | 'maelgrith';

interface BossDef {
  name: string;
  family: string;
  level: number;
  /** Basic-attack + theme damage school. */
  attackType: DamageType;
  hp: number;
  armor: number;
  resist?: { fire: number; frost: number; blight: number };
  weakness?: Partial<Record<DamageType, number>>;
  primaryStat: number;
  /** Basic telegraphed melee swing. */
  attackBase: number;
  attackCoeff: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldown: number;
  windup: number;
  aggroRadius: number;
  leashRange: number;
  /** Telegraphed heavy ground attack (a GroundAoe you must leave). */
  heavyBase: number;
  heavyCoeff: number;
  heavyType: DamageType;
  heavyRadius: number;
  heavyTelegraph: number;
  /** Descending HP fractions that advance phases (e.g. [0.66, 0.33] ⇒ 3 phases). */
  phaseThresholds: number[];
  /** Seconds between heavy attacks per phase (length = phaseThresholds.length + 1). */
  heavyCadence: number[];
  xp: number;
  goldMin: number;
  goldMax: number;
  respawnSec: number;
  /** Where the boss waits in the world (deep in its frontier). */
  x: number;
  z: number;
}

export const BOSSES: Record<BossId, BossDef> = {
  // ── Emberhorn — the Emberreach (far west, fire). The first world boss (~Lv 20). ──
  emberhorn: {
    name: 'Emberhorn, the Cinder Tyrant',
    family: 'Emberhorn',
    level: 20,
    attackType: 'fire',
    hp: 11000,
    armor: 40,
    weakness: { frost: 1.2 }, // a creature of flame — frost bites
    primaryStat: 52,
    attackBase: 24,
    attackCoeff: 1.3,
    moveSpeed: 3.1,
    attackRange: 2.8,
    attackCooldown: 2.4,
    windup: 1.0,
    aggroRadius: 18,
    leashRange: 60,
    heavyBase: 130,
    heavyCoeff: 5.0,
    heavyType: 'fire',
    heavyRadius: 4.5,
    heavyTelegraph: 1.4,
    phaseThresholds: [0.66, 0.33],
    heavyCadence: [6.0, 4.5, 3.0],
    xp: 2600,
    goldMin: 180,
    goldMax: 320,
    respawnSec: 300,
    x: -296,
    z: 0,
  },
  // ── The Rimewyrm — the Riven Peaks (far east, frost). ~Lv 25. ──
  rimewyrm: {
    name: 'The Rimewyrm',
    family: 'Rimewyrm',
    level: 25,
    attackType: 'frost',
    hp: 15000,
    armor: 58, // an ancient ice-wyrm — heavily plated
    weakness: { fire: 1.25 },
    primaryStat: 64,
    attackBase: 30,
    attackCoeff: 1.4,
    moveSpeed: 3.0,
    attackRange: 3.0,
    attackCooldown: 2.5,
    windup: 1.0,
    aggroRadius: 18,
    leashRange: 64,
    heavyBase: 210,
    heavyCoeff: 5.5,
    heavyType: 'frost',
    heavyRadius: 4.0,
    heavyTelegraph: 1.3,
    phaseThresholds: [0.66, 0.33],
    heavyCadence: [5.5, 4.0, 2.8],
    xp: 4200,
    goldMin: 260,
    goldMax: 460,
    respawnSec: 300,
    x: 250,
    z: 12,
  },
  // ── Maelgrith — Gravereach (far north, blight/undead). The Lv-30 capstone boss. ──
  maelgrith: {
    name: 'Maelgrith, the Hollow Crown',
    family: 'Maelgrith',
    level: 30,
    attackType: 'blight',
    hp: 32000,
    armor: 50,
    weakness: { holy: 1.25 }, // an undead tyrant — holy sears it
    primaryStat: 78,
    attackBase: 36,
    attackCoeff: 1.5,
    moveSpeed: 3.2,
    attackRange: 3.0,
    attackCooldown: 2.4,
    windup: 1.0,
    aggroRadius: 20,
    leashRange: 68,
    heavyBase: 200,
    heavyCoeff: 4.8,
    heavyType: 'blight',
    heavyRadius: 5.0,
    heavyTelegraph: 1.5,
    phaseThresholds: [0.75, 0.5, 0.25], // four phases — the endgame climax
    heavyCadence: [6.0, 4.5, 3.2, 2.2],
    xp: 7000,
    goldMin: 420,
    goldMax: 700,
    respawnSec: 300,
    x: 10,
    z: 292,
  },
};

/** Boss placements (deep in their frontiers), for spawning + keeping the arena clear. */
export const BOSS_SPAWNS: { id: BossId; x: number; z: number }[] = (
  Object.keys(BOSSES) as BossId[]
).map((id) => ({ id, x: BOSSES[id].x, z: BOSSES[id].z }));

/** Spawn a world boss: an `Enemy` (tier `boss`) plus a `Boss` component for the fight. */
export function spawnBoss(
  world: World,
  field: Heightfield,
  id: BossId,
  x: number,
  z: number,
): Entity {
  const def = BOSSES[id];
  const e = world.createEntity();
  const y = field.sample(x, z) + ENEMY_HALF;
  const yaw = Math.atan2(-x, -z);

  world.set<Transform>(e, C.Transform, {
    x,
    y,
    z,
    yaw,
    prevX: x,
    prevY: y,
    prevZ: z,
    prevYaw: yaw,
  });
  world.set(e, C.Velocity, { x: 0, y: 0, z: 0 });
  world.set<Health>(e, C.Health, { current: def.hp, max: def.hp });
  world.set<Offense>(e, C.Offense, {
    primaryStat: def.primaryStat,
    level: def.level,
    critChance: 0.05,
    critMult: CRIT_MULT,
    leech: 0,
    haste: 0,
    healPower: 0,
  });
  world.set<Defense>(e, C.Defense, {
    armor: def.armor,
    resist: def.resist ?? { fire: 0, frost: 0, blight: 0 },
    weakness: def.weakness ?? {},
  });
  world.set<Statuses>(e, C.Statuses, { list: [] });
  world.set<Targetable>(e, C.Targetable, true);
  world.set<EnemyInfo>(e, C.EnemyInfo, { name: def.name, level: def.level });

  world.set<Enemy>(e, C.Enemy, {
    archetype: 'melee_bruiser',
    family: def.family,
    tier: 'boss',
    state: 'idle',
    homeX: x,
    homeZ: z,
    aggroRadius: def.aggroRadius,
    leashRange: def.leashRange,
    socialRange: 0, // a lone boss — no pack rally
    moveSpeed: def.moveSpeed,
    attackRange: def.attackRange,
    attackCooldown: def.attackCooldown,
    attackTimer: 0,
    windup: def.windup,
    windupTimer: -1,
    attackBase: def.attackBase,
    attackCoeff: def.attackCoeff,
    attackType: def.attackType,
    xpBase: def.xp,
    goldMin: def.goldMin,
    goldMax: def.goldMax,
    lootTable: `${id}_boss`,
    respawnDelay: def.respawnSec,
    deadFor: 0,
    invulnTimer: 0,
  });

  world.set<Boss>(e, C.Boss, {
    bossId: id,
    phase: 0,
    phaseThresholds: def.phaseThresholds.slice(),
    heavyCadence: def.heavyCadence.slice(),
    // Prime so the first heavy lands a little after engaging (not instantly).
    heavyTimer: def.heavyCadence[0] * 0.6,
    heavyTelegraph: def.heavyTelegraph,
    heavyRadius: def.heavyRadius,
    heavyBase: def.heavyBase,
    heavyCoeff: def.heavyCoeff,
    heavyType: def.heavyType,
  });
  return e;
}

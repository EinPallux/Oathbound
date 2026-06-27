// Data-driven enemy content: templates (a shared level curve + per-template overrides)
// and a generic spawner that applies tier multipliers (standard / elite / rare-named).
// Pure simulation. See docs/design/ENEMY_DESIGN.md (data-driven configuration).

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
  type DamageType,
} from '../../core/ecs/components';
import type { Heightfield } from '../../world/heightfield';
import { xpPerKill, CRIT_MULT } from '../stats';

const ENEMY_HALF = 0.9;

export type EnemyTemplateId =
  | 'bloomhusk'
  | 'reaver'
  | 'wisp'
  | 'weaver'
  | 'bramblekin'
  | 'sporeling'
  | 'sporemother'
  | 'warchief'
  // Sunken Fen (Lv 11–15)
  | 'drudge'
  | 'fenstalker'
  | 'mireling'
  // Emberreach (Lv 16–20)
  | 'magmaw'
  | 'ashreaver'
  | 'cinderborn'
  | 'emberwarlord';

export type Tier = 'standard' | 'elite' | 'rare';

interface Template {
  name: string;
  family: string;
  archetype: Enemy['archetype'];
  attackType: DamageType;
  hpBase: number;
  hpPerLevel: number;
  armorBase: number;
  armorPerLevel: number;
  primaryBase: number;
  primaryPerLevel: number;
  attackBase: number;
  attackCoeff: number;
  aggroRadius: number;
  leashRange: number;
  socialRange: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldown: number;
  windup: number;
  goldMin: number;
  goldMax: number;
  lootTable: string;
  weakness?: Partial<Record<DamageType, number>>;
  resist?: { fire: number; frost: number; blight: number };
}

const TEMPLATES: Record<EnemyTemplateId, Template> = {
  // ── Greenmarch (Lv 1–5) ──
  bloomhusk: {
    name: 'Bloomhusk Thrasher',
    family: 'Bloomhusks',
    archetype: 'melee_bruiser',
    attackType: 'physical',
    hpBase: 34,
    hpPerLevel: 12,
    armorBase: 10,
    armorPerLevel: 5,
    primaryBase: 8,
    primaryPerLevel: 2,
    attackBase: 6,
    attackCoeff: 0.6,
    aggroRadius: 10,
    leashRange: 35,
    socialRange: 6,
    moveSpeed: 3.4,
    attackRange: 2.2,
    attackCooldown: 2.0,
    windup: 0.8,
    goldMin: 2,
    goldMax: 6,
    lootTable: 'greenmarch_standard',
    weakness: { fire: 1.15 },
  },
  reaver: {
    name: 'Greenmarch Reaver',
    family: 'Reavers',
    archetype: 'ranged_skirmisher',
    attackType: 'physical',
    hpBase: 28,
    hpPerLevel: 10,
    armorBase: 8,
    armorPerLevel: 4,
    primaryBase: 6,
    primaryPerLevel: 2,
    attackBase: 5,
    attackCoeff: 0.5,
    aggroRadius: 14,
    leashRange: 35,
    socialRange: 6,
    moveSpeed: 3.0,
    attackRange: 13,
    attackCooldown: 2.2,
    windup: 0.7,
    goldMin: 2,
    goldMax: 6,
    lootTable: 'greenmarch_standard',
  },
  wisp: {
    name: 'Greenmarch Wisp',
    family: 'Wisps',
    archetype: 'caster',
    attackType: 'blight',
    hpBase: 24,
    hpPerLevel: 9,
    armorBase: 6,
    armorPerLevel: 3,
    primaryBase: 6,
    primaryPerLevel: 2,
    attackBase: 7,
    attackCoeff: 0.7,
    aggroRadius: 13,
    leashRange: 35,
    socialRange: 6,
    moveSpeed: 2.6,
    attackRange: 12,
    attackCooldown: 3.0,
    windup: 1.2,
    goldMin: 2,
    goldMax: 6,
    lootTable: 'greenmarch_standard',
  },
  // ── Thornwood Vale (Lv 6–10) ──
  weaver: {
    name: 'Thornwood Weaver',
    family: 'Weavers',
    archetype: 'melee_bruiser',
    attackType: 'physical',
    hpBase: 26,
    hpPerLevel: 10,
    armorBase: 8,
    armorPerLevel: 4,
    primaryBase: 8,
    primaryPerLevel: 2,
    attackBase: 5,
    attackCoeff: 0.5,
    aggroRadius: 10,
    leashRange: 35,
    socialRange: 8,
    moveSpeed: 4.4, // fast
    attackRange: 2.0,
    attackCooldown: 1.6,
    windup: 0.5,
    goldMin: 3,
    goldMax: 7,
    lootTable: 'thornwood_standard',
    weakness: { fire: 1.1 },
  },
  bramblekin: {
    name: 'Bramblekin',
    family: 'Bramblekin',
    archetype: 'melee_bruiser',
    attackType: 'physical',
    hpBase: 50,
    hpPerLevel: 16, // tanky
    armorBase: 30,
    armorPerLevel: 8, // heavy armour
    primaryBase: 8,
    primaryPerLevel: 2,
    attackBase: 8,
    attackCoeff: 0.7,
    aggroRadius: 9,
    leashRange: 35,
    socialRange: 4,
    moveSpeed: 2.4, // slow
    attackRange: 2.4,
    attackCooldown: 2.6,
    windup: 1.0,
    goldMin: 4,
    goldMax: 9,
    lootTable: 'thornwood_standard',
    weakness: { fire: 1.2 },
  },
  sporeling: {
    name: 'Sporeling',
    family: 'Sporelings',
    archetype: 'melee_bruiser',
    attackType: 'physical',
    hpBase: 18,
    hpPerLevel: 8, // very low HP
    armorBase: 6,
    armorPerLevel: 3,
    primaryBase: 6,
    primaryPerLevel: 2,
    attackBase: 4,
    attackCoeff: 0.4,
    aggroRadius: 8,
    leashRange: 30,
    socialRange: 10, // big packs
    moveSpeed: 4.0,
    attackRange: 2.0,
    attackCooldown: 1.5,
    windup: 0.4,
    goldMin: 1,
    goldMax: 4,
    lootTable: 'thornwood_standard',
    weakness: { fire: 1.25 },
  },
  // ── Support / pack-leader archetypes (mid-game; previewed in Thornwood) ──
  sporemother: {
    name: 'Sporemother',
    family: 'Sporelings',
    archetype: 'support',
    attackType: 'blight',
    hpBase: 40,
    hpPerLevel: 12,
    armorBase: 8,
    armorPerLevel: 3,
    primaryBase: 9,
    primaryPerLevel: 2.5, // scales her heals
    attackBase: 8, // reused as heal base
    attackCoeff: 0.9, // reused as heal coeff
    aggroRadius: 16,
    leashRange: 38,
    socialRange: 14, // heals allies within this
    moveSpeed: 2.8,
    attackRange: 16, // hangs back and tends the swarm
    attackCooldown: 3.2,
    windup: 1.0,
    goldMin: 4,
    goldMax: 9,
    lootTable: 'thornwood_standard',
    weakness: { fire: 1.2 },
  },
  warchief: {
    name: 'Bramble Warchief',
    family: 'Bramblekin',
    archetype: 'pack_leader',
    attackType: 'physical',
    hpBase: 58,
    hpPerLevel: 16,
    armorBase: 24,
    armorPerLevel: 7,
    primaryBase: 9,
    primaryPerLevel: 2,
    attackBase: 8,
    attackCoeff: 0.7,
    aggroRadius: 11,
    leashRange: 38,
    socialRange: 9, // empowers allies within this
    moveSpeed: 3.0,
    attackRange: 2.5,
    attackCooldown: 2.4,
    windup: 0.9,
    goldMin: 5,
    goldMax: 11,
    lootTable: 'thornwood_standard',
    weakness: { fire: 1.15 },
  },
  // ── The Sunken Fen (Lv 11–15) — blight theme; resist matters ──
  drudge: {
    name: 'Bog Drudge',
    family: 'Drudge',
    archetype: 'melee_bruiser',
    attackType: 'blight',
    hpBase: 44,
    hpPerLevel: 13,
    armorBase: 14,
    armorPerLevel: 5,
    primaryBase: 9,
    primaryPerLevel: 2,
    attackBase: 8,
    attackCoeff: 0.65,
    aggroRadius: 10,
    leashRange: 40,
    socialRange: 6,
    moveSpeed: 3.0,
    attackRange: 2.3,
    attackCooldown: 2.2,
    windup: 0.9,
    goldMin: 4,
    goldMax: 9,
    lootTable: 'fen_standard',
    weakness: { fire: 1.1 },
  },
  fenstalker: {
    name: 'Fenstalker',
    family: 'Fenstalkers',
    archetype: 'ranged_skirmisher',
    attackType: 'blight',
    hpBase: 30,
    hpPerLevel: 11,
    armorBase: 8,
    armorPerLevel: 4,
    primaryBase: 8,
    primaryPerLevel: 2,
    attackBase: 6,
    attackCoeff: 0.55,
    aggroRadius: 16, // amphibious ambusher
    leashRange: 40,
    socialRange: 7,
    moveSpeed: 3.6,
    attackRange: 13,
    attackCooldown: 2.0,
    windup: 0.6,
    goldMin: 4,
    goldMax: 9,
    lootTable: 'fen_standard',
  },
  mireling: {
    name: 'Mireling',
    family: 'Mirelings',
    archetype: 'caster',
    attackType: 'blight',
    hpBase: 24,
    hpPerLevel: 9,
    armorBase: 6,
    armorPerLevel: 3,
    primaryBase: 8,
    primaryPerLevel: 2.2,
    attackBase: 8,
    attackCoeff: 0.7,
    aggroRadius: 14,
    leashRange: 40,
    socialRange: 6,
    moveSpeed: 2.6,
    attackRange: 13,
    attackCooldown: 3.0,
    windup: 1.2,
    goldMin: 4,
    goldMax: 9,
    lootTable: 'fen_standard',
  },
  // ── The Emberreach (Lv 16–20) — fire theme; resist-check + ground-AoE tools ──
  magmaw: {
    name: 'Magmaw',
    family: 'Magmaw',
    archetype: 'melee_bruiser',
    attackType: 'fire',
    hpBase: 60,
    hpPerLevel: 17, // heavy beast
    armorBase: 26,
    armorPerLevel: 7,
    primaryBase: 10,
    primaryPerLevel: 2,
    attackBase: 10,
    attackCoeff: 0.7,
    aggroRadius: 10,
    leashRange: 42,
    socialRange: 6,
    moveSpeed: 2.6, // slow
    attackRange: 2.5,
    attackCooldown: 2.6,
    windup: 1.0,
    goldMin: 6,
    goldMax: 12,
    lootTable: 'ember_standard',
  },
  ashreaver: {
    name: 'Ashen Reaver',
    family: 'Ashen Reavers',
    archetype: 'ranged_skirmisher',
    attackType: 'fire',
    hpBase: 34,
    hpPerLevel: 12,
    armorBase: 10,
    armorPerLevel: 4,
    primaryBase: 9,
    primaryPerLevel: 2,
    attackBase: 8,
    attackCoeff: 0.6,
    aggroRadius: 15,
    leashRange: 42,
    socialRange: 8,
    moveSpeed: 3.4,
    attackRange: 14,
    attackCooldown: 2.0,
    windup: 0.6,
    goldMin: 6,
    goldMax: 12,
    lootTable: 'ember_standard',
  },
  cinderborn: {
    name: 'Cinderborn',
    family: 'Cinderborn',
    archetype: 'caster',
    attackType: 'fire',
    hpBase: 28,
    hpPerLevel: 10,
    armorBase: 6,
    armorPerLevel: 3,
    primaryBase: 10,
    primaryPerLevel: 2.4,
    attackBase: 10,
    attackCoeff: 0.8,
    aggroRadius: 15,
    leashRange: 42,
    socialRange: 6,
    moveSpeed: 2.8,
    attackRange: 14,
    attackCooldown: 3.0,
    windup: 1.2, // big fire telegraph — interrupt / LoS it
    goldMin: 6,
    goldMax: 12,
    lootTable: 'ember_standard',
  },
  emberwarlord: {
    name: 'Ember Warlord',
    family: 'Ashen Reavers',
    archetype: 'pack_leader',
    attackType: 'fire',
    hpBase: 70,
    hpPerLevel: 18,
    armorBase: 24,
    armorPerLevel: 7,
    primaryBase: 11,
    primaryPerLevel: 2,
    attackBase: 10,
    attackCoeff: 0.7,
    aggroRadius: 12,
    leashRange: 42,
    socialRange: 10, // big rally
    moveSpeed: 3.0,
    attackRange: 2.6,
    attackCooldown: 2.4,
    windup: 0.9,
    goldMin: 8,
    goldMax: 14,
    lootTable: 'ember_standard',
  },
};

const TIER_MULT: Record<Tier, { hp: number; dmg: number; xp: number; gold: number }> = {
  standard: { hp: 1, dmg: 1, xp: 1, gold: 1 },
  elite: { hp: 5, dmg: 1.5, xp: 5, gold: 4 },
  rare: { hp: 8, dmg: 1.8, xp: 12, gold: 8 },
};

const RESPAWN_SEC: Record<Tier, number> = { standard: 30, elite: 180, rare: 600 };

export interface SpawnOpts {
  level?: number;
  tier?: Tier;
  /** Override the display name (for unique rare-named spawns). */
  name?: string;
}

/** Spawn an enemy from a template, applying level scaling + tier multipliers. */
export function spawnEnemy(
  world: World,
  field: Heightfield,
  id: EnemyTemplateId,
  x: number,
  z: number,
  opts: SpawnOpts = {},
): Entity {
  const tpl = TEMPLATES[id];
  const level = opts.level ?? 1;
  const tier = opts.tier ?? 'standard';
  const tm = TIER_MULT[tier];

  const e = world.createEntity();
  const y = field.sample(x, z) + ENEMY_HALF;
  const hp = Math.round((tpl.hpBase + tpl.hpPerLevel * level) * tm.hp);
  const yaw = Math.atan2(-x, -z); // face spawn origin

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
  world.set<Health>(e, C.Health, { current: hp, max: hp });
  world.set<Offense>(e, C.Offense, {
    primaryStat: tpl.primaryBase + tpl.primaryPerLevel * level,
    level,
    critChance: 0.05,
    critMult: CRIT_MULT,
    leech: 0,
    haste: 0,
    healPower: 0,
  });
  world.set<Defense>(e, C.Defense, {
    armor: tpl.armorBase + tpl.armorPerLevel * level,
    resist: tpl.resist ?? { fire: 0, frost: 0, blight: 0 },
    weakness: tpl.weakness ?? {},
  });
  world.set<Statuses>(e, C.Statuses, { list: [] });
  world.set<Targetable>(e, C.Targetable, true);

  const name =
    opts.name ?? (tier === 'elite' ? `${tpl.name} (Elite)` : tpl.name);
  world.set<EnemyInfo>(e, C.EnemyInfo, { name, level });
  world.set<Enemy>(e, C.Enemy, {
    archetype: tpl.archetype,
    family: tpl.family,
    tier,
    state: 'idle',
    homeX: x,
    homeZ: z,
    aggroRadius: tpl.aggroRadius,
    leashRange: tpl.leashRange,
    socialRange: tpl.socialRange,
    moveSpeed: tpl.moveSpeed,
    attackRange: tpl.attackRange,
    attackCooldown: tpl.attackCooldown,
    attackTimer: 0,
    windup: tpl.windup,
    windupTimer: -1,
    attackBase: Math.round(tpl.attackBase * tm.dmg),
    attackCoeff: tpl.attackCoeff,
    attackType: tpl.attackType,
    xpBase: Math.round(xpPerKill(level) * tm.xp),
    goldMin: Math.round(tpl.goldMin * tm.gold),
    goldMax: Math.round(tpl.goldMax * tm.gold),
    lootTable: tpl.lootTable,
    respawnDelay: RESPAWN_SEC[tier],
    deadFor: 0,
    invulnTimer: 0,
  });
  return e;
}

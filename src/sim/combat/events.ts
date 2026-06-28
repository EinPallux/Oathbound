// Sim → render/UI event names + payloads. The sim emits these; render/UI/audio
// subscribe (the event bus keeps rendering decoupled from sim). Plain data only.

import type { DamageType, Item, ClassId } from '../../core/ecs/components';

export const CombatEvent = {
  Damage: 'combat/damage',
  Heal: 'combat/heal',
  /** The player successfully activated an ability (drives the player-model animation). */
  AbilityUsed: 'combat/abilityUsed',
  /** An enemy died. */
  Death: 'combat/death',
  /** An enemy respawned. */
  Respawn: 'combat/respawn',
  /** A world boss advanced to a new (harder) phase. */
  BossPhase: 'combat/bossPhase',
  PlayerDied: 'combat/playerDied',
  PlayerRespawn: 'combat/playerRespawn',
  LevelUp: 'progress/levelUp',
  XpGained: 'progress/xp',
  LootDropped: 'loot/dropped',
  LootPicked: 'loot/picked',
  GoldGained: 'loot/gold',
  ItemSalvaged: 'item/salvaged',
  ItemSold: 'item/sold',
  ItemReinforced: 'item/reinforced',
  OathstoneActivated: 'oathstone/activated',
  FastTraveled: 'travel/used',
} as const;

export interface DamageEvent {
  source: number;
  target: number;
  amount: number;
  isCrit: boolean;
  damageType: DamageType;
  abilityId: string;
  /** World position of the hit (target centre), for floating numbers. */
  x: number;
  y: number;
  z: number;
}

export interface HealEvent {
  entity: number;
  amount: number;
  x: number;
  y: number;
  z: number;
}

export interface AbilityUsedEvent {
  entity: number;
  classId: ClassId;
  abilityId: string;
  /** Ability targeting kind (e.g. 'projectile', 'selfAoE', 'heal') — picks the motion. */
  targeting: string;
  /** Cast time in seconds (0 = instant); a channel holds the pose for this long. */
  castTime: number;
}

export interface DeathEvent {
  entity: number;
  killer: number;
}

export interface RespawnEvent {
  entity: number;
}

export interface BossPhaseEvent {
  entity: number;
  name: string;
  /** New phase (1-based for display: phase 0 → "Phase 1" is the opener, not emitted). */
  phase: number;
  /** Total phases in the fight. */
  totalPhases: number;
}

export interface PlayerDiedEvent {
  entity: number;
}

export interface PlayerRespawnEvent {
  entity: number;
}

export interface LevelUpEvent {
  entity: number;
  level: number;
}

export interface XpGainedEvent {
  entity: number;
  amount: number;
  xp: number;
  xpToNext: number;
  level: number;
}

export interface LootDroppedEvent {
  entity: number;
  item: Item | null;
  gold: number;
  x: number;
  y: number;
  z: number;
}

export interface LootPickedEvent {
  item: Item;
}

export interface GoldGainedEvent {
  amount: number;
  total: number;
}

export interface ItemSalvagedEvent {
  itemName: string;
  whetstones: number;
  gold: number;
}

export interface ItemSoldEvent {
  itemName: string;
  gold: number;
}

export interface ItemReinforcedEvent {
  itemName: string;
  /** New reinforcement level (1..MAX_REINFORCE). */
  level: number;
}

export interface OathstoneActivatedEvent {
  entity: number;
  name: string;
}

export interface FastTraveledEvent {
  name: string;
  cost: number;
}

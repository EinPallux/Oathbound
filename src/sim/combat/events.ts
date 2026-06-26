// Combat event names + payloads. The sim emits these; render/UI subscribe (the
// event bus is what keeps rendering decoupled from sim). Payloads are plain data.

import type { DamageType } from '../../core/ecs/components';

export const CombatEvent = {
  Damage: 'combat/damage',
  Death: 'combat/death',
  Respawn: 'combat/respawn',
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

export interface DeathEvent {
  entity: number;
}

export interface RespawnEvent {
  entity: number;
}

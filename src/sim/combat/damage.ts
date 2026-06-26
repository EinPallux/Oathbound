// The canonical damage formula — the single source of combat math used everywhere
// (combat tests assert it). Pure: no Three.js, no DOM, no RNG side effects. The
// random parts (crit, variance) are passed in as an explicit roll so the math is
// deterministic and unit-testable. See docs/design/COMBAT_DESIGN.md#5-damage-calculation-canonical-formula.

import type { DamageType } from '../../core/ecs/components';
import type { Rng } from '../../core/rng';

export type { DamageType };

/** Attacker side of the formula. */
export interface Attacker {
  primaryStat: number;
  level: number;
  critChance: number;
  critMult: number;
}

/** Defender side of the formula. */
export interface Defender {
  armor: number;
  resist: { fire: number; frost: number; blight: number };
  weakness: Partial<Record<DamageType, number>>;
}

/** The minimal ability shape the formula needs. */
export interface AbilityHit {
  base: number;
  coeff: number;
  damageType: DamageType;
}

/** The random inputs, separated so the math itself stays pure/deterministic. */
export interface DamageRoll {
  isCrit: boolean;
  /** Spread multiplier in [0.95, 1.05]. */
  variance: number;
}

export interface DamageResult {
  amount: number;
  isCrit: boolean;
  /** Intermediates exposed for tests/telemetry. */
  raw: number;
  mitigated: number;
}

/** Diminishing-returns constant K(L) = 50 + 25*L, scaled by attacker level so armor
 *  and resists stay relevant as levels climb (`v1` tuning). */
export function drConstant(level: number): number {
  return 50 + 25 * level;
}

/** Physical mitigation fraction in [0, 1): armor / (armor + K(level)). */
export function armorDR(armor: number, level: number): number {
  if (armor <= 0) return 0;
  return armor / (armor + drConstant(level));
}

/** Typed mitigation fraction in [0, 1), analogous to armor (`v1` shares K). */
export function resistDR(resist: number, level: number): number {
  if (resist <= 0) return 0;
  return resist / (resist + drConstant(level));
}

function resistFor(defender: Defender, type: DamageType): number {
  switch (type) {
    case 'fire':
      return defender.resist.fire;
    case 'frost':
      return defender.resist.frost;
    case 'blight':
      return defender.resist.blight;
    default:
      return 0; // physical → armor; holy → no typed resist in v1
  }
}

/**
 * The canonical formula:
 *   rawHit      = abilityBase + abilityCoeff * primaryStat
 *   mitigated   = rawHit * (1 - armorDR) * (1 - resistDR) * weaknessMods
 *   critical    = mitigated * (isCrit ? critMult : 1)
 *   finalDamage = round(critical * variance)
 * Physical hits use armor (resistDR = 0); typed hits use the matching resist
 * (armorDR = 0). `weaknessMods` defaults to 1 when the school is absent.
 */
export function computeDamage(
  ability: AbilityHit,
  attacker: Attacker,
  defender: Defender,
  roll: DamageRoll,
): DamageResult {
  const raw = ability.base + ability.coeff * attacker.primaryStat;

  const physical = ability.damageType === 'physical';
  const aDR = physical ? armorDR(defender.armor, attacker.level) : 0;
  const rDR = physical ? 0 : resistDR(resistFor(defender, ability.damageType), attacker.level);
  const weak = defender.weakness[ability.damageType] ?? 1;

  const mitigated = raw * (1 - aDR) * (1 - rDR) * weak;
  const critical = mitigated * (roll.isCrit ? attacker.critMult : 1);
  const amount = Math.round(critical * roll.variance);

  return { amount, isCrit: roll.isCrit, raw, mitigated };
}

/** Roll the random inputs for one hit (consumes two RNG draws: crit, then variance). */
export function rollDamage(rng: Rng, critChance: number): DamageRoll {
  return {
    isCrit: rng.next() < critChance,
    variance: 0.95 + rng.next() * 0.1,
  };
}

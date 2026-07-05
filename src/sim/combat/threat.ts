// Multiplayer threat table. Each enemy accumulates per-player threat (from damage dealt); its
// AI targets the highest-threat living player instead of merely the nearest, and on death the
// threat table is the participant list for shared XP + instanced loot. With a single player this
// is behaviour-neutral (one contributor = the nearest = the only participant). Pure simulation.

import type { World, Entity } from '../../core/ecs/world';
import { C, type Threat } from '../../core/ecs/components';

/** Add `amount` threat from `player` onto `enemy` (lazily creating the table). */
export function addThreat(world: World, enemy: Entity, player: Entity, amount: number): void {
  if (amount <= 0) return;
  let th = world.get<Threat>(enemy, C.Threat);
  if (!th) {
    th = { table: new Map() };
    world.set<Threat>(enemy, C.Threat, th);
  }
  th.table.set(player, (th.table.get(player) ?? 0) + amount);
}

/**
 * The living player with the most threat on `enemy`, or null if none of them have any. `alive`
 * is the set of currently-living player entity ids the caller already gathered.
 */
export function topThreatPlayer(world: World, enemy: Entity, alive: ReadonlySet<Entity>): Entity | null {
  const th = world.get<Threat>(enemy, C.Threat);
  if (!th || th.table.size === 0) return null;
  let best: Entity | null = null;
  let bestVal = 0;
  for (const [player, val] of th.table) {
    if (val > bestVal && alive.has(player)) {
      bestVal = val;
      best = player;
    }
  }
  return best;
}

/** Every player that built threat on `enemy` (the kill participants). */
export function threatParticipants(world: World, enemy: Entity): Entity[] {
  const th = world.get<Threat>(enemy, C.Threat);
  return th ? [...th.table.keys()] : [];
}

/** Reset an enemy's threat (on leash-home, respawn, or after paying out a kill). */
export function clearThreat(world: World, enemy: Entity): void {
  world.get<Threat>(enemy, C.Threat)?.table.clear();
}

// XP grants + leveling. Pure simulation. A level-up recomputes derived stats and
// refills resources, then emits events for the HUD/audio.

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Progression,
  type Health,
  type Resource,
} from '../core/ecs/components';
import { xpToNext, LEVEL_CAP } from './stats';
import { recomputeDerived } from './inventory';
import {
  CombatEvent,
  type LevelUpEvent,
  type XpGainedEvent,
} from './combat/events';

/** Grant XP to a player, leveling up (possibly multiple times) as needed. */
export function grantXp(world: World, player: Entity, amount: number): void {
  if (amount <= 0) return;
  const prog = world.get<Progression>(player, C.Progression)!;
  prog.xp += amount;

  let leveled = false;
  while (prog.level < LEVEL_CAP && prog.xp >= prog.xpToNext) {
    prog.xp -= prog.xpToNext;
    prog.level += 1;
    prog.xpToNext = xpToNext(prog.level);
    leveled = true;
  }

  if (leveled) {
    recomputeDerived(world, player);
    const h = world.get<Health>(player, C.Health);
    if (h) h.current = h.max;
    const r = world.get<Resource>(player, C.Resource);
    if (r) r.current = r.max;
    world.events.emit<LevelUpEvent>(CombatEvent.LevelUp, {
      entity: player,
      level: prog.level,
    });
  }

  world.events.emit<XpGainedEvent>(CombatEvent.XpGained, {
    entity: player,
    amount,
    xp: prog.xp,
    xpToNext: prog.xpToNext,
    level: prog.level,
  });
}

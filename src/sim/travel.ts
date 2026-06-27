// Fast travel between activated Oathstones (the discovered waypoint network), for a
// small gold toll and only out of combat. Travelling rebinds your respawn to the
// destination. Pure simulation. See docs/design/WORLD_AND_ZONES.md (Oathstones).

import type { World, Entity } from '../core/ecs/world';
import {
  C,
  type Oathstone,
  type Transform,
  type Inventory,
  type CombatState,
  type Respawn,
} from '../core/ecs/components';
import type { Heightfield } from '../world/heightfield';
import { CombatEvent, type FastTraveledEvent } from './combat/events';

const PLAYER_HALF = 0.9;
/** A small gold sink, per the economy design (ITEMS_AND_EQUIPMENT). */
export const TRAVEL_TOLL = 5;
/** Within this radius you're "at" a stone — you can't fast-travel to where you stand. */
const AT_STONE_RADIUS = 4;

export interface TravelDestination {
  entity: Entity;
  id: string;
  name: string;
  x: number;
  z: number;
}

/** All activated Oathstones (the discovered fast-travel network). */
export function activatedOathstones(world: World): TravelDestination[] {
  const out: TravelDestination[] = [];
  for (const e of world.query(C.Oathstone, C.Transform)) {
    const os = world.get<Oathstone>(e, C.Oathstone)!;
    if (!os.activated) continue;
    const t = world.get<Transform>(e, C.Transform)!;
    out.push({ entity: e, id: os.id, name: os.name, x: t.x, z: t.z });
  }
  return out;
}

export type TravelResult =
  | { ok: true; name: string; cost: number }
  | { ok: false; reason: 'combat' | 'gold' | 'invalid' | 'here' };

/** Fast-travel to an activated Oathstone. Requires out-of-combat + the gold toll. */
export function fastTravel(
  world: World,
  player: Entity,
  destEntity: Entity,
  field: Heightfield,
): TravelResult {
  const os = world.get<Oathstone>(destEntity, C.Oathstone);
  const dt = world.get<Transform>(destEntity, C.Transform);
  if (!os || !os.activated || !dt) return { ok: false, reason: 'invalid' };

  const cs = world.get<CombatState>(player, C.CombatState);
  if (cs?.inCombat) return { ok: false, reason: 'combat' };

  const pt = world.get<Transform>(player, C.Transform)!;
  if (Math.hypot(pt.x - dt.x, pt.z - dt.z) <= AT_STONE_RADIUS) {
    return { ok: false, reason: 'here' };
  }

  const inv = world.get<Inventory>(player, C.Inventory)!;
  if (inv.gold < TRAVEL_TOLL) return { ok: false, reason: 'gold' };
  inv.gold -= TRAVEL_TOLL;

  pt.x = dt.x;
  pt.z = dt.z;
  pt.y = field.sample(dt.x, dt.z) + PLAYER_HALF;
  pt.prevX = pt.x;
  pt.prevY = pt.y;
  pt.prevZ = pt.z;

  // Travelling rebinds your respawn to the destination stone.
  const respawn = world.get<Respawn>(player, C.Respawn);
  if (respawn) {
    respawn.x = dt.x;
    respawn.z = dt.z;
  }

  world.events.emit<FastTraveledEvent>(CombatEvent.FastTraveled, {
    name: os.name,
    cost: TRAVEL_TOLL,
  });
  return { ok: true, name: os.name, cost: TRAVEL_TOLL };
}

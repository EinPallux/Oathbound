// Loot pickup: gold auto-collects on proximity; items are picked up with the interact
// key (F) when standing near a drop. Empty drops are destroyed (render scans live
// drops). Pure simulation. See docs/design/COMBAT_DESIGN.md#12-loot-pickup.

import type { System, World, Entity } from '../../core/ecs/world';
import {
  C,
  type Transform,
  type Inventory,
  type LootDrop,
} from '../../core/ecs/components';
import type { ControlState } from '../../platform/input';
import { addItem } from '../inventory';
import {
  CombatEvent,
  type GoldGainedEvent,
  type LootPickedEvent,
} from '../combat/events';

const GOLD_RADIUS = 2.5;
const PICKUP_RADIUS = 2.5;

export interface LootDeps {
  input: ControlState;
}

export function createLootSystem(deps: LootDeps): System {
  const { input } = deps;

  return {
    name: 'loot',
    update(world: World, _dt: number): void {
      let player: Entity | null = null;
      for (const p of world.query(C.PlayerControlled, C.Transform, C.Inventory)) {
        player = p;
        break;
      }
      if (player == null) return;
      const pt = world.get<Transform>(player, C.Transform)!;
      const inv = world.get<Inventory>(player, C.Inventory)!;
      const wantPickup = input.consumeInteract();

      let nearestItem: Entity | null = null;
      let nearestDist = Infinity;

      for (const e of world.query(C.LootDrop, C.Transform)) {
        const ld = world.get<LootDrop>(e, C.LootDrop)!;
        const lt = world.get<Transform>(e, C.Transform)!;
        const dist = Math.hypot(lt.x - pt.x, lt.z - pt.z);

        // Gold auto-pickup.
        if (ld.gold > 0 && dist <= GOLD_RADIUS) {
          const amount = ld.gold;
          inv.gold += amount;
          ld.gold = 0;
          world.events.emit<GoldGainedEvent>(CombatEvent.GoldGained, {
            amount,
            total: inv.gold,
          });
        }

        if (ld.item && dist <= PICKUP_RADIUS && dist < nearestDist) {
          nearestDist = dist;
          nearestItem = e;
        }

        // Destroy fully-consumed drops.
        if (!ld.item && ld.gold <= 0) world.destroyEntity(e);
      }

      // Pick up the nearest item on interact.
      if (wantPickup && nearestItem != null) {
        const ld = world.get<LootDrop>(nearestItem, C.LootDrop)!;
        if (ld.item && addItem(world, player, ld.item)) {
          world.events.emit<LootPickedEvent>(CombatEvent.LootPicked, { item: ld.item });
          ld.item = null;
          if (ld.gold <= 0) world.destroyEntity(nearestItem);
        }
      }
    },
  };
}

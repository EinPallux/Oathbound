import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Transform,
  type Target,
  type Equipment,
  type CombatState,
} from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { Onboarding } from '../../src/sim/onboarding';
import { generateItem } from '../../src/sim/loot/items';
import { CombatEvent, type DeathEvent, type LootPickedEvent } from '../../src/sim/combat/events';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

function setup() {
  const world = new World();
  const player = createPlayer(world, FIELD, 0, 0);
  const ob = new Onboarding();
  ob.attach(world, player);
  return { world, player, ob };
}

const stepDone = (ob: Onboarding, id: string) => ob.steps.find((s) => s.id === id)!.done;

describe('onboarding tracker', () => {
  it('starts incomplete with "move" as the first step', () => {
    const { world, player, ob } = setup();
    ob.update(world, player);
    expect(ob.isComplete).toBe(false);
    expect(ob.steps[ob.currentIndex].id).toBe('move');
  });

  it('completes each core-loop step from world state + events', () => {
    const { world, player, ob } = setup();
    ob.update(world, player); // anchor the move origin at (0,0)

    // Move.
    world.get<Transform>(player, C.Transform)!.z = 10;
    ob.update(world, player);
    expect(stepDone(ob, 'move')).toBe(true);

    // Target.
    world.get<Target>(player, C.Target)!.entity = 999;
    ob.update(world, player);
    expect(stepDone(ob, 'target')).toBe(true);

    // Defeat (Death event credited to the player).
    world.events.emit<DeathEvent>(CombatEvent.Death, { entity: 999, killer: player });
    ob.update(world, player);
    expect(stepDone(ob, 'defeat')).toBe(true);

    // Loot (LootPicked event).
    const item = generateItem(new Rng(1), { ilvl: 1, slot: 'head', rarity: 'common' });
    world.events.emit<LootPickedEvent>(CombatEvent.LootPicked, { item });
    ob.update(world, player);
    expect(stepDone(ob, 'loot')).toBe(true);

    // Equip (a filled gear slot).
    world.get<Equipment>(player, C.Equipment)!.slots.head = item;
    ob.update(world, player);
    expect(stepDone(ob, 'equip')).toBe(true);

    // Recover (was in combat, now out, at full HP).
    const cs = world.get<CombatState>(player, C.CombatState)!;
    cs.inCombat = true;
    ob.update(world, player);
    cs.inCombat = false;
    ob.update(world, player);
    expect(stepDone(ob, 'recover')).toBe(true);

    expect(ob.isComplete).toBe(true);
    expect(ob.currentIndex).toBe(-1);
  });

  it('skip() marks the whole tutorial complete', () => {
    const { ob } = setup();
    ob.skip();
    expect(ob.isComplete).toBe(true);
    expect(ob.steps.every((s) => s.done)).toBe(true);
  });
});

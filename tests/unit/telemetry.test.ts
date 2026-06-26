import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { Telemetry } from '../../src/sim/telemetry';
import {
  CombatEvent,
  type DamageEvent,
  type DeathEvent,
  type XpGainedEvent,
  type GoldGainedEvent,
  type LootPickedEvent,
  type ItemSalvagedEvent,
  type PlayerDiedEvent,
} from '../../src/sim/combat/events';
import type { Item } from '../../src/core/ecs/components';

const PLAYER = 1;
const ENEMY = 2;

function dmg(source: number, target: number, amount: number): DamageEvent {
  return {
    source,
    target,
    amount,
    isCrit: false,
    damageType: 'physical',
    abilityId: '',
    x: 0,
    y: 0,
    z: 0,
  };
}

const fakeItem = { name: 'x' } as unknown as Item;

describe('Telemetry', () => {
  it('accumulates counters from sim events', () => {
    const world = new World();
    const tele = new Telemetry();
    tele.attach(world, PLAYER);

    world.events.emit<DamageEvent>(CombatEvent.Damage, dmg(PLAYER, ENEMY, 10));
    world.events.emit<DamageEvent>(CombatEvent.Damage, dmg(ENEMY, PLAYER, 4));
    world.events.emit<XpGainedEvent>(CombatEvent.XpGained, {
      entity: PLAYER,
      amount: 12,
      xp: 12,
      xpToNext: 50,
      level: 1,
    });
    world.events.emit<GoldGainedEvent>(CombatEvent.GoldGained, { amount: 5, total: 5 });
    world.events.emit<LootPickedEvent>(CombatEvent.LootPicked, { item: fakeItem });
    world.events.emit<ItemSalvagedEvent>(CombatEvent.ItemSalvaged, {
      itemName: 'x',
      whetstones: 2,
      gold: 3,
    });
    world.events.emit<PlayerDiedEvent>(CombatEvent.PlayerDied, { entity: PLAYER });

    const s = tele.snapshot();
    expect(s.damageDealt).toBe(10);
    expect(s.damageTaken).toBe(4);
    expect(s.xpGained).toBe(12);
    expect(s.goldGained).toBe(5);
    expect(s.itemsLooted).toBe(1);
    expect(s.itemsSalvaged).toBe(1);
    expect(s.deaths).toBe(1);
  });

  it('measures time-to-kill from first hit to death', () => {
    const world = new World();
    const tele = new Telemetry();
    tele.attach(world, PLAYER);

    world.events.emit<DamageEvent>(CombatEvent.Damage, dmg(PLAYER, ENEMY, 10)); // firstHit at t=0
    tele.tick(4);
    world.events.emit<DeathEvent>(CombatEvent.Death, { entity: ENEMY, killer: PLAYER });

    const s = tele.snapshot();
    expect(s.kills).toBe(1);
    expect(s.avgTtk).toBeCloseTo(4, 5);
  });

  it('detach stops counting', () => {
    const world = new World();
    const tele = new Telemetry();
    tele.attach(world, PLAYER);
    tele.detach();
    world.events.emit<DamageEvent>(CombatEvent.Damage, dmg(PLAYER, ENEMY, 10));
    expect(tele.snapshot().damageDealt).toBe(0);
  });
});

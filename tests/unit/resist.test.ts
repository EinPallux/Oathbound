import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Item,
  type Equipment,
  type Defense,
  type Offense,
} from '../../src/core/ecs/components';
import { deriveStats } from '../../src/sim/stats';
import { createPlayer } from '../../src/sim/factory';
import { addItem, equipItem } from '../../src/sim/inventory';
import { spawnEnemy } from '../../src/sim/content/enemies';
import { applyDamage } from '../../src/sim/combat/apply';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

function resistItem(value: number): Item {
  return {
    uid: `r${value}`,
    name: 'Warding Cuirass',
    slot: 'chest',
    rarity: 'rare',
    ilvl: 15,
    primary: { stat: 'VIT', value: 5 },
    armor: 0,
    affixes: [{ id: 'resistBlight', value }],
    score: 0,
    locked: false,
  };
}

/** Blight damage one wisp hit lands on a player whose blight resist is set. */
function blightHit(resistBlight: number): number {
  const world = new World();
  const player = createPlayer(world, FIELD, 0, 0);
  const src = spawnEnemy(world, FIELD, 'wisp', 0, 3, { level: 10 });
  world.get<Offense>(src, C.Offense)!.critChance = 0; // deterministic (no crit)
  world.get<Defense>(player, C.Defense)!.resist.blight = resistBlight;
  return applyDamage(world, src, player, { base: 10, coeff: 1, damageType: 'blight' }, new Rng(42))
    .amount;
}

describe('resistance system', () => {
  it('derives typed resist from gear affixes', () => {
    const eq: Equipment = { slots: { chest: resistItem(60) } };
    const d = deriveStats(15, eq, 'STR');
    expect(d.resist.blight).toBe(60);
    expect(d.resist.fire).toBe(0);
  });

  it('equipping resist gear sets the player Defense.resist', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    const item = resistItem(48);
    addItem(world, player, item);
    equipItem(world, player, item);
    expect(world.get<Defense>(player, C.Defense)!.resist.blight).toBe(48);
  });

  it('blight resist mitigates blight damage (matters, never zero)', () => {
    const none = blightHit(0);
    const warded = blightHit(200);
    expect(warded).toBeLessThan(none);
    expect(warded).toBeGreaterThan(0); // resist never fully negates
  });
});

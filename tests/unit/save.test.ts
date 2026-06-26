import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import {
  C,
  type Progression,
  type Inventory,
  type Equipment,
  type Transform,
  type Offense,
} from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { serialize, applySave, SCHEMA_VERSION } from '../../src/sim/save';
import { grantXp } from '../../src/sim/progression';
import { addItem, equipItem } from '../../src/sim/inventory';
import { generateItem } from '../../src/sim/loot/items';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

describe('save v1 round-trip', () => {
  it('serializes and restores character, gold, gear, inventory, and position', () => {
    const w1 = new World();
    const p1 = createPlayer(w1, FIELD, 0, 0);

    grantXp(w1, p1, 5000); // level up a few times
    const weapon = generateItem(new Rng(1), { ilvl: 5, slot: 'weapon', rarity: 'uncommon' });
    const ring = generateItem(new Rng(2), { ilvl: 5, slot: 'ring1', rarity: 'common' });
    addItem(w1, p1, weapon);
    addItem(w1, p1, ring);
    equipItem(w1, p1, weapon);
    w1.get<Inventory>(p1, C.Inventory)!.gold = 137;
    const tr1 = w1.get<Transform>(p1, C.Transform)!;
    tr1.x = 12;
    tr1.z = -8;

    const data = serialize(w1, p1);
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);

    // Fresh world + player, then load.
    const w2 = new World();
    const p2 = createPlayer(w2, FIELD, 0, 0);
    applySave(w2, p2, data);

    const prog1 = w1.get<Progression>(p1, C.Progression)!;
    const prog2 = w2.get<Progression>(p2, C.Progression)!;
    expect(prog2.level).toBe(prog1.level);
    expect(prog2.xp).toBe(prog1.xp);

    expect(w2.get<Inventory>(p2, C.Inventory)!.gold).toBe(137);
    expect(w2.get<Inventory>(p2, C.Inventory)!.items.length).toBe(1); // ring still bagged
    expect(w2.get<Equipment>(p2, C.Equipment)!.slots.weapon?.uid).toBe(weapon.uid);

    const tr2 = w2.get<Transform>(p2, C.Transform)!;
    expect(tr2.x).toBe(12);
    expect(tr2.z).toBe(-8);

    // Derived stats rebuilt from the restored level + gear.
    const off2 = w2.get<Offense>(p2, C.Offense)!;
    expect(off2.level).toBe(prog1.level);
    expect(off2.primaryStat).toBeGreaterThan(10);
  });
});

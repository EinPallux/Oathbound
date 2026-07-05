// The persistence boundary, pinned. The server stores a character as `serialize(world, player)`
// JSON and restores it with `applySave` — so a serialize → JSON → parse → applySave round-trip
// must preserve the character. This is exactly what M3's SQLite `save_json` column round-trips.

import { describe, it, expect } from 'vitest';
import { Heightfield } from '../../src/world/heightfield';
import { createSimWorld } from '../../src/sim/boot/sim-world';
import { createNullControlState } from '../../src/platform/null-input';
import { serialize, applySave, type SaveData } from '../../src/sim/save';
import { generateItem } from '../../src/sim/loot/items';
import { VOXEL_CUBE, VOXEL_STEP } from '../../src/world/layout';
import {
  C,
  type Inventory,
  type Progression,
  type Transform,
} from '../../src/core/ecs/components';

function world() {
  const res = 65;
  const field = new Heightfield(128, res, new Float32Array(res * res));
  field.voxelCube = VOXEL_CUBE;
  field.voxelStep = VOXEL_STEP;
  return createSimWorld({
    field,
    colliders: [],
    boxes: [],
    playerStart: { x: 0, z: 0 },
    spawns: [],
    bosses: [],
    oathstones: [{ id: 'home', name: 'Home', x: 0, z: 0 }],
    vendor: { name: 'Quartermaster', x: 3, z: -3 },
    input: createNullControlState(),
    playerClass: 'hunter',
  });
}

describe('save round-trip (the SQLite save_json boundary)', () => {
  it('serialize → JSON → parse → applySave preserves the character', () => {
    const a = world();
    const pa = a.player!;

    // Mutate the character: gold, level, an item, a moved position.
    const inv = a.world.get<Inventory>(pa, C.Inventory)!;
    inv.gold = 4321;
    inv.materials = 7;
    const item = generateItem(a.rng, { ilvl: 5, slot: 'weapon', rarity: 'rare', primaryStat: 'DEX' });
    inv.items.push(item);
    const prog = a.world.get<Progression>(pa, C.Progression)!;
    prog.level = 8;
    prog.xp = 150;
    const tr = a.world.get<Transform>(pa, C.Transform)!;
    tr.x = 42;
    tr.z = -17;

    // The exact DB path: serialize → JSON string → parse back.
    const stored = JSON.stringify(serialize(a.world, pa));
    const restored = JSON.parse(stored) as SaveData;

    // Apply onto a fresh world's player (as the server does on login).
    const b = world();
    const pb = b.player!;
    applySave(b.world, pb, restored);

    const invB = b.world.get<Inventory>(pb, C.Inventory)!;
    const progB = b.world.get<Progression>(pb, C.Progression)!;
    const trB = b.world.get<Transform>(pb, C.Transform)!;

    expect(invB.gold).toBe(4321);
    expect(invB.materials).toBe(7);
    expect(invB.items.length).toBe(1);
    expect(invB.items[0].uid).toBe(item.uid);
    expect(invB.items[0].name).toBe(item.name);
    expect(progB.level).toBe(8);
    expect(progB.xp).toBe(150);
    expect(trB.x).toBe(42);
    expect(trB.z).toBe(-17);
    expect(restored.classId).toBe('hunter');
  });
});

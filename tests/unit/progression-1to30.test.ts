import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Progression } from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { grantXp } from '../../src/sim/progression';
import { getClass, resolveKit, empowerKit } from '../../src/sim/classes';
import { LEVEL_CAP } from '../../src/sim/stats';
import { flatField } from './helpers';

const FIELD = flatField();
const CLASSES = ['warrior', 'hunter', 'priest'] as const;

describe('full 1→30 progression', () => {
  for (const id of CLASSES) {
    it(`${id} reaches the level cap on the XP curve with its full kit + capstone`, () => {
      const world = new World();
      const player = createPlayer(world, FIELD, 0, 0, id);
      grantXp(world, player, 5_000_000); // plenty to cap out

      const prog = world.get<Progression>(player, C.Progression)!;
      expect(prog.level).toBe(LEVEL_CAP);
      expect(LEVEL_CAP).toBe(30);

      const cls = getClass(id);
      const kit = resolveKit(cls);
      // The kit is the fixed 10 slots, and everything unlocks by 30 (no dead slots).
      expect(kit.length).toBe(10);
      for (const a of kit) expect(a.unlockLevel ?? 1).toBeLessThanOrEqual(30);

      // The Lv-30 capstone is active: the target ability now wears the capstone name.
      const empowered = empowerKit(cls, kit, prog.level);
      const target = empowered.find((a) => a.id === cls.capstone.targetId)!;
      expect(target.name).toBe(cls.capstone.name);
    });
  }
});

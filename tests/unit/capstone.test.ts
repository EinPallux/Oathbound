import { describe, it, expect } from 'vitest';
import { World } from '../../src/core/ecs/world';
import { C, type Offense, type Defense } from '../../src/core/ecs/components';
import {
  getClass,
  resolveKit,
  empowerKit,
  empowerAbility,
  CAPSTONE_LEVEL,
} from '../../src/sim/classes';
import type { AbilityDef } from '../../src/sim/combat/abilities';
import { createPlayer } from '../../src/sim/factory';
import { spawnEnemy } from '../../src/sim/content/enemies';
import { applyDamage } from '../../src/sim/combat/apply';
import { Rng } from '../../src/core/rng';
import { flatField } from './helpers';

const FIELD = flatField();

const find = (kit: readonly AbilityDef[], id: string): AbilityDef =>
  kit.find((a) => a.id === id)!;

describe('Lv-30 capstone (upgrade-style, no new button)', () => {
  it('every class capstone targets a real ability in its kit', () => {
    for (const id of ['warrior', 'hunter', 'priest'] as const) {
      const cls = getClass(id);
      expect(resolveKit(cls).some((a) => a.id === cls.capstone.targetId)).toBe(true);
    }
  });

  it('below Lv 30 it is a no-op (same references)', () => {
    const cls = getClass('warrior');
    const kit = resolveKit(cls);
    expect(empowerKit(cls, kit, CAPSTONE_LEVEL - 1)).toBe(kit);
    const whirl = find(kit, 'whirl');
    expect(empowerAbility(cls, whirl, CAPSTONE_LEVEL - 1)).toBe(whirl);
  });

  it('at Lv 30 it renames + strengthens the target ability', () => {
    const cls = getClass('warrior');
    const whirl = find(resolveKit(cls), 'whirl');
    const up = empowerAbility(cls, whirl, CAPSTONE_LEVEL);
    expect(up).not.toBe(whirl);
    expect(up.name).toBe("Oathbreaker's Wrath");
    expect(up.base).toBeGreaterThan(whirl.base);
    expect(up.coeff).toBeGreaterThan(whirl.coeff);
    expect(up.radius).toBeGreaterThan(whirl.radius); // radiusBonus
  });

  it('leaves non-target abilities untouched at Lv 30', () => {
    const cls = getClass('warrior');
    const kit = resolveKit(cls);
    const sunder = find(kit, 'sunder');
    expect(empowerAbility(cls, sunder, CAPSTONE_LEVEL)).toBe(sunder);
    expect(empowerKit(cls, kit, CAPSTONE_LEVEL).find((a) => a.id === 'sunder')).toBe(sunder);
  });

  it('the empowered ability deals more damage through the real formula', () => {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0);
    world.get<Offense>(player, C.Offense)!.critChance = 0; // deterministic
    const cls = getClass('warrior');
    const whirl = find(resolveKit(cls), 'whirl');
    const up = empowerAbility(cls, whirl, CAPSTONE_LEVEL);

    const hit = (def: AbilityDef): number => {
      const dummy = spawnEnemy(world, FIELD, 'bloomhusk', 0, 3, { level: 30 });
      world.get<Defense>(dummy, C.Defense)!.weakness = {};
      return applyDamage(
        world, player, dummy,
        { base: def.base, coeff: def.coeff, damageType: def.damageType },
        new Rng(5),
      ).amount;
    };
    expect(hit(up)).toBeGreaterThan(hit(whirl));
  });

  it('Hunter and Priest capstones empower their signature spender', () => {
    const hunter = getClass('hunter');
    const pa = find(resolveKit(hunter), 'piercing-arrow');
    const paUp = empowerAbility(hunter, pa, CAPSTONE_LEVEL);
    expect(paUp.name).toBe('Rapid Fusillade');
    expect(paUp.coeff).toBeGreaterThan(pa.coeff);

    const priest = getClass('priest');
    const sl = find(resolveKit(priest), 'searing-light');
    const slUp = empowerAbility(priest, sl, CAPSTONE_LEVEL);
    expect(slUp.name).toBe('Dawnbreak');
    expect(slUp.coeff).toBeGreaterThan(sl.coeff);
  });
});

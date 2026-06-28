// World-boss tests (0.6.0 CP2): spawn shape, Legendary-leaning loot, a solo-kill
// balance sim (no HP wall, not trivial, heavies punish but don't one-shot a level-geared
// player), and the telegraphed heavy-attack mechanic (boss-ai → GroundAoe → player).

import { describe, it, expect } from 'vitest';
import { World, type Entity } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Offense,
  type Defense,
  type Enemy,
  type Boss,
  type GroundAoe,
  type Transform,
  type PrimaryStatId,
} from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { spawnBoss, BOSSES, type BossId } from '../../src/sim/content/bosses';
import { createBossAiSystem } from '../../src/sim/systems/boss-ai';
import { createGroundAoeSystem } from '../../src/sim/systems/ground-aoe';
import { applyDamage } from '../../src/sim/combat/apply';
import { computeDamage } from '../../src/sim/combat/damage';
import { rollLoot } from '../../src/sim/loot/droptable';
import { getClass, resolveKit, empowerKit } from '../../src/sim/classes';
import { generateItem, EQUIP_SLOTS } from '../../src/sim/loot/items';
import { addItem, equipItem } from '../../src/sim/inventory';
import { CombatEvent, type BossPhaseEvent } from '../../src/sim/combat/events';
import { GCD } from '../../src/sim/combat/abilities';
import { Rng } from '../../src/core/rng';
import { setLevel, flatField } from './helpers';

const FIELD = flatField(600);

const CLASSES: { id: 'warrior' | 'hunter' | 'priest'; primary: 'STR' | 'DEX' | 'SPR'; spender: string }[] = [
  { id: 'warrior', primary: 'STR', spender: 'sunder' },
  { id: 'hunter', primary: 'DEX', spender: 'piercing-arrow' },
  { id: 'priest', primary: 'SPR', spender: 'searing-light' },
];

const BOSS_IDS = Object.keys(BOSSES) as BossId[];

/** Equip a full set of level-appropriate Uncommon gear (a realistically-geared player). */
function gearUp(world: World, player: Entity, ilvl: number, primary: PrimaryStatId): void {
  const p = primary === 'VIT' ? 'STR' : primary;
  for (let i = 0; i < EQUIP_SLOTS.length; i++) {
    const it = generateItem(new Rng(ilvl * 131 + i * 7 + 1), {
      ilvl,
      slot: EQUIP_SLOTS[i],
      rarity: 'uncommon',
      primaryStat: p,
    });
    addItem(world, player, it);
    equipItem(world, player, it);
  }
}

describe('world bosses — spawn shape', () => {
  for (const id of BOSS_IDS) {
    it(`${id} spawns as a tier-boss enemy with a Boss component and huge HP`, () => {
      const world = new World();
      const e = spawnBoss(world, FIELD, id, 0, 0);
      const en = world.get<Enemy>(e, C.Enemy)!;
      const boss = world.get<Boss>(e, C.Boss)!;
      const h = world.get<Health>(e, C.Health)!;

      expect(en.tier).toBe('boss');
      expect(en.socialRange).toBe(0); // lone boss, no pack rally
      expect(h.max).toBeGreaterThan(5000);
      expect(boss.bossId).toBe(id);
      expect(boss.phase).toBe(0);
      // One cadence entry per phase (phases = thresholds + 1), strictly easing... faster.
      expect(boss.heavyCadence).toHaveLength(boss.phaseThresholds.length + 1);
      for (let i = 1; i < boss.heavyCadence.length; i++) {
        expect(boss.heavyCadence[i]).toBeLessThan(boss.heavyCadence[i - 1]);
      }
      // Thresholds strictly descending in (0, 1).
      for (let i = 0; i < boss.phaseThresholds.length; i++) {
        expect(boss.phaseThresholds[i]).toBeGreaterThan(0);
        expect(boss.phaseThresholds[i]).toBeLessThan(1);
        if (i > 0) expect(boss.phaseThresholds[i]).toBeLessThan(boss.phaseThresholds[i - 1]);
      }
    });
  }
});

describe('world bosses — loot is Legendary-leaning', () => {
  it('always drops Rare-or-better, never common/uncommon, with a real Legendary tail', () => {
    const rng = new Rng(123);
    const counts: Record<string, number> = {};
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const item = rollLoot(rng, 30, 'boss', 1, 'STR').item;
      expect(item, 'boss always drops an item').not.toBeNull();
      counts[item!.rarity] = (counts[item!.rarity] ?? 0) + 1;
    }
    expect(counts.common ?? 0).toBe(0);
    expect(counts.uncommon ?? 0).toBe(0);
    expect(counts.rare ?? 0).toBeGreaterThan(0);
    expect(counts.epic ?? 0).toBeGreaterThan(0);
    expect(counts.legendary ?? 0).toBeGreaterThan(0);
    // Legendary is the rare prize, not the common case.
    expect((counts.legendary ?? 0) / N).toBeLessThan(0.3);
    expect((counts.legendary ?? 0) / N).toBeGreaterThan(0.05);
  });
});

describe('world bosses — solo balance (every class, no wall / not trivial / no one-shot)', () => {
  for (const cls of CLASSES) {
    for (const id of BOSS_IDS) {
      const def = BOSSES[id];
      it(`${cls.id} can solo ${id} (Lv ${def.level}) in a sane time and survives its hits`, () => {
        const world = new World();
        const player = createPlayer(world, FIELD, 0, 0, cls.id);
        setLevel(world, player, def.level);
        gearUp(world, player, def.level, cls.primary);
        world.get<Offense>(player, C.Offense)!.critChance = 0; // deterministic floor

        const cdef = getClass(cls.id);
        const kit = empowerKit(cdef, resolveKit(cdef), def.level);
        const spender = kit.find((a) => a.id === cls.spender)!;

        const e = spawnBoss(world, FIELD, id, 0, 6);
        const bossHp = world.get<Health>(e, C.Health)!.max;

        // Per-cast spender damage (deterministic, no crit) → optimistic sustained DPS.
        const perCast = applyDamage(
          world, player, e,
          { base: spender.base, coeff: spender.coeff, damageType: spender.damageType },
          new Rng(42),
        ).amount;
        expect(perCast, 'deals damage (no immunity)').toBeGreaterThan(0);

        // Optimistic seconds: one spender per GCD with no crit (an upper bound on DPS,
        // so the *real* fight is somewhat longer). Bounds it both ways: no HP wall, and
        // not a trivial tank-and-spank.
        const ttk = (bossHp / perCast) * GCD;
        expect(ttk, `${cls.id} vs ${id} TTK=${ttk.toFixed(0)}s`).toBeLessThan(360);
        expect(ttk, `${cls.id} vs ${id} TTK=${ttk.toFixed(0)}s`).toBeGreaterThan(40);

        // A basic swing is dangerous but not a one-shot on a level-geared player.
        const en = world.get<Enemy>(e, C.Enemy)!;
        const playerHp = world.get<Health>(player, C.Health)!.max;
        const basic = applyDamage(
          world, e, player,
          { base: en.attackBase, coeff: en.attackCoeff, damageType: en.attackType },
          new Rng(7),
        ).amount;
        expect(basic, 'basic not a one-shot').toBeLessThan(playerHp * 0.7);

        // The telegraphed heavy hurts much more than a basic — but is still survivable
        // from full (you're meant to step out of it).
        const boss = world.get<Boss>(e, C.Boss)!;
        const off = world.get<Offense>(e, C.Offense)!;
        const def2 = world.get<Defense>(player, C.Defense)!;
        const heavy = computeDamage(
          { base: boss.heavyBase, coeff: boss.heavyCoeff, damageType: boss.heavyType },
          { primaryStat: off.primaryStat, level: off.level, critChance: 0, critMult: off.critMult },
          def2,
          { isCrit: false, variance: 1 },
        ).amount;
        expect(heavy, 'heavy hits harder than a basic').toBeGreaterThan(basic);
        expect(heavy, 'heavy is punishing').toBeGreaterThan(playerHp * 0.15);
        expect(heavy, 'heavy not a one-shot from full').toBeLessThan(playerHp * 0.95);
      });
    }
  }
});

describe('world bosses — phases escalate from HP', () => {
  it('emits a phase event each time HP crosses a threshold, never on the opener', () => {
    const world = new World();
    createPlayer(world, FIELD, 0, 0, 'warrior');
    const e = spawnBoss(world, FIELD, 'maelgrith', 0, 6); // 4-phase boss
    const boss = world.get<Boss>(e, C.Boss)!;
    const h = world.get<Health>(e, C.Health)!;
    const en = world.get<Enemy>(e, C.Enemy)!;
    en.state = 'engage';

    const events: BossPhaseEvent[] = [];
    world.events.on<BossPhaseEvent>(CombatEvent.BossPhase, (ev) => events.push(ev));
    const sys = createBossAiSystem({ field: FIELD });

    // Full HP → phase 0, no announcement.
    sys.update(world, 0.033);
    expect(boss.phase).toBe(0);
    expect(events).toHaveLength(0);

    // Walk HP down across every threshold; each crossing announces the next phase.
    const totalPhases = boss.phaseThresholds.length + 1;
    for (let i = 0; i < boss.phaseThresholds.length; i++) {
      h.current = h.max * (boss.phaseThresholds[i] - 0.01);
      sys.update(world, 0.033);
      expect(boss.phase).toBe(i + 1);
      expect(events[events.length - 1].phase).toBe(i + 2); // 1-based display
      expect(events[events.length - 1].totalPhases).toBe(totalPhases);
    }
    expect(events).toHaveLength(boss.phaseThresholds.length);
  });
});

describe('world bosses — telegraphed heavy attack', () => {
  function setup(): { world: World; player: Entity; boss: Entity } {
    const world = new World();
    const player = createPlayer(world, FIELD, 0, 0, 'warrior');
    setLevel(world, player, 20);
    const boss = spawnBoss(world, FIELD, 'emberhorn', 0, 6);
    world.get<Enemy>(boss, C.Enemy)!.state = 'attack'; // actively fighting
    return { world, player, boss };
  }

  it('drops a player-targeting GroundAoe at the player after the cadence elapses', () => {
    const { world, boss } = setup();
    world.get<Boss>(boss, C.Boss)!.heavyTimer = 0.02;
    createBossAiSystem({ field: FIELD }).update(world, 0.033);

    const zones = [...world.query(C.GroundAoe, C.Transform)];
    expect(zones).toHaveLength(1);
    const g = world.get<GroundAoe>(zones[0], C.GroundAoe)!;
    expect(g.hitsPlayer).toBe(true);
    expect(g.source).toBe(boss);
    const gt = world.get<Transform>(zones[0], C.Transform)!;
    expect(gt.x).toBeCloseTo(0); // dropped at the player's position (0,0)
    expect(gt.z).toBeCloseTo(0);
  });

  it('hits a player who stands in it, but misses one who steps out', () => {
    const rng = new Rng(5);
    const ground = createGroundAoeSystem(rng);

    // (a) Stand in it → takes the hit.
    {
      const { world, player, boss } = setup();
      world.get<Boss>(boss, C.Boss)!.heavyTimer = 0.02;
      createBossAiSystem({ field: FIELD }).update(world, 0.033);
      const hpBefore = world.get<Health>(player, C.Health)!.current;
      for (let i = 0; i < 60; i++) ground.update(world, 0.05); // elapse the telegraph
      const hpAfter = world.get<Health>(player, C.Health)!.current;
      expect(hpAfter, 'standing in the zone is punished').toBeLessThan(hpBefore);
    }

    // (b) Step out before it lands → unharmed.
    {
      const { world, player, boss } = setup();
      world.get<Boss>(boss, C.Boss)!.heavyTimer = 0.02;
      createBossAiSystem({ field: FIELD }).update(world, 0.033);
      const hpBefore = world.get<Health>(player, C.Health)!.current;
      const pt = world.get<Transform>(player, C.Transform)!;
      pt.x = 40; // walk well clear of the telegraph
      pt.z = 40;
      for (let i = 0; i < 60; i++) ground.update(world, 0.05);
      const hpAfter = world.get<Health>(player, C.Health)!.current;
      expect(hpAfter, 'stepping out avoids the heavy').toBe(hpBefore);
    }
  });
});

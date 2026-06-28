// Endgame Foundation Gate (0.6.0 CP4): the Lv-30 loop validated end-to-end —
//  - guidance data integrity (the target-farming board + collection helpers),
//  - relic collection discovery + save persistence,
//  - every class beats every world boss solo with an endgame loadout, with the
//    full-Legendary power sitting a *bounded* margin above the uncommon baseline,
//  - target farming yields wanted upgrades within a focused session (bad-luck protection).
// See docs/design/ENDGAME_FOUNDATION.md#gate.

import { describe, it, expect } from 'vitest';
import { World, type Entity } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Offense,
  type Transform,
  type LootDrop,
  type RelicCollection,
  type Rarity,
  type PrimaryStatId,
} from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { spawnBoss, BOSSES, type BossId } from '../../src/sim/content/bosses';
import { applyDamage } from '../../src/sim/combat/apply';
import { getClass, resolveKit, empowerKit } from '../../src/sim/classes';
import { generateItem, EQUIP_SLOTS } from '../../src/sim/loot/items';
import { addItem, equipItem } from '../../src/sim/inventory';
import { makeRelic, RELIC_DROPS, RELICS, type RelicId } from '../../src/sim/loot/relics';
import { rollLoot, pityMultiplier, isRarePlus } from '../../src/sim/loot/droptable';
import { pickUpNearest } from '../../src/sim/systems/loot';
import { serialize, applySave } from '../../src/sim/save';
import { regionAt } from '../../src/sim/content/regions';
import {
  ENDGAME_TARGETS,
  ALL_RELIC_IDS,
  relicProgress,
  nextRelicTarget,
  uncollectedRelics,
} from '../../src/sim/content/endgame';
import { GCD } from '../../src/sim/combat/abilities';
import { Rng } from '../../src/core/rng';
import { setLevel, flatField } from './helpers';

const FIELD = flatField(600);

const CLASSES: { id: 'warrior' | 'hunter' | 'priest'; primary: PrimaryStatId; spender: string }[] = [
  { id: 'warrior', primary: 'STR', spender: 'sunder' },
  { id: 'hunter', primary: 'DEX', spender: 'piercing-arrow' },
  { id: 'priest', primary: 'SPR', spender: 'searing-light' },
];

function gearUp(world: World, player: Entity, ilvl: number, primary: PrimaryStatId, rarity: Rarity): void {
  const p = primary === 'VIT' ? 'STR' : primary;
  for (let i = 0; i < EQUIP_SLOTS.length; i++) {
    const it = generateItem(new Rng(ilvl * 131 + i * 7 + 1), { ilvl, slot: EQUIP_SLOTS[i], rarity, primaryStat: p });
    addItem(world, player, it);
    equipItem(world, player, it);
  }
}

/** Build a geared level-`level` player and return its per-cast spender damage vs `bossId`. */
function perCastVsBoss(
  cls: (typeof CLASSES)[number],
  level: number,
  bossId: BossId,
  rarity: Rarity,
  relicId?: RelicId,
): { dmg: number; bossHp: number } {
  const world = new World();
  const player = createPlayer(world, FIELD, 0, 0, cls.id);
  setLevel(world, player, level);
  gearUp(world, player, level, cls.primary, rarity);
  if (relicId) {
    const it = makeRelic(new Rng(level * 3 + 1), relicId);
    addItem(world, player, it);
    equipItem(world, player, it);
  }
  world.get<Offense>(player, C.Offense)!.critChance = 0;

  const cdef = getClass(cls.id);
  const spender = empowerKit(cdef, resolveKit(cdef), level).find((a) => a.id === cls.spender)!;
  const boss = spawnBoss(world, FIELD, bossId, 0, 6);
  const bossHp = world.get<Health>(boss, C.Health)!.max;
  const dmg = applyDamage(
    world, player, boss,
    { base: spender.base, coeff: spender.coeff, damageType: spender.damageType },
    new Rng(42),
  ).amount;
  return { dmg, bossHp };
}

describe('endgame guidance — data integrity', () => {
  it('one target per boss, each with at least one relic, located in its declared zone', () => {
    expect(ENDGAME_TARGETS).toHaveLength((Object.keys(BOSSES) as BossId[]).length);
    for (const t of ENDGAME_TARGETS) {
      expect(t.relics.length).toBeGreaterThanOrEqual(1);
      expect(regionAt(t.x, t.z).id).toBe(t.zoneId); // guide location matches the world
      for (const r of t.relics) {
        expect(RELICS[r.id]).toBeTruthy();
        expect(r.effect.length).toBeGreaterThan(0);
      }
    }
  });

  it('every relic has exactly one boss source (full, non-overlapping coverage)', () => {
    const sourced = ENDGAME_TARGETS.flatMap((t) => t.relics.map((r) => r.id));
    expect(new Set(sourced).size).toBe(sourced.length); // no relic from two bosses
    expect([...sourced].sort()).toEqual([...ALL_RELIC_IDS].sort());
  });

  it('progress + next-target helpers walk the chase correctly', () => {
    expect(relicProgress([])).toEqual({ have: 0, total: ALL_RELIC_IDS.length });
    expect(relicProgress(ALL_RELIC_IDS)).toEqual({ have: ALL_RELIC_IDS.length, total: ALL_RELIC_IDS.length });

    const first = nextRelicTarget([]);
    expect(first?.bossId).toBe('emberhorn'); // first uncollected
    // Collect Emberhorn's relic → the next target advances.
    const afterFirst = nextRelicTarget(RELIC_DROPS.emberhorn);
    expect(afterFirst?.bossId).toBe('rimewyrm');
    // Collect everything → no target left.
    expect(nextRelicTarget(ALL_RELIC_IDS)).toBeNull();

    const ember = ENDGAME_TARGETS.find((t) => t.bossId === 'emberhorn')!;
    expect(uncollectedRelics(ember, []).length).toBe(ember.relics.length);
    expect(uncollectedRelics(ember, RELIC_DROPS.emberhorn).length).toBe(0);
  });
});

describe('endgame — relic collection (discovery + persistence)', () => {
  function dropRelicAt(world: World, owner: Entity, id: RelicId, x: number, z: number): void {
    const e = world.createEntity();
    world.set<Transform>(e, C.Transform, { x, y: 0, z, yaw: 0, prevX: x, prevY: 0, prevZ: z, prevYaw: 0 });
    world.set<LootDrop>(e, C.LootDrop, { item: makeRelic(new Rng(7), id), gold: 0, owner, ttl: 999 });
  }

  it('picking up a relic records it in the collection (deduped)', () => {
    const world = new World();
    const p = createPlayer(world, FIELD, 0, 0, 'warrior');
    dropRelicAt(world, p, 'ashbrand', 0, 0);
    expect(pickUpNearest(world)?.relic).toBe('ashbrand');
    expect(world.get<RelicCollection>(p, C.RelicCollection)!.discovered).toEqual(['ashbrand']);

    dropRelicAt(world, p, 'ashbrand', 0, 0); // a second Ashbrand
    pickUpNearest(world);
    expect(world.get<RelicCollection>(p, C.RelicCollection)!.discovered).toEqual(['ashbrand']); // no dup
  });

  it('the collection persists across save, and reconciles from an equipped relic', () => {
    const world = new World();
    const p = createPlayer(world, FIELD, 0, 0, 'warrior');
    world.get<RelicCollection>(p, C.RelicCollection)!.discovered = ['rimewyrm-heart'];
    // Also equip a different relic that isn't in the discovered list yet.
    const crown = makeRelic(new Rng(2), 'hollow-crown');
    addItem(world, p, crown);
    equipItem(world, p, crown);
    const data = serialize(world, p);
    expect(data.relics).toContain('rimewyrm-heart');

    const w2 = new World();
    const p2 = createPlayer(w2, FIELD, 0, 0, 'warrior');
    applySave(w2, p2, data);
    const got = w2.get<RelicCollection>(p2, C.RelicCollection)!.discovered;
    expect(got).toContain('rimewyrm-heart'); // from the saved set
    expect(got).toContain('hollow-crown'); // reconciled from the equipped relic
  });
});

describe('Endgame Foundation Gate — every class solos every boss with endgame gear', () => {
  for (const cls of CLASSES) {
    for (const id of Object.keys(BOSSES) as BossId[]) {
      const def = BOSSES[id];
      it(`${cls.id} beats ${id} with full Legendary + its Relic, a bounded step above baseline`, () => {
        const relicId = RELIC_DROPS[id][0];
        const uncommon = perCastVsBoss(cls, def.level, id, 'uncommon');
        const legendary = perCastVsBoss(cls, def.level, id, 'legendary');
        const geared = perCastVsBoss(cls, def.level, id, 'legendary', relicId);

        // Endgame loadout clears the boss as a real (but quicker) solo fight.
        const ttk = (geared.bossHp / geared.dmg) * GCD;
        expect(geared.dmg, 'deals damage').toBeGreaterThan(0);
        expect(ttk, `${cls.id} vs ${id} geared TTK=${ttk.toFixed(0)}s`).toBeGreaterThan(12);
        expect(ttk, `${cls.id} vs ${id} geared TTK=${ttk.toFixed(0)}s`).toBeLessThan(300);

        // Soft power ceiling: Legendary is a real upgrade over uncommon, but a *bounded*
        // one (per-cast is a proxy; the margin must stay re-tunable, not runaway).
        const ratio = legendary.dmg / uncommon.dmg;
        expect(ratio, `${cls.id} vs ${id} power ratio=${ratio.toFixed(2)}`).toBeGreaterThan(1.0);
        expect(ratio, `${cls.id} vs ${id} power ratio=${ratio.toFixed(2)}`).toBeLessThan(3.0);
      });
    }
  }
});

describe('Endgame Foundation Gate — target farming yields upgrades (bad-luck protection)', () => {
  // Model a focused farming session on an elite source with the real pity logic.
  function killsToFirstRarePlus(seed: number): number {
    const rng = new Rng(seed);
    let pity = 0;
    for (let k = 1; k <= 500; k++) {
      const item = rollLoot(rng, 30, 'elite', 1, 'STR', pityMultiplier(pity)).item;
      if (item && isRarePlus(item.rarity)) return k;
      pity += 1;
    }
    return Infinity;
  }

  it('a rare-or-better drop always arrives within a focused session (no infinite dry streak)', () => {
    let worst = 0;
    for (let s = 0; s < 300; s++) worst = Math.max(worst, killsToFirstRarePlus(s));
    expect(worst).toBeLessThanOrEqual(40); // bad-luck protection bounds the dry streak
  });

  it('a focused session accumulates several upgrade candidates (rare+)', () => {
    const rng = new Rng(123);
    let pity = 0;
    let rarePlus = 0;
    for (let k = 0; k < 40; k++) {
      const item = rollLoot(rng, 30, 'elite', 1, 'STR', pityMultiplier(pity)).item;
      if (item && isRarePlus(item.rarity)) {
        rarePlus++;
        pity = 0;
      } else {
        pity += 1;
      }
    }
    expect(rarePlus).toBeGreaterThanOrEqual(5); // enough pulls to land a wanted-slot upgrade
  });

  it('a world boss reliably yields rare+ gear (its floor is rare)', () => {
    const rng = new Rng(9);
    for (let k = 0; k < 50; k++) {
      const item = rollLoot(rng, 30, 'boss', 1, 'STR').item;
      expect(item && isRarePlus(item.rarity)).toBe(true);
    }
  });
});

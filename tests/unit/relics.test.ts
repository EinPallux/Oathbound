// Relic tests (0.6.0 CP3): instantiation, the effect-aggregation bundle, all four
// build-enabling effect hooks (execute / boss-slayer / reaper / bloodcrit) driven
// through the *real* damage + kill code, the boss drop logic, and save round-trip.

import { describe, it, expect } from 'vitest';
import { World, type Entity } from '../../src/core/ecs/world';
import {
  C,
  type Health,
  type Offense,
  type AbilityState,
  type RelicMods,
  type Equipment,
  type Item,
} from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { spawnEnemy } from '../../src/sim/content/enemies';
import { spawnBoss } from '../../src/sim/content/bosses';
import {
  RELICS,
  RELIC_DROPS,
  makeRelic,
  relicModsFromEquipment,
  rollRelicDrop,
  relicEffectDesc,
  type RelicId,
} from '../../src/sim/loot/relics';
import { addItem, equipItem } from '../../src/sim/inventory';
import { applyDamage } from '../../src/sim/combat/apply';
import { rewardKill } from '../../src/sim/rewards';
import { isRarePlus } from '../../src/sim/loot/droptable';
import { serialize, applySave } from '../../src/sim/save';
import { Rng } from '../../src/core/rng';
import { setLevel, flatField } from './helpers';

const FIELD = flatField(600);
const RELIC_IDS = Object.keys(RELICS) as RelicId[];

/** Make a level-30 player and equip the named relic (recomputes the mods bundle). */
function playerWithRelic(world: World, id: RelicId | null): Entity {
  const p = createPlayer(world, FIELD, 0, 0, 'warrior');
  setLevel(world, p, 30);
  if (id) {
    const it = makeRelic(new Rng(id.length * 7 + 1), id);
    addItem(world, p, it);
    equipItem(world, p, it);
  }
  return p;
}

describe('relics — instantiation', () => {
  for (const id of RELIC_IDS) {
    it(`${id} makes a relic-rarity unique with a fixed effect and strong score`, () => {
      const it = makeRelic(new Rng(1), id);
      expect(it.rarity).toBe('relic');
      expect(it.relic).toBe(id);
      expect(it.slot).toBe(RELICS[id].slot);
      expect(it.locked).toBe(true); // apex drops protected from accidental salvage
      expect(it.affixes.length).toBeGreaterThanOrEqual(3);
      expect(it.score).toBeGreaterThan(0);
      expect(relicEffectDesc(id)).toBe(RELICS[id].effectDesc);
    });
  }

  it('relics counts as rare+ for bad-luck protection', () => {
    expect(isRarePlus('relic')).toBe(true);
  });
});

describe('relics — effect aggregation', () => {
  it('no relic → an all-zero mods bundle', () => {
    const world = new World();
    const p = playerWithRelic(world, null);
    const m = world.get<RelicMods>(p, C.RelicMods)!;
    expect(m).toEqual({
      executeThreshold: 0,
      executeMult: 0,
      bossDamageBonus: 0,
      bossDamageResist: 0,
      critLeech: 0,
      killHealFrac: 0,
      killCdr: 0,
    });
  });

  it('each relic contributes its own fields', () => {
    const eqWith = (id: RelicId): Equipment => {
      const w = new World();
      const p = playerWithRelic(w, id);
      return w.get<Equipment>(p, C.Equipment)!;
    };
    expect(relicModsFromEquipment(eqWith('ashbrand'))).toMatchObject({ executeThreshold: 0.35, executeMult: 0.5 });
    expect(relicModsFromEquipment(eqWith('rimewyrm-heart'))).toMatchObject({ bossDamageBonus: 0.2, bossDamageResist: 0.15 });
    expect(relicModsFromEquipment(eqWith('hollow-crown'))).toMatchObject({ killHealFrac: 0.08, killCdr: 1.5 });
    expect(relicModsFromEquipment(eqWith('bloodroot-sigil'))).toMatchObject({ critLeech: 0.25 });
  });

  it('stacks effects from multiple equipped relics', () => {
    const world = new World();
    const p = playerWithRelic(world, 'hollow-crown'); // head
    const ring = makeRelic(new Rng(3), 'bloodroot-sigil'); // ring1 — different slot
    addItem(world, p, ring);
    equipItem(world, p, ring);
    const m = world.get<RelicMods>(p, C.RelicMods)!;
    expect(m.killHealFrac).toBeCloseTo(0.08);
    expect(m.killCdr).toBeCloseTo(1.5);
    expect(m.critLeech).toBeCloseTo(0.25);
  });
});

describe('relics — combat effect hooks', () => {
  const HIT = { base: 20, coeff: 1.5, damageType: 'physical' as const };

  it('execute (Ashbrand): +50% damage to a low-HP target vs a full-HP one', () => {
    const world = new World();
    const p = playerWithRelic(world, 'ashbrand');
    const full = spawnEnemy(world, FIELD, 'bonewrought', 0, 4, { level: 30 });
    const low = spawnEnemy(world, FIELD, 'bonewrought', 0, -4, { level: 30 });
    world.get<Health>(low, C.Health)!.current = world.get<Health>(low, C.Health)!.max * 0.2;
    world.get<Offense>(p, C.Offense)!.critChance = 0;

    const dHigh = applyDamage(world, p, full, HIT, new Rng(9)).amount;
    const dLow = applyDamage(world, p, low, HIT, new Rng(9)).amount;
    expect(dLow).toBeGreaterThan(dHigh);
    expect(dLow / dHigh).toBeCloseTo(1.5, 1);
  });

  it('boss-slayer (Heart): +20% damage dealt to bosses, −15% taken from them', () => {
    // Outgoing: Heart adds only HP/armor/frost-resist (no offence), so the only delta
    // vs a bare player hitting the same boss is the +20% boss bonus.
    const wWith = new World();
    const pWith = playerWithRelic(wWith, 'rimewyrm-heart');
    const bossWith = spawnBoss(wWith, FIELD, 'maelgrith', 0, 5);
    wWith.get<Offense>(pWith, C.Offense)!.critChance = 0;
    const wOut = new World();
    const pOut = playerWithRelic(wOut, null);
    const bossOut = spawnBoss(wOut, FIELD, 'maelgrith', 0, 5);
    wOut.get<Offense>(pOut, C.Offense)!.critChance = 0;
    const outWith = applyDamage(wWith, pWith, bossWith, HIT, new Rng(4)).amount;
    const outBare = applyDamage(wOut, pOut, bossOut, HIT, new Rng(4)).amount;
    expect(outWith / outBare).toBeCloseTo(1.2, 1);

    // Incoming: a blight hit from the boss (Heart has no blight resist), so the only
    // delta is the −15% boss damage-reduction.
    const blight = { base: 200, coeff: 2, damageType: 'blight' as const };
    const wIn = new World();
    const pIn = playerWithRelic(wIn, 'rimewyrm-heart');
    const bIn = spawnBoss(wIn, FIELD, 'maelgrith', 0, 5);
    wIn.get<Offense>(bIn, C.Offense)!.critChance = 0;
    const wInBare = new World();
    const pInBare = playerWithRelic(wInBare, null);
    const bInBare = spawnBoss(wInBare, FIELD, 'maelgrith', 0, 5);
    wInBare.get<Offense>(bInBare, C.Offense)!.critChance = 0;
    const inWith = applyDamage(wIn, bIn, pIn, blight, new Rng(4)).amount;
    const inBare = applyDamage(wInBare, bInBare, pInBare, blight, new Rng(4)).amount;
    expect(inWith / inBare).toBeCloseTo(0.85, 1);
  });

  it('bloodcrit (Bloodroot): critical hits leech health to the attacker', () => {
    const world = new World();
    const p = playerWithRelic(world, 'bloodroot-sigil');
    world.get<Offense>(p, C.Offense)!.critChance = 1; // force a crit
    const ph = world.get<Health>(p, C.Health)!;
    ph.current = 1; // room to heal
    const enemy = spawnEnemy(world, FIELD, 'bonewrought', 0, 4, { level: 30 });
    applyDamage(world, p, enemy, HIT, new Rng(2), 0); // ability leech 0 → only relic crit-leech
    expect(ph.current).toBeGreaterThan(1);
  });
});

describe('relics — reaper on-kill hook', () => {
  it('killing with the Hollow Crown heals and shaves all cooldowns', () => {
    const world = new World();
    const p = playerWithRelic(world, 'hollow-crown');
    const h = world.get<Health>(p, C.Health)!;
    const ab = world.get<AbilityState>(p, C.AbilityState)!;
    h.current = 100;
    ab.cooldowns[0] = 5;
    ab.cooldowns[1] = 1.0;

    const victim = spawnEnemy(world, FIELD, 'bloomhusk', 0, 4, { level: 1 });
    world.get<Health>(victim, C.Health)!.current = 0; // already dead — rewardKill pays it out
    rewardKill(world, p, victim, new Rng(1));

    expect(h.current).toBeGreaterThan(100); // healed 8% max HP
    expect(ab.cooldowns[0]).toBeCloseTo(3.5); // −1.5s
    expect(ab.cooldowns[1]).toBe(0); // clamped at 0
  });
});

describe('relics — boss drop logic', () => {
  it('rolls only from the killed boss’s pool, and not from non-bosses', () => {
    expect(rollRelicDrop(new Rng(1), 'emberhorn', 1)).toBe('ashbrand');
    const m = rollRelicDrop(new Rng(1), 'maelgrith', 1);
    expect(RELIC_DROPS.maelgrith).toContain(m);
    expect(rollRelicDrop(new Rng(1), 'emberhorn', 0)).toBeNull(); // chance 0
    expect(rollRelicDrop(new Rng(1), 'greenmarch-mob', 1)).toBeNull(); // not a boss
  });

  it('a boss kill can drop a relic through rewardKill', () => {
    let relics = 0;
    let total = 0;
    for (let i = 0; i < 400; i++) {
      const world = new World();
      const p = playerWithRelic(world, null);
      const boss = spawnBoss(world, FIELD, 'maelgrith', 0, 6);
      world.get<Health>(boss, C.Health)!.current = 0;
      rewardKill(world, p, boss, new Rng(1000 + i));
      for (const e of world.query(C.LootDrop)) {
        const ld = world.get<{ item: Item | null }>(e, C.LootDrop)!;
        total++;
        if (ld.item?.rarity === 'relic') {
          relics++;
          expect(RELIC_DROPS.maelgrith).toContain(ld.item.relic);
        }
      }
    }
    expect(total).toBe(400);
    expect(relics).toBeGreaterThan(0); // ~8% → ~32 expected
    expect(relics).toBeLessThan(total); // not every kill (it's the apex)
  });
});

describe('relics — save round-trip', () => {
  it('an equipped relic survives serialize → applySave and re-derives its mods', () => {
    const world = new World();
    const p = playerWithRelic(world, 'ashbrand');
    const data = serialize(world, p);

    const w2 = new World();
    const p2 = createPlayer(w2, FIELD, 0, 0, 'warrior');
    applySave(w2, p2, data);

    const eq = w2.get<Equipment>(p2, C.Equipment)!;
    expect(eq.slots.weapon?.relic).toBe('ashbrand');
    expect(eq.slots.weapon?.rarity).toBe('relic');
    const m = w2.get<RelicMods>(p2, C.RelicMods)!;
    expect(m.executeThreshold).toBeCloseTo(0.35);
    expect(m.executeMult).toBeCloseTo(0.5);
  });
});

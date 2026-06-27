// Combat-balance sim for the Level 1–30 Content Gate: for each class, at each zone's
// level with level-appropriate gear, verify the class can actually kill that zone's
// tankiest standard enemy (no HP wall) and isn't one-shot by it. Uses the *real* stat
// derivation + damage formula, so it catches genuine scaling blockers.

import { describe, it, expect } from 'vitest';
import { World, type Entity } from '../../src/core/ecs/world';
import { C, type Health, type Offense, type Enemy, type PrimaryStatId } from '../../src/core/ecs/components';
import { createPlayer } from '../../src/sim/factory';
import { spawnEnemy, type EnemyTemplateId } from '../../src/sim/content/enemies';
import { applyDamage } from '../../src/sim/combat/apply';
import { getClass, resolveKit, empowerKit } from '../../src/sim/classes';
import { generateItem, EQUIP_SLOTS } from '../../src/sim/loot/items';
import { addItem, equipItem } from '../../src/sim/inventory';
import { Rng } from '../../src/core/rng';
import { setLevel, flatField } from './helpers';

const FIELD = flatField();

const CLASSES: { id: 'warrior' | 'hunter' | 'priest'; primary: 'STR' | 'DEX' | 'SPR'; spender: string }[] = [
  { id: 'warrior', primary: 'STR', spender: 'sunder' },
  { id: 'hunter', primary: 'DEX', spender: 'piercing-arrow' },
  { id: 'priest', primary: 'SPR', spender: 'searing-light' },
];

// The tankiest standard enemy of each region, at a representative level in the band.
const ZONES: { name: string; level: number; enemy: EnemyTemplateId }[] = [
  { name: 'Greenmarch', level: 3, enemy: 'bloomhusk' },
  { name: 'Thornwood', level: 8, enemy: 'bramblekin' },
  { name: 'Sunken Fen', level: 13, enemy: 'drudge' },
  { name: 'Emberreach', level: 18, enemy: 'magmaw' },
  { name: 'Riven Peaks', level: 23, enemy: 'rimebound' },
  { name: 'Gravereach', level: 28, enemy: 'bonewrought' },
];

/** Equip a full set of level-appropriate Uncommon gear (a realistically-geared player). */
function gearUp(world: World, player: Entity, ilvl: number, primary: PrimaryStatId): void {
  const p = primary === 'VIT' ? 'STR' : primary;
  for (let i = 0; i < EQUIP_SLOTS.length; i++) {
    const slot = EQUIP_SLOTS[i];
    const it = generateItem(new Rng(ilvl * 131 + i * 7 + 1), {
      ilvl,
      slot,
      rarity: 'uncommon',
      primaryStat: p,
    });
    addItem(world, player, it);
    equipItem(world, player, it);
  }
}

describe('combat balance across the 1→30 journey', () => {
  for (const cls of CLASSES) {
    for (const zone of ZONES) {
      it(`${cls.id} can clear ${zone.name} (${zone.enemy} Lv ${zone.level}) and isn't one-shot`, () => {
        const world = new World();
        const player = createPlayer(world, FIELD, 0, 0, cls.id);
        setLevel(world, player, zone.level);
        gearUp(world, player, zone.level, cls.primary);
        world.get<Offense>(player, C.Offense)!.critChance = 0; // deterministic

        const def = getClass(cls.id);
        const kit = empowerKit(def, resolveKit(def), zone.level);
        const spender = kit.find((a) => a.id === cls.spender)!;

        const enemy = spawnEnemy(world, FIELD, zone.enemy, 0, 4, { level: zone.level });
        const enemyHp = world.get<Health>(enemy, C.Health)!.max;

        // The class can damage and kill the zone's tankiest standard (no HP wall).
        const dmg = applyDamage(
          world, player, enemy,
          { base: spender.base, coeff: spender.coeff, damageType: spender.damageType },
          new Rng(99),
        ).amount;
        expect(dmg, 'deals damage').toBeGreaterThan(0);
        expect(enemyHp / dmg, 'casts-to-kill (no wall)').toBeLessThan(60);

        // A single standard hit is not (close to) a one-shot on a level-geared player.
        const en = world.get<Enemy>(enemy, C.Enemy)!;
        const playerHp = world.get<Health>(player, C.Health)!.max;
        const incoming = applyDamage(
          world, enemy, player,
          { base: en.attackBase, coeff: en.attackCoeff, damageType: en.attackType },
          new Rng(7),
        ).amount;
        expect(incoming, 'not a one-shot').toBeLessThan(playerHp * 0.8);
      });
    }
  }
});

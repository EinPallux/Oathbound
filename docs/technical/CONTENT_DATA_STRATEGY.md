# Content Data Strategy

Oathbound is **data-driven**: items, abilities, enemies, zones, loot tables, and class definitions live as **data**, not hard-coded logic. This keeps content terse, balance hot-tunable, and systems generic — and matches the brief's "data-driven enemy/content configuration" requirement.

## Format decision: typed TS data modules (+ zod at boundaries)
- **Authoring format:** **TypeScript data modules** (objects typed against shared interfaces). Why over raw JSON: editor autocomplete, compile-time validation, references between content (an enemy's `lootTable` must be a real id), and zero parse step in-bundle.
- **Boundary validation:** **zod** schemas validate anything **untrusted/external** — imported save files now, and future server payloads later. In-repo content is trusted (typed at compile time) but can be dev-validated by a CI script.
- **Why not a CMS / database:** overkill for a solo beta; adds infra. Revisit only if non-engineers author content at scale (post-beta).

## Content domains & shared base curves
Content stores **overrides/multipliers** on top of shared base curves so values stay balanced and terse:
- `levelStatCurve(level)` → base HP/damage/armor for enemies and players.
- `xpCurve`, `xpPerKill`, con multipliers, tier multipliers → owned by [PROGRESSION_AND_XP](../design/PROGRESSION_AND_XP.md).
- `itemBudget(ilvl, slot)`, rarity multipliers, affix tier tables → owned by [ITEMS_AND_EQUIPMENT](../design/ITEMS_AND_EQUIPMENT.md).

### Registries (loaded at boot)
```
/content
  classes/      warrior.ts hunter.ts priest.ts        (abilities, resource, base stats, gear rules)
  abilities/    <classId>/<abilityId>.ts               (type, cost, cd, coeff, effects, fx refs)
  enemies/      <family>/<enemyId>.ts                  (archetype, tier, stat mults, abilities, drops, spawn)
  items/        bases.ts affixes.ts relics.ts          (slot bases, affix pools, unique effects)
  loot-tables/  <tableId>.ts                           (rarity weights, type pools, BLP config)
  zones/        <zoneId>.ts                            (terrain/prop kit, camps, rares, hazards, oathstones, loot identity)
  fx/           vfx.ts sfx.ts                          (named effect handles → asset refs)
```
Each domain has a typed `Registry<T>` with `getById`, `all`, and dev-time integrity checks (every referenced id exists; no orphan tables).

## Example shapes (illustrative)
```ts
// ability
interface AbilityDef {
  id: string; classId: ClassId; name: string;
  type: 'instant'|'cast'|'channel'|'passive'|'offgcd';
  unlockLevel: number; cost: { resource: ResourceType; amount: number };
  cooldownSec: number; castSec?: number;
  effects: AbilityEffect[];        // damage/heal/shield/cc/buff, each with coeff & target rule
  fx?: { cast?: FxId; impact?: FxId; sfx?: SfxId };
}
// loot table
interface LootTable {
  id: string;
  dropChance: number;                       // con-adjusted at roll time
  rarityWeights: Record<Rarity, number>;    // tier-shifted by enemy tier
  typePools: { type: ItemType; weight: number }[];
  blp?: { trackKey: string; pityAfter: number; bonusRarity: Rarity };
}
```
(Authoritative interfaces are defined in code during implementation; these are the agreed shapes.)

## Determinism & RNG
- All content rolls (drops, affixes, rare spawns) go through a **seedable RNG service** ([ARCHITECTURE_PLAN](./ARCHITECTURE_PLAN.md#cross-cutting-services-interfaces-swap-able)).
- This makes **loot-table simulations** and **item-generation tests** reproducible ([TEST_STRATEGY](../qa/TEST_STRATEGY.md)) and is the right shape for future server-side authoritative rolls.

## Hot-tuning & balance workflow
- Balance constants (curves, weights, coefficients) are grouped in clearly-labeled config so a designer can tune without touching systems.
- A **loot/economy simulation harness** (planned devtool) runs thousands of kills against a table to report rarity distribution, drop cadence, and economy flow vs the [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md#drop-rate--farming-expectations-solo) targets — before human playtests.

## Content integrity (CI-friendly)
A dev script validates, before merge:
- every `lootTable`/`abilityId`/`enemyId`/`zoneId` reference resolves;
- no ability references a missing fx/sfx handle;
- item budgets stay within tolerance of `itemBudget()`;
- every zone has the required content density ([WORLD_AND_ZONES](../design/WORLD_AND_ZONES.md#world-content-sizing-anti-empty-checklist)).

## Versioning vs saves
Content is referenced by **stable ids** so saves survive content edits; the [SAVE_SYSTEM_PLAN](./SAVE_SYSTEM_PLAN.md#save-schema-versioning--migration) defines graceful handling of changed/removed definitions.

## Future-multiplayer note
Keeping content as data + seedable RNG means a future authoritative server can **share the same content registries and roll logic**, validating client outcomes instead of trusting them ([FUTURE_MULTIPLAYER_BOUNDARIES](./FUTURE_MULTIPLAYER_BOUNDARIES.md)). No networking is built now.

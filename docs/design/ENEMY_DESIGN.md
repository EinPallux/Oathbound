# Enemy & Grinding Design

Canonical owner of: enemy categories, tiers, behavior parameters, spawn/respawn/aggro/leash rules, rare-spawn logic, data-driven config, and per-zone family assignments (high level — exact placement in [WORLD_AND_ZONES](./WORLD_AND_ZONES.md)). Goal: support **long, satisfying solo grinding** without dozens of bespoke systems. All values `v1 tuning targets`.

## Principles
- **Normal same-level enemies are reliably soloable by every class** (Pillar 1). Difficulty rises via **mechanics, not perfect-play requirements** for normals.
- **Variety from composition, not bespoke code:** a small set of **behavior archetypes** + **data-driven stats/abilities/drops** yields many distinct-feeling enemies.
- **Introduce complexity gradually** — not all families exist in Phase 1. Mapping to the [VERSION_ROADMAP](../production/VERSION_ROADMAP.md).

## Behavior archetypes (the reusable AI building blocks)
Each enemy is an archetype + data. Archetypes are simple state machines (Idle → Alert → Engage → [Attack/Reposition/Telegraph] → Leash/Reset → Dead).

| Archetype | Behavior | Counterplay |
|---|---|---|
| **Melee Bruiser** | closes & swings | kite / interrupt big hits |
| **Ranged Skirmisher** | shoots, repositions to keep distance | close gap / break LoS |
| **Defensive** | high armor/block, slow | armor-break / sustained DPS |
| **Fast/Swarm** | low HP, quick, comes in numbers | AoE / cleave |
| **Caster** | telegraphed nukes, low mobility | interrupt / LoS / rush down |
| **Support** | buffs/heals allies | kill-priority target |
| **Pack-leader** | empowers nearby pack | focus to collapse the pack |

## Enemy tiers
| Tier | Role | HP/DMG vs standard | XP | Drops | Notes |
|---|---|---|---|---|---|
| **Standard** | grind fodder | 1× | 1× | common/uncommon | the bulk; soloable on sight |
| **Elite** | camp anchors / minibosses | 4–8× HP, +mechanics | 4–6× | rare+ chance | needs cooldowns/positioning |
| **Rare-named** | uncommon special spawns | 6–12× HP, unique mechanic | 8–15× | epic+ tail, BLP | exciting discovery |
| **World boss** | endgame pinnacle (solo-tunable) | very high, multi-phase | 30–60× | Legendary/Relic tail | repeatable; see [ENDGAME_FOUNDATION](./ENDGAME_FOUNDATION.md) |

**Elite extras may require:** better gear, correct ability use, consumables, careful pulling, positioning, higher skill — but **never** for *normal* grind.

> **World bosses — implemented (0.6.0 CP2).** The three solo bosses (Emberhorn · the Rimewyrm · Maelgrith) are hand-authored uniques, not data-scaled mobs: a `boss` enemy tier + a `Boss` component (`src/sim/content/bosses.ts`) layered on the standard `Enemy` (enemy-ai still drives locomotion + basic swings). The **boss-ai** system (`src/sim/systems/boss-ai.ts`) reads HP to advance **phases** (3–4 per boss) and, on a per-phase cadence, telegraphs a **heavy ground attack** — a `GroundAoe` with `hitsPlayer` that drops at your feet, fills over ~1.3–1.5 s, and only lands if you don't step out. HP (~27–53× a same-level standard) is tuned via the real damage formula to a **multi-minute solo fight** for every class; bosses are lone (no rally), leash to a wide arena, and **respawn on a 5-min cooldown** for farming. Loot uses a Legendary-leaning `boss` drop tier (always rare+, ~15 % legendary). Relic drops arrive with CP3.

## Spawn, density & respawn
| Parameter | v1 target | Purpose |
|---|---|---|
| Spawn density | camps of 3–8 standards + occasional elite | readable grind pockets |
| Respawn timer | 20–45s (standard), 3–8 min (elite), 10–25 min (rare) | steady flow without overcrowding |
| Aggro radius | 8–14m (archetype-dependent) | predictable pulls |
| Social aggro | nearby pack members within ~6m join | rewards careful pulling |
| Patrols | a few roamers per camp | break monotony, add risk |
| Leash distance | ~30–40m from spawn → reset + heal | anti drag-kite ([COMBAT_DESIGN](./COMBAT_DESIGN.md#9-aggro-leashing-reset-pve)) |
| Max reasonable pull | 3 standards comfortably; 4–5 dangerous | [SOLO_BALANCE_RULES](./SOLO_BALANCE_RULES.md) |

## Rare-spawn logic
- Each zone defines a small set of **rare-named** enemies with **low spawn chance** at specific nodes and long cooldowns.
- **Discovery communication:** a subtle world cue (special nameplate color/icon, ambient audio sting, optional map ping once seen) — not a screen-wide marker.
- Rares carry a **better loot table + bad-luck protection** and grant big XP — a cheap, high-excitement reuse of existing systems.

## Difficulty communication
- **Nameplate con color** (gray→red, see [PROGRESSION_AND_XP](./PROGRESSION_AND_XP.md#level-difference-con-system)).
- **Tier markers** (elite/rare icons), **telegraphs** for dangerous abilities, and **family silhouette/color language** so players read threat at a glance ([ART_DIRECTION_PLAN](../assets/ART_DIRECTION_PLAN.md)).

## Data-driven enemy configuration (schema sketch)
Implementation defines enemies as data, not code (see [CONTENT_DATA_STRATEGY](../technical/CONTENT_DATA_STRATEGY.md)):
```jsonc
{
  "id": "bloomhusk_thrasher",
  "name": "Bloomhusk Thrasher",
  "family": "Bloomhusks",
  "archetype": "melee_bruiser",
  "tier": "standard",
  "level": 3,
  "stats": { "hpMult": 1.0, "dmgMult": 1.0, "armor": 20, "moveSpeed": 3.2 },
  "resist": { "blight": 0.1 },
  "weakness": { "fire": 0.15 },
  "abilities": ["heavy_swing", "enrage_below_30pct"],
  "aggroRadius": 10, "leashRange": 35, "socialAggroRange": 6,
  "xpMult": 1.0,
  "lootTable": "greenmarch_standard",
  "spawn": { "camp": "greenmarch_west_field", "respawnSec": 30, "weight": 3 }
}
```
Base stats per level come from a shared **level→stat curve** so a config only stores *multipliers/overrides*, keeping content terse and balanced.

## Family roster (high-level; per-zone detail in WORLD_AND_ZONES)
Original families, themed per region:
| Zone (Lv) | Families | Flavor |
|---|---|---|
| Greenmarch (1–5) | **Bloomhusks** (corrupted woodland beasts), **Reavers** (bandits), **Wisps** (minor spirits) | gentle intro: bruiser, ranged, fast |
| Thornwood Vale (6–10) | **Weavers** (spiders), **Bramblekin** (thorn-constructs), **Sporelings** (fungal) | poison/roots, swarms |
| Sunken Fen (11–15) | **Drudge** (bog-drowned), **Fenstalkers** (amphibious lurkers), **Mirelings** (gas imps) | blight/poison, ambush |
| Emberreach (16–20) | **Cinderborn** (fire elementals), **Ashen Reavers** (fire cult), **Magmaw** (beasts) | fire damage, telegraphed AoE |
| Riven Peaks (21–25) | **Rimebound** (ice constructs), **Frostfang** (frost beasts), **Revenants** (frozen dead) | frost slows, defensive elites |
| Gravereach (26–30) | **Wraiths**, **Bonewrought** (bone constructs), **The Forsworn** (oath-broken knights) | blight casters, elite knights, bosses |

Holy damage (Priest) is **strong vs undead** (Revenants/Wraiths/Forsworn) — a designed weakness lever (`weaknessMods` in the [damage formula](./COMBAT_DESIGN.md#5-damage-calculation-canonical-formula)).

## Performance constraints (enemies)
- **≤ 40 fully-simulated AI** near the player; distant enemies use **throttled/low-rate AI** or are disabled until in range.
- **InstancedMesh** for crowds of identical models; **object pooling** for enemies, projectiles, and corpses.
- **Navigation kept cheap:** steering + ground raycasts + simple avoidance; optional per-zone grid for chokepoints; **no heavy navmesh** for the beta. Pathfinding cost is a tracked [risk](../production/RISK_REGISTER.md).
- Budgets enforced in [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md).

## Drop ownership (future-proofing)
Drops are modeled with an **owner/eligibility field** even in single-player (always the local player now). This makes the future multiplayer transition to per-player/instanced loot a data change, not a rewrite. See [FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md).

## Anti-farming-abuse
- Con/gray rule + soft diminishing returns on hammering a single spawn point ([PROGRESSION_AND_XP](./PROGRESSION_AND_XP.md#level-difference-con-system)).
- Leashing prevents conga-pull exploits; respawn pacing caps theoretical XP/hour.

## Gradual introduction (roadmap hook)
- **First** family: one Greenmarch family + Standard tier only (prove the loop).
- **Then** add archetypes (ranged, fast), elites, rares, additional families per zone bracket, and finally world bosses. Sequencing in [VERSION_ROADMAP](../production/VERSION_ROADMAP.md). Do **not** build all families in Phase 1.

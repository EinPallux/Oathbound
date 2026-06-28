# Items & Equipment

Canonical owner of: equipment slots, rarities, stats/affixes, item-power model, drop tables, gold economy, inventory rules, and the optional upgrade system. Equipment is a **top-tier retention pillar** (Pillar 5). All numbers are `v1 tuning targets`.

## Design goals & anti-goals
**Goals:** frequent *meaningful* decisions ("is this stronger? does it fit my build? sell/salvage/keep?"); legible tooltips; a clear chase. **Anti-goals (explicitly avoided):** constant meaningless one-stat upgrades · inventory clutter · too many currencies · unreadable stat soup · mandatory crafting · gear becoming irrelevant every few minutes · best-in-slot locked behind quests · group content blocking leveling.

## Equipment slots (12)
| Slot | Notes |
|---|---|
| Main-hand Weapon | Class-defining; biggest single power source. |
| Off-hand | Class axis: Warrior Shield/2H-grip, Hunter Quiver, Priest Tome/Reliquary. |
| Head, Shoulders, Chest, Hands, Belt, Legs, Feet | Armor (8 armor slots incl. off-hand-as-defense for Warrior). |
| Amulet (Neck) | Jewelry — stat-dense, no armor. |
| Ring 1, Ring 2 | Jewelry — affix-focused. |

Weapon/armor **type restrictions** by class: Warrior = heavy armor + melee weapons; Hunter = medium armor + bows; Priest = light armor + holy implements. Wearing off-class gear is disallowed (greyed in tooltip), keeping loot decisions class-relevant (smart-loot, see below).

## Rarity tiers
| Tier | Color | Affixes | Budget mult | Role |
|---|---|---:|---:|---|
| Common | White/Gray | 0 | ×1.00 | base stat only; early filler & salvage fodder |
| Uncommon | Green | 1 | ×1.10 | first real choices |
| Rare | Blue | 2 | ×1.20 | the bread-and-butter chase |
| Epic | Purple | 3 (1 may be high-tier) | ×1.32 | strong build pieces |
| Legendary | Orange | 4 + a **minor unique mod** | ×1.45 | aspirational drops |
| **Relic** (Unique) | Teal | fixed, hand-designed effect | ×1.55 | named build-enablers; very rare |

> Color is **never the only signal** — rarity also shows as a tier label + border shape for colorblind safety ([UX_AND_ACCESSIBILITY](./UX_AND_ACCESSIBILITY.md)).

> **Relics — implemented (0.6.0 CP3).** The four beta relics are bespoke uniques (not rolled), defined in `src/sim/loot/relics.ts` with strong fixed stats + one build-enabling effect each (Ashbrand *execute* · Heart of the Rimewyrm *boss-slayer* · Crown of the Hollow King *reaper* · Sael's Bloodroot Sigil *crit-leech*). They drop as an ~8 % tail from world bosses (one pool per boss), auto-locked, counting as rare+ for bad-luck protection. Effects run through a shared hook layer: equipped relics fold into a `RelicMods` bundle (recomputed in `recomputeDerived`) read by `src/sim/combat/apply.ts` (damage) and `src/sim/rewards.ts` (on-kill) — so adding a relic is data + at most one field/hook. Beta relics are class-agnostic combat modifiers; per-ability relic effects are a later extension of the same registry.

## Stats
**Primary (scales class power):** STR (Warrior), DEX (Hunter), SPR (Priest), **VIT** (HP, universal). **Secondary affixes:**
| Affix | Effect | Notes |
|---|---|---|
| Crit Chance | +% crit | offense |
| Crit Damage | +% crit multiplier | offense |
| Haste | faster GCD/cast + some resource gen | offense/QoL |
| Cooldown Reduction | −% cooldowns (cap 40%) | enables ability builds |
| Armor | physical mitigation | defense |
| Resistance (Fire/Frost/Blight) | typed mitigation | zone-reactive defense |
| Leech | % damage → HP | solo sustain (esp. Warrior) |
| Move Speed | +% (cap ~30%) | kiting/traversal |
| +Max Resource | larger Fury/Focus/Mana pool | build depth |
| +Healing Power | stronger heals/Atonement | Priest sustain |
| +Thorns *(maybe)* | reflect | evaluated; cut if it bloats tooltips |

Affixes roll in **tiers** (e.g., Crit I…V); item level gates the max tier available. Smart affix weighting biases rolls toward the item's class (a Priest tome is unlikely to roll pure STR).

## Item power model (stat budget)
Each item has a **budget** from its item level; rarity multiplies it and adds affix slots.

`baseBudget(ilvl) = round(10 + 6.0 * ilvl)` (chest-equivalent; other slots scale by a slot weight).

| ilvl | base budget (chest-equiv) |
|---:|---:|
| 1 | 16 |
| 5 | 40 |
| 10 | 70 |
| 15 | 100 |
| 20 | 130 |
| 25 | 160 |
| 30 | 190 |
| 33 | 208 |
| 36 | 226 |

- **Slot weights** distribute budget (e.g., weapon ~1.4×, chest 1.0×, ring 0.5×) so a weapon is the biggest upgrade and rings are affix-led.
- **ilvl vs character level:** dropped ilvl tracks the *source enemy's* level (±a few). Endgame (Lv 30) enemies drop ilvl 30–36, which is the chase range past max level. This is how gear keeps improving **after** the level cap.
- A drop's total power = `slotBudget(ilvl, slot) * rarityMult + affixValues`. Item-generation tests assert budgets stay within ±X% of target (see [TEST_STRATEGY](../qa/TEST_STRATEGY.md)).

## Drop tables (data-driven)
Loot is rolled from layered tables (see [CONTENT_DATA_STRATEGY](../technical/CONTENT_DATA_STRATEGY.md)):
1. **Did it drop?** per-enemy `dropChance` (con-adjusted).
2. **Rarity roll** weighted by enemy tier (standard → mostly common/uncommon; elite → rare+; rare-named/boss → epic+ with a Legendary/Relic tail).
3. **Item type** from the enemy/zone table (smart-loot toggle biases toward the player's class).
4. **ilvl** from source level; **affixes** rolled by rarity & ilvl tiers.

**Drop sources:** enemy-specific drops, zone-wide tables, rare-monster tables, world-boss tables. Each zone has a **loot identity** (e.g., Emberreach favors fire-resist & crit gear) so farming location is a *decision*. See [WORLD_AND_ZONES](./WORLD_AND_ZONES.md).

### Bad-luck protection & smart loot
- **Bad-luck protection** on rare+ from world bosses/named rares: a pity counter raises the rare+ chance after consecutive unlucky kills, reset on success. Keeps target farming from feeling hopeless.
- **Smart loot (optional toggle, default on):** bias item *type/affixes* toward the current class. Honest (no hidden inflation of total drops) and disableable for purists.

## Gold economy
**Sources:** kill gold, vendor-trash sales, salvage byproduct. **Sinks:** vendor consumables, gear upgrading (Whetstone), buying the occasional vendor floor-item, fast-travel toll (small, optional). **No durability/repair** in beta (friction reduction). The economy is closed and local; balance targets in [SOLO_BALANCE_RULES](./SOLO_BALANCE_RULES.md).

## Optional upgrade system — "Reinforcement" (justified)
A **simple** gold-and-material sink that mitigates bad luck without a crafting tree:
- Spend gold + **Whetstones/Sigils** (common salvage material) to add **+1…+5 ilvl steps** to an equipped item (diminishing, increasing cost).
- Caps below the next rarity's natural power so it **supplements**, not replaces, the drop chase.
- **Justification:** acts as a gold sink, a salvage-material sink, and bad-luck insurance ("I can nudge my almost-perfect Rare up"). It is **not** mandatory crafting. If playtests show it adds clutter, it can be cut without breaking the loop (Decision recorded in [DECISION_RECORDS](../decisions/DECISION_RECORDS.md#adr-010-equipment-generation--upgrade-complexity)).

## Salvage
Salvaging (unlocked Lv 3) converts unwanted gear into Whetstones/Sigils + a little gold. **Salvage-all-below-rarity** button prevents inventory chores. Reduces clutter and feeds Reinforcement.

## Consumables (small, legible set)
| Item | Effect | Rule |
|---|---|---|
| Health Potion | instant heal | shared cooldown (~12s) |
| Resource Draught | restore Fury/Focus/Mana | shared cooldown |
| Field Rations (food) | out-of-combat regen buff | cancels on combat |
| Warding Tonic | temp resist to a damage type | zone-reactive |
Consumables are a **~5% power layer** (see [PROGRESSION_AND_XP](./PROGRESSION_AND_XP.md#power-growth-model-where-player-power-comes-from)); never required to win a normal fight.

## Inventory & UX rules
- Grid inventory with generous size; **currencies (gold, whetstones) are not items** (separate wallet) — avoids clutter & "too many currencies."
- **Item comparison tooltip** (hover shows delta vs equipped, green/red stat arrows).
- **Item locking** to prevent accidental salvage/sell; **sorting & filtering** (by slot, rarity, ilvl, upgrade-for-me); **duplicate handling** (stacking for consumables/materials; gear doesn't stack).
- **Rarity feedback:** loot beams + on-screen toast for rare+; sound cue scaling with rarity.
- Tooltips show: name, rarity, ilvl, slot, primary stat, affixes (with tier), unique effect text, vendor value, and "upgrade for your build?" hint.

## How much power from each source (cross-link)
See the canonical [power-growth model](./PROGRESSION_AND_XP.md#power-growth-model-where-player-power-comes-from): level ~35%, gear base ~30%, abilities/build ~20%, affixes ~10%, consumables ~5%.

## Deferred (post-beta)
Sockets/gems, runewords, full crafting professions, transmog/cosmetics, account-bound stash tabs, trading. See [DEFERRED_FEATURES](../production/DEFERRED_FEATURES.md).

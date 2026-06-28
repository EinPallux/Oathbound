# Endgame Foundation (Local Beta)

The **temporary, solo, open-world endgame** that begins at level 30 and gives the beta its long tail. This is **not** raids or dungeons (those are the [post-beta horizon](../production/POST_BETA_MMO_HORIZON.md)); it is a satisfying gear chase reusing systems we already have. Owner of: the Lv-30 loop, world bosses, and the chase structure. All values `v1 tuning targets`.

## The level-30 loop
At 30, XP stops mattering and **gear becomes the whole game**:
> Pick a target (a slot to upgrade, an affix you want, a Relic you covet) → choose where to farm (a zone's loot identity, a named rare, an elite camp, a world boss) → grind/attempt → evaluate drops → upgrade (equip or Reinforce) → push a harder target. Repeat.

This satisfies "reach 30 and continue hunting for valuable gear" (the [vision north-star](./GAME_VISION.md#north-star-metric)).

## Chase ingredients (all reuse existing systems)
| Ingredient | What it is | Why it works |
|---|---|---|
| **Rare open-world enemies** | named rares per zone, low spawn, BLP loot | cheap excitement, exploration |
| **Elite camps** | fixed tough packs with rare+ tables | repeatable, skill-testing |
| **Named monsters** | signature rares with unique mechanics/drops | "I want *that* one's drop" |
| **Difficult solo encounters** | Gravereach inner court, hazard gauntlets | mastery test |
| **Target farming** | known source → known item, + bad-luck protection | agency over RNG |
| **High-rarity random drops** | Epic/Legendary/Relic tail concentrated at 30 | jackpot moments |
| **Optional gear upgrading** | Reinforcement (Whetstones/gold) | mitigates RNG, gold sink |

Loot mechanics live in [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md); spawn/tier rules in [ENEMY_DESIGN](./ENEMY_DESIGN.md).

## World bosses (3 for the beta, solo-tunable)
Open-world, repeatable, **balanced to be beatable solo** in ~2–5 min by a well-geared level-30 of any class (multi-phase, telegraph-heavy, the pinnacle of the [combat model](./COMBAT_DESIGN.md)). Not instanced; no group required.

| Boss | Home | Mechanic identity | Loot |
|---|---|---|---|
| **Emberhorn, the Cinder Tyrant** | Emberreach | fire AoE phases, enrage; tests interrupts & resist | fire-themed Epics, Legendary tail |
| **The Rimewyrm** | Riven Peaks | frost slows, add-waves, breath telegraph; tests mobility & priority | frost-themed Epics, Legendary tail |
| **Maelgrith the Forsworn** | Gravereach | the capstone — multi-phase blight knight; tests the whole kit | best beta loot: Legendary + **Relic** tail |

- **Solo-tunable:** boss HP/damage scale to a single player; designed around **one** player's cooldowns and recovery, not a raid's. A future multiplayer build would re-tune/instance these (recorded in [FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md)).
- **Respawn:** a cooldown (e.g., 10–25 min) so they feel special but remain farmable.

## Relics (the aspirational top)
A small set of hand-designed **Relic (unique)** items with build-enabling effects (e.g., "Holy Nova chains to a second target," "Charge resets on kill," "Aimed Shot fires twice below 30% target HP"). They are the **rarest** drops (world bosses, deep Gravereach rares) and give the chase a named, memorable apex. Defined as bespoke data, not random rolls.

## Chase structure & pacing
- **Soft power ceiling:** the best realistic loadout (full Legendary + a Relic + Reinforcement) sits a meaningful but **bounded** margin above ilvl-30 baseline — enough that progress is felt, not so much that it trivializes the world or makes future re-tuning impossible.
- **Multiple viable end builds** per class (via choice nodes + affixes) so the chase has direction, not one true answer.
- **No treadmill inflation:** we do **not** add new higher gear tiers every patch in the beta; the chase is *completing and optimizing* the existing tier (Legendaries with great affixes, the Relic you want, Reinforced to cap).

## What endgame is NOT (beta)
- Not instanced dungeons or raids (deferred — [DEFERRED_FEATURES](../production/DEFERRED_FEATURES.md)).
- Not gated behind groups, accounts, or networking.
- Not faked with bots or simulated populations.
- Not an infinite paragon/level grind — the cap is 30 and the chase is gear.

## Gate
Validated by the [Endgame Foundation Gate](../production/RELEASE_GATES.md#7-endgame-foundation-gate): a level-30 character of each class can locate, attempt, and beat each world boss solo; bad-luck protection works; target farming yields a wanted upgrade within a focused session; the chase remains engaging across repeated sessions (playtest [retention check](../qa/PLAYTEST_PLAN.md)).

> **Implemented (0.6.0).** World bosses (CP2), Relics (CP3) and the Lv-30 loop + target-farming guidance (CP4) are built. The endgame "what now?" is data in `src/sim/content/endgame.ts` (the target board + `relicProgress`/`nextRelicTarget` helpers), surfaced by the Goal Tracker's **Endgame** view (Relic collection N/4 + the next relic to hunt) and the full map's **world-boss markers** ("locate"). A persistent `RelicCollection` (saved) drives collection progress. The Gate's **automatable scope is covered by tests** (`tests/unit/endgame-gate.test.ts`): every class solos every boss with an endgame loadout, the Legendary power margin over baseline is bounded (soft ceiling), and BLP/target-farming yields upgrades within a focused session. The **subjective retention/feel** check remains the owner's playtest.

## Why this is the right beta endgame
It delivers genuine long-tail retention **using only systems the solo loop already needs** (enemies, loot, zones), avoids the trap of half-built group content, and leaves a clean seam for the eventual MMO endgame (dungeons/raids) to slot in *after* the foundation is proven fun.

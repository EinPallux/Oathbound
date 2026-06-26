# Assumptions, Source-of-Truth Registry & Final Quality Review

This doc records (1) the **assumptions** the plan makes where the brief left a choice open, (2) the **canonical owner** of each major decision (so contradictions resolve cleanly), and (3) the **final quality review** checklist from the brief.

Per the brief's working method: where information was missing, we **made a sensible recommendation, stated the assumption, explained the reasoning, and recorded it as revisitable** — rather than stopping to ask.

## 1. Recorded assumptions (revisitable)
| # | Assumption | Reasoning | Revisit if… |
|---|---|---|---|
| A1 | **Pacing center ≈14h** to Lv 30 (within the brief's 12–18h) | balances "earned" vs "chill"; maps to a smooth curve & ~1,950 same-level kills | telemetry shows brackets out of target ([PROGRESSION_AND_XP](../design/PROGRESSION_AND_XP.md)) |
| A2 | **Soft tab-target hybrid** combat | best fit for browser perf, solo grind, 3 classes, future MP, indie scope ([ADR-003](../decisions/DECISION_RECORDS.md#adr-003-combat-targeting-model)) | playtests prefer fuller action combat |
| A3 | **Raw Three.js** (not R3F) | game loop ownership + perf headroom ([ADR-001](../decisions/DECISION_RECORDS.md#adr-001-raw-threejs-vs-react-three-fiber)) | UI complexity outweighs loop control |
| A4 | **DOM UI overlay** | text/tooltips/accessibility/iteration speed ([ADR-002](../decisions/DECISION_RECORDS.md#adr-002-ui-technology)) | overlay sync/perf becomes a problem |
| A5 | **IndexedDB** saves | structured, versioned, async, larger than localStorage ([ADR-005](../decisions/DECISION_RECORDS.md#adr-005-save-storage)) | data stays trivially small |
| A6 | **ECS-lite**, no heavy framework | data-oriented benefits without ceremony ([ADR-006](../decisions/DECISION_RECORDS.md#adr-006-ecs-vs-simpler-architecture)) | entity counts/systems explode |
| A7 | **No physics engine** for beta; custom kinematic controller | we need character-vs-terrain + raycasts, not rigid-body dynamics ([ADR-008](../decisions/DECISION_RECORDS.md#adr-008-collision--navigation)) | real physics interactions are designed in |
| A8 | **No permanent Hunter pet** in beta | avoids AI/nav/anim/balance scope; risk of pet-management identity ([CLASS_DESIGN](../design/CLASS_DESIGN.md#hunter-and-the-pet-question)) | a later Beastmaster spec is greenlit |
| A9 | **12 equipment slots, 5 rarities + Relic** | enough depth without clutter ([ITEMS_AND_EQUIPMENT](../design/ITEMS_AND_EQUIPMENT.md)) | playtests want more/fewer |
| A10 | **No item durability/repair** in beta | reduces friction; gold sinks come from upgrading/consumables | death needs more stakes |
| A11 | **6 leveling regions + hub**, ~5 km-scale compact world | content-dense over large/empty (Pillar 4) | pacing needs more/less space |
| A12 | **Optional Reinforcement upgrade** system kept | gold/material sink + bad-luck insurance, not mandatory crafting ([ADR-010](../decisions/DECISION_RECORDS.md#adr-010-equipment-generation--upgrade-complexity)) | it adds clutter in playtests → cut |
| A13 | **3 solo-tunable world bosses** as beta endgame apex | reuses existing systems; no group content ([ENDGAME_FOUNDATION](../design/ENDGAME_FOUNDATION.md)) | endgame needs more variety |
| A14 | **Howler.js** for audio | handles browser quirks cheaply behind a service ([TECH_STACK_EVALUATION](../technical/TECH_STACK_EVALUATION.md)) | bundle/feature needs change |
| A15 | **Stat names** STR/DEX/SPR/VIT and **resource** names Fury/Focus/Mana | common, legible archetypes (original, not Hordes.io) | naming pass during polish |
| A16 | **All numeric values are `v1 tuning targets`** | the brief forbids arbitrary finals; we show the model, tune via telemetry | any value fails its KPI |

These are **defaults to proceed on**, not locked law. Each links to where it's owned and how it's validated.

## 2. Source-of-truth registry (one owner per decision)
If two docs ever disagree, the **owner** wins; fix the other.
| Decision / number | Canonical owner |
|---|---|
| Vision, pillars, north-star | [GAME_VISION](../design/GAME_VISION.md) |
| Cross-system "at a glance" map | [GAME_DESIGN_DOCUMENT](../design/GAME_DESIGN_DOCUMENT.md) |
| Loop, reward cadence, guidance | [CORE_GAMEPLAY_LOOP](../design/CORE_GAMEPLAY_LOOP.md) |
| Combat model, damage formula, GCD, aggro/leash, death | [COMBAT_DESIGN](../design/COMBAT_DESIGN.md) |
| Class kits, ability tables, rotations | [CLASS_DESIGN](../design/CLASS_DESIGN.md) |
| XP curve, con system, pacing, power-split, unlock levels | [PROGRESSION_AND_XP](../design/PROGRESSION_AND_XP.md) |
| Slots, rarities, affixes, budgets, drops, economy, upgrade | [ITEMS_AND_EQUIPMENT](../design/ITEMS_AND_EQUIPMENT.md) |
| Enemy archetypes/tiers/spawn/config | [ENEMY_DESIGN](../design/ENEMY_DESIGN.md) |
| World structure, zone atlas, streaming, travel | [WORLD_AND_ZONES](../design/WORLD_AND_ZONES.md) |
| Solo balance targets (TTK, recovery, drops) | [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md) |
| Level-30 chase, world bosses, Relics | [ENDGAME_FOUNDATION](../design/ENDGAME_FOUNDATION.md) |
| HUD, menus, accessibility, pause | [UX_AND_ACCESSIBILITY](../design/UX_AND_ACCESSIBILITY.md) |
| Stack choices & rationale | [TECH_STACK_EVALUATION](../technical/TECH_STACK_EVALUATION.md) |
| Module boundaries, ECS-lite, loop, run-order | [ARCHITECTURE_PLAN](../technical/ARCHITECTURE_PLAN.md) |
| Rendering techniques | [RENDERING_AND_PERFORMANCE](../technical/RENDERING_AND_PERFORMANCE.md) |
| Performance numbers | [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md) |
| Save schema, migration, recovery | [SAVE_SYSTEM_PLAN](../technical/SAVE_SYSTEM_PLAN.md) |
| Content data format & registries | [CONTENT_DATA_STRATEGY](../technical/CONTENT_DATA_STRATEGY.md) |
| Deployment | [VERCEL_DEPLOYMENT_PLAN](../technical/VERCEL_DEPLOYMENT_PLAN.md) |
| Multiplayer seams & boundaries | [FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md) |
| Roadmap & versions | [VERSION_ROADMAP](./VERSION_ROADMAP.md) |
| Gates | [RELEASE_GATES](./RELEASE_GATES.md) |
| Risks | [RISK_REGISTER](./RISK_REGISTER.md) |
| Deferred scope | [DEFERRED_FEATURES](./DEFERRED_FEATURES.md) |
| Major decisions (ADRs) | [DECISION_RECORDS](../decisions/DECISION_RECORDS.md) |
| Beta definition-of-done | [BETA_ACCEPTANCE_CRITERIA](../qa/BETA_ACCEPTANCE_CRITERIA.md) |

## 3. Repository state at planning time
- Empty git repository on branch `claude/game-design-docs-70dim2`; **no prior commits, source, dependencies, or assets.** This `/docs` set is the first content. (See [docs/README](../README.md#repository-assessment-current-state).)

## 4. Final quality review (brief §31)
Verified against the plan:
- [x] Roadmap begins at **0.0.1-INDEV** and ends at **1.0-BETA** ([VERSION_ROADMAP](./VERSION_ROADMAP.md)).
- [x] **No game code implemented** (planning/docs only).
- [x] Early phases focus on **combat, classes, world, grinding, XP, loot, equipment** (0.0.x–0.6.x).
- [x] **Raids/dungeons not in early development** — deferred behind the do-not-proceed rule.
- [x] Game is **fully solo-viable**; all three classes level alone ([SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md)).
- [x] **Priest is not a group-only healer**; **Warrior is not a low-damage tank**; **Hunter not dependent on pet AI** ([CLASS_DESIGN](../design/CLASS_DESIGN.md)).
- [x] **Level 30 cannot be reached in one hour** (~1,950 kills; 12–18h target).
- [x] **Leveling does not rely on quests** (Pillar 3).
- [x] World is **not oversized/empty** (anti-empty checklist).
- [x] **Equipment is a major progression pillar**; beta has a **level-30 gear chase**.
- [x] **Local saves are versioned**; **Vercel-deployable**; **no DB/account** required.
- [x] **Multiplayer considered but not prematurely implemented** ([FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md)).
- [x] **No Hordes.io content/assets copied**; external licensing addressed ([THIRD_PARTY_ASSET_POLICY](../assets/THIRD_PARTY_ASSET_POLICY.md)).
- [x] **Every roadmap phase has acceptance criteria**; **every major risk has mitigation**.
- [x] **1.0-BETA definition is objective** ([BETA_ACCEPTANCE_CRITERIA](../qa/BETA_ACCEPTANCE_CRITERIA.md)).
- [x] Plan is **feasible for an AI-assisted solo developer** and **prioritizes finishing systems over adding features**.

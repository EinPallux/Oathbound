# Version Roadmap — 0.0.1-INDEV → 1.0-BETA

The canonical phased plan. It follows **deep vertical progression**, not a "skeleton of every system": make *one* class and *one* enemy family genuinely fun and complete the first grind+loot loop **before** breadth. Each version lists the brief-required fields. Numbers reference the canonical design docs; gates reference [RELEASE_GATES](./RELEASE_GATES.md); dependencies are visualized in [PHASE_DEPENDENCIES](./PHASE_DEPENDENCIES.md).

> **Roadmap philosophy (anti-scope-creep).** We do **not** build: a fake dungeon before combat is fun · a raid mockup before enemies work · a guild menu before networking · an auction house without an economy · ten empty zones · three one-ability classes · stat-less equipment · giant empty terrain. We **do** build one satisfying slice and deepen it.

> 📍 **Live progress** (which phases are actually done) is tracked in [`AGENTS.md`](../../AGENTS.md) and [`CHANGELOG.md`](../../CHANGELOG.md), not here — this document is the **static plan**. As of the latest sync: **`0.0.1`–`0.7.0` are ✅ done** (the full Lv 1–30 game + Lv-30 endgame is playable; the UX/accessibility commit list is in — settings, tooltips, audio, remappable controls; Level 1–30 Content + Endgame Foundation gate automatable scope passed), plus a **`0.7.1` HUD/UI pass** (unit-frames, Esc menu, micro-bar) after the playtest; **next is `0.8.x`** (optimization & balance pass).

## Milestone band overview
| Band | Theme | Player-facing outcome | Exit gate |
|---|---|---|---|
| **0.0.x** | Research, tech validation, core foundations | move around a greyboxed world at 60 FPS | [Core Movement](./RELEASE_GATES.md#1-core-movement-gate) |
| **0.1.x** | First complete grinding loop (1 class, 1 family) | grind→XP→loot→equip feels good | [Combat](./RELEASE_GATES.md#2-combat-gate) + [Core Loop](./RELEASE_GATES.md#3-core-loop-gate) |
| **0.2.x** | All three classes operational | Warrior/Hunter/Priest all solo-viable | [Three-Class](./RELEASE_GATES.md#4-three-class-gate) |
| **0.3.x** | Initial world progression (Lv 1–10) | a polished first ten levels across 2 zones | [Level 1–10](./RELEASE_GATES.md#5-level-110-gate) |
| **0.4.x** | Expanded brackets (Lv 11–20) | two more zones, mechanics deepen | (interim) |
| **0.5.x** | Complete Lv 1–30 progression | reach level 30 end-to-end | [Level 1–30 Content](./RELEASE_GATES.md#6-level-130-content-gate) |
| **0.6.x** | Equipment depth + level-30 farming | a real endgame gear chase | [Endgame Foundation](./RELEASE_GATES.md#7-endgame-foundation-gate) |
| **0.7.x** | UX, accessibility, content polish | the game feels finished to use | (interim) |
| **0.8.x** | Optimization, saves, testing, balancing | stable, fast, reliable, balanced | [Technical Beta](./RELEASE_GATES.md#8-technical-beta-gate) |
| **0.9.x** | Beta candidates | content-complete, playtested RCs | [Content Beta](./RELEASE_GATES.md#9-content-beta-gate) |
| **1.0-BETA** | Public local beta | the full solo experience ships | [1.0-BETA](./RELEASE_GATES.md#10-10-beta-gate) |

---

## 0.0.x — Foundations

### 0.0.1-INDEV — "Blueprint" ✅ done
- **Phase:** planning · **Outcome:** a complete, internally-consistent development blueprint. · **Why:** so implementation can proceed phase-by-phase without reinventing direction. · **Deps:** none. · **Effort:** M · **Complexity:** L · **Risk:** L.
- **Included:** this entire `/docs` set (research, design, technical, production, qa, assets, decisions).
- **Excluded:** *all runtime code, dependencies, and assets.*
- **Acceptance:** every doc in [docs/README](../README.md) exists and cross-links; no code/deps/assets added; final quality checklist ([../../docs/production/ASSUMPTIONS.md](./ASSUMPTIONS.md) + brief §31) passes.
- **Validation:** doc cross-check for contradictions; confirm repo has no source.
- **Deliverables:** the planning repository (this commit).

### 0.0.2-INDEV — "Scaffold" ✅ done
- **Phase:** foundations · **Outcome:** an empty Three.js scene renders in-browser with a stable game loop and perf overlay. · **Deps:** 0.0.1. · **Effort:** S · **Complexity:** S · **Risk:** L.
- **Included:** Vite+TS project; `three`; fixed-timestep loop ([ARCHITECTURE_PLAN](../technical/ARCHITECTURE_PLAN.md#fixed-timestep-simulation-decoupled-rendering)); ECS-lite skeleton; perf overlay devtool; Vercel preview build; Vitest+Playwright wired.
- **Excluded:** gameplay, content, art beyond primitives.
- **Acceptance:** scene renders 60 FPS empty; loop ticks at fixed DT; perf overlay shows FPS/draw calls; CI builds & deploys a preview.
- **Validation:** Playwright loads the page; build size baseline recorded.
- **Deliverables:** runnable empty client; CI pipeline.

### 0.0.3-INDEV — "Greybox Movement" ✅ done → **Core Movement Gate**
- **Outcome:** a player capsule moves (WASD) across a greyboxed Greenmarch chunk with a working chase camera and collision. · **Deps:** 0.0.2.
- **Included:** kinematic character controller (capsule vs heightfield + box colliders); chunked terrain (one zone greybox); chase-cam rig + collision; input system; instanced props placeholder; distance/frustum culling.
- **Excluded:** combat, enemies, UI beyond debug.
- **Acceptance:** [Core Movement Gate](./RELEASE_GATES.md#1-core-movement-gate) — smooth movement, no fall-through, camera no clipping, ≥60 FPS in greybox on mid-range HW.
- **Validation:** Playwright movement smoke; manual traversal; perf capture.
- **Deliverables:** traversable greybox zone.

### 0.0.4-INDEV — "First Contact" ✅ done
- **Outcome:** a target dummy can be selected and hit; damage numbers appear; one ability + GCD work. · **Deps:** 0.0.3.
- **Included:** soft tab-target ([COMBAT_DESIGN](../design/COMBAT_DESIGN.md#1-targeting-model--decision)); basic attack + one spender; GCD/cooldown; [canonical damage formula](../design/COMBAT_DESIGN.md#5-damage-calculation-canonical-formula) (first pass); hit feedback; object pooling for damage numbers.
- **Excluded:** enemy AI, loot, progression.
- **Acceptance:** input→hit feedback ≤100ms; damage matches formula in unit tests; GCD enforced.
- **Deliverables:** combat skeleton vs a dummy.

---

## 0.1.x — First Complete Grinding Loop (ONE class, ONE family)

### 0.1.0-INDEV — "Vertical Slice" ✅ done → **Combat Gate + Core Loop Gate**
- **Outcome:** as a **Warrior**, fight one **Greenmarch** family (Standard tier), gain **XP**, get **loot**, **equip** an upgrade, recover, repeat — and it's *fun*. · **Deps:** 0.0.4. · **Effort:** L · **Complexity:** M · **Risk:** M.
- **Included:** Warrior early kit (filler, Sunder, Whirl, Bulwark); **melee enemy archetype** with aggro/leash/social/respawn ([ENEMY_DESIGN](../design/ENEMY_DESIGN.md)); XP curve + leveling ([PROGRESSION_AND_XP](../design/PROGRESSION_AND_XP.md)); loot drop→pickup→inventory→equip; a handful of equipment slots; rarities Common/Uncommon; gold; **save v1** (IndexedDB) ([SAVE_SYSTEM_PLAN](../technical/SAVE_SYSTEM_PLAN.md)); minimal HUD.
- **Excluded:** other classes, other families/zones, elites/rares, Rare+ rarity, world bosses, full UI.
- **Acceptance:** [Combat Gate](./RELEASE_GATES.md#2-combat-gate) + [Core Loop Gate](./RELEASE_GATES.md#3-core-loop-gate) — TTK 3–6s normal; ≥70% HP after a fight; a 20-minute grind session is rated enjoyable in playtest; save/reload works; 60 FPS with 20 active enemies.
- **Validation:** combat-sim tests; a recorded 20-min playtest with telemetry vs [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md); leak check over the session.
- **Deliverables:** the playable core loop. **This is the most important milestone — if this isn't fun, do not proceed to breadth.**

### 0.1.1-INDEV — "Loop Hardening" ✅ done
- **Outcome:** the slice is robust and performant. · Included: pooling everywhere, AI throttling, spatial grid, drop/inventory polish, salvage v1, telemetry counters. · Acceptance: perf budgets hold; no leaks over 60-min session; inventory never blocks flow.

---

## 0.2.x — All Three Classes Operational → **Three-Class Gate**

### 0.2.0-INDEV — "The Hunter" ✅ done
- **Outcome:** Hunter is solo-viable through the slice (ranged, Focus, kiting, traps). · Included: Hunter early kit; **ranged-skirmisher enemy archetype**; projectile pooling; trap/ground-target tech. · Excluded: Priest. · Acceptance: Hunter clears the slice solo; kiting doesn't break leashing.

### 0.2.1-INDEV — "The Priest" ✅ done → **Three-Class Gate**
- **Outcome:** Priest is solo-viable (holy damage + Atonement self-sustain + shields). · Included: Priest early kit; **caster enemy archetype** (telegraph + interrupt target); healing/shield systems; +Healing affix. · Acceptance: [Three-Class Gate](./RELEASE_GATES.md#4-three-class-gate) — all three classes solo the slice; inter-class TTK within ±20%; Priest is **not** a weak-damage healer; Warrior is **not** a slow tank; Hunter needs **no pet**.
- **Deliverables:** three operational classes with early kits.

---

## 0.3.x — Initial World Progression (Lv 1–10) → **Level 1–10 Gate**

### 0.3.0 — "First Ten Levels" ✅ done
- **Outcome:** a polished Lv 1–10 journey across **Greenmarch** + **Thornwood Vale**. · Deps: 0.2.1. · Effort: L · Complexity: M · Risk: M.
- **Included:** full ability unlocks Lv 1–10 for all classes; Thornwood families (spiders/bramble/spore) + **defensive** & **swarm** archetypes; first **elite** + first **rare-named**; full equipment slot set; rarity up to **Rare**; vendors/gold sinks; Oathstones + fast travel; **onboarding** (≤2 min to first kill); HUD v1; map v1.
- **Excluded:** zones beyond Thornwood; Epic+; world bosses; choice nodes beyond what unlocks by 10.
- **Acceptance:** [Level 1–10 Gate](./RELEASE_GATES.md#5-level-110-gate) — a new player of each class reaches Lv 10 in the target time with no progression blocker; elite/rare readable & soloable with correct play; onboarding teaches all core verbs.
- **Validation:** new-player + experienced-player playtests for each class; telemetry vs bracket pacing.
- **Deliverables:** a shippable-feeling first act.

---

## 0.4.x — Expanded Brackets (Lv 11–20)

### 0.4.0 — "Fen & Ember" ✅ done
- **Outcome:** Lv 11–20 across **Sunken Fen** + **Emberreach**. · Deps: 0.3.0. · Effort: L · Complexity: M · Risk: M.
- **Included:** ability unlocks 11–20 (interrupt, choice node A, ground-AoE tool, choice node B); **resistance system** (blight/fire) live; **caster/support/pack-leader** archetypes; elite **camps**; **Epic** rarity; Reinforcement upgrade + salvage materials; bad-luck protection v1.
- **Excluded:** Lv 21–30 zones; Legendary/Relic; world bosses.
- **Acceptance:** both zones meet the [anti-empty checklist](../design/WORLD_AND_ZONES.md#world-content-sizing-anti-empty-checklist); resist gear matters but never gates required content; choice nodes produce distinct play.
- **Deliverables:** mid-game content + systems depth.

---

## 0.5.x — Complete Lv 1–30 Progression → **Level 1–30 Content Gate**

### 0.5.0 — "Road to Thirty" ✅ done
- **Outcome:** the **entire** Lv 1–30 path is playable across all six regions. · Deps: 0.4.0. · Effort: XL · Complexity: M · Risk: M.
- **Included:** **Riven Peaks** (21–25) + **Gravereach** (26–30); full ability kits to **Lv 30** incl. capstones + choice node C; all enemy **families**; undead **holy-weakness** lever; complete zone connectivity & travel.
- **Excluded:** Legendary/Relic depth, world bosses (foundation only), final polish/optimization.
- **Acceptance:** [Level 1–30 Content Gate](./RELEASE_GATES.md#6-level-130-content-gate) — each class completes 1→30 solo with no blocker; pacing within target per bracket; every zone passes the anti-empty checklist.
- **Validation:** **full 1→30 playthrough** per class with telemetry; death/blocker audit.
- **Deliverables:** the complete leveling game.

---

## 0.6.x — Equipment Depth & Level-30 Farming → **Endgame Foundation Gate**

### 0.6.0 — "The Chase" ✅ FEATURE-COMPLETE (awaiting playtest)
> Progress: **CP1 Legendary ✓ · CP2 three world bosses ✓ · CP3 Relics ✓ · CP4 Lv-30 endgame loop ✓.** Endgame Foundation Gate automatable scope passes; subjective retention is the owner's playtest (live state in AGENTS.md/CHANGELOG.md). **Next: 0.7.x.**
- **Outcome:** a real level-30 gear chase. · Deps: 0.5.0. · Effort: L · Complexity: M · Risk: M.
- **Included:** **Legendary** + **Relic** tiers; full affix depth & tiers; bad-luck protection tuned; Reinforcement to cap; **3 solo world bosses** (Emberhorn, Rimewyrm, Maelgrith); named rares per zone; target-farming sources; loot identities per zone ([ENDGAME_FOUNDATION](../design/ENDGAME_FOUNDATION.md)).
- **Excluded:** dungeons/raids (deferred), any group content.
- **Acceptance:** [Endgame Foundation Gate](./RELEASE_GATES.md#7-endgame-foundation-gate) — each class beats each world boss solo; target farming yields a wanted upgrade within a focused session; chase stays engaging across repeated sessions.
- **Deliverables:** the beta endgame.

---

## 0.7.x — UX, Accessibility & Content Polish

### 0.7.0 — "Feel & Finish" ✅ FEATURE-COMPLETE (awaiting playtest)
> Progress: **CP1 Settings/accessibility ✓ · CP2 tooltips & comparison ✓ · CP3 audio volume/mute + vignette ✓ · CP4 fully remappable keybinds + mouse options ✓.** Accessibility commit list in (all persisted & live); subjective UX/feel is the owner's playtest. (Optional later polish: buff-duration icons, onboarding cards.) **Next: 0.8.x.**
- **Outcome:** the game *feels finished* to use. · Deps: 0.6.0. · Effort: L · Complexity: M · Risk: L.
- **Included:** full HUD/menus, map, **Goal Tracker**, tooltips & item comparison, settings; **all accessibility options** ([UX_AND_ACCESSIBILITY](../design/UX_AND_ACCESSIBILITY.md)); audio pass (Howler) + VFX pass within budgets; onboarding polish; pause.
- **Excluded:** new gameplay systems (feature freeze begins).
- **Acceptance:** every accessibility option present, persists, and applies without restart; no placeholder UI on critical paths.
- **Deliverables:** UX-complete build.

---

## 0.8.x — Optimization, Saves, Testing & Balancing → **Technical Beta Gate**

### 0.8.0 — "Hardening"
- **Outcome:** stable, fast, reliable, balanced. · Deps: 0.7.0. · Effort: L · Complexity: M · Risk: M.
- **Included:** optimization to all [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md); **save migrations + corruption recovery + export/import** hardened; full **test suites** ([TEST_STRATEGY](../qa/TEST_STRATEGY.md)); telemetry-driven **balance pass** vs [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md); **browser compatibility** (Chromium+Firefox); error handling.
- **Excluded:** new content/features.
- **Acceptance:** [Technical Beta Gate](./RELEASE_GATES.md#8-technical-beta-gate) — budgets met; no save-destroying bug; migrations pass for all historical versions; clean Vercel production deploy; cross-browser load.
- **Deliverables:** a technically beta-ready build.

---

## 0.9.x — Beta Candidates → **Content Beta Gate**

### 0.9.0 → 0.9.x — "Release Candidates"
- **Outcome:** content-complete, playtested candidates; iterate on feedback/bugs. · Deps: 0.8.0. · Effort: M · Complexity: L · Risk: M.
- **Included:** structured playtests ([PLAYTEST_PLAN](../qa/PLAYTEST_PLAN.md)); pacing/drop/balance/difficulty/navigation/onboarding/level-30-retention tuning; bug-fix burn-down; no-new-features.
- **Acceptance:** [Content Beta Gate](./RELEASE_GATES.md#9-content-beta-gate) — playtest KPIs in range; no critical/blocker bugs open; level-30 retention validated.
- **Deliverables:** a release candidate meeting all gates.

---

## 1.0-BETA — Public Local Beta → **1.0-BETA Gate**
- **Outcome:** the full solo experience ships as a public local beta on Vercel. · Deps: 0.9.x. 
- **Included:** everything in [BETA_ACCEPTANCE_CRITERIA](../qa/BETA_ACCEPTANCE_CRITERIA.md): class select; Warrior/Hunter/Priest; complete 1→30 solo; six regions; standard/elite/rare/world-boss enemies; responsive combat; equipment & inventory with multiple rarities & comparison; gold & vendors; a working level-30 gear chase; minimal onboarding; map/navigation; local saving + migrations; settings, accessibility, performance options; stable Vercel deploy; browser compatibility; no critical progression blockers; no known save-destroying bugs.
- **Excluded:** real multiplayer, accounts, dungeons, raids, guilds, PvP, trading — all deferred ([DEFERRED_FEATURES](./DEFERRED_FEATURES.md)).
- **Acceptance:** [1.0-BETA Gate](./RELEASE_GATES.md#10-10-beta-gate) passes in full; the [final quality review](./ASSUMPTIONS.md#final-quality-review-brief-31) checklist is green.
- **Deliverables:** **Oathbound 1.0-BETA**, a polished local single-player MMORPG-style game.

---

## Effort/risk summary (relative)
| Band | Relative effort | Top risk |
|---|---|---|
| 0.0.x | M | tech validation; perf baseline |
| 0.1.x | L | **is the loop fun?** (highest-leverage risk) |
| 0.2.x | L | class balance / Priest solo damage |
| 0.3.x | L | content density vs pace |
| 0.4.x | L | systems depth without bloat |
| 0.5.x | **XL** | content volume; pacing across 6 zones |
| 0.6.x | L | loot/economy balance; boss solo-tuning |
| 0.7.x | L | scope creep during polish |
| 0.8.x | L | perf & save-migration correctness |
| 0.9.x | M | playtest feedback churn |

See [RISK_REGISTER](./RISK_REGISTER.md) for full risk handling and the **review phase** for each risk.

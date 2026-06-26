# Release Gates

Formal, **objective** gates that block forward progress in the [VERSION_ROADMAP](./VERSION_ROADMAP.md). Each gate is a checklist of **measurable/testable** conditions — never vague language like "combat feels good." A gate is **pass/fail**; a failed gate stops the next band ([PHASE_DEPENDENCIES](./PHASE_DEPENDENCIES.md)). Earlier gates are **continuous invariants** re-checked every release.

Performance numbers reference [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md); balance numbers reference [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md); tests reference [TEST_STRATEGY](../qa/TEST_STRATEGY.md).

---

## 1. Core Movement Gate
*Validates: movement, camera, collision, terrain, input, browser performance.*
- [ ] Player moves via WASD with responsive accel/decel; no input lag > ~50ms.
- [ ] Chase camera rotates/zooms; **springs to avoid clipping** terrain/props.
- [ ] Collision: no fall-through-floor, no wall-clip, stable on slopes; ground-snap works.
- [ ] At least one greyboxed zone chunk traversable end-to-end.
- [ ] **≥60 FPS** sustained in the greybox on the mid-range reference machine; draw calls within early budget.
- [ ] Playwright movement smoke passes; perf capture recorded as the baseline.

## 2. Combat Gate
*Validates: targeting, ability execution, damage, enemy behavior, feedback, death/recovery.*
- [ ] Soft tab-target: Tab/click locks; soft-acquire works with no target; range/LoS enforced.
- [ ] Abilities respect GCD + individual cooldowns + resource costs; input buffer feels responsive.
- [ ] Damage equals the [canonical formula](../design/COMBAT_DESIGN.md#5-damage-calculation-canonical-formula) (asserted by unit tests).
- [ ] Enemy archetype state machine works: aggro, engage, **leash + reset/heal**, social aggro, respawn.
- [ ] Every ability has visible + audible feedback; crits emphasized; telegraphs readable.
- [ ] Death → respawn at Oathstone; "Shaken" debuff; **no XP loss**.
- [ ] **Input→feedback ≤100ms**; **60 FPS with 20 active enemies** on reference HW.

## 3. Core Loop Gate
*Validates: grinding, XP, loot, equipment, power growth, session enjoyment.*
- [ ] Full micro→core loop runs: fight → XP → loot → compare → equip → recover → repeat.
- [ ] XP/leveling matches [PROGRESSION_AND_XP](../design/PROGRESSION_AND_XP.md); a level-up grants a real change.
- [ ] Loot drops, enters inventory, can be compared (delta tooltip) and equipped; gold accrues.
- [ ] Balance bands hold: **TTK 3–6s** normal; **≥70% HP** after a normal fight; **≤8s** recovery; survive a 3-pull.
- [ ] A **20-minute grind session** is rated enjoyable by ≥ playtest threshold ([PLAYTEST_PLAN](../qa/PLAYTEST_PLAN.md)); telemetry shows reward cadence met.
- [ ] Save/reload mid-grind restores state; no leak over a 60-min session.

> **This is the highest-leverage gate.** If the loop isn't fun here, **do not** widen to more classes/zones — iterate the loop.

## 4. Three-Class Gate
*Validates: Warrior, Hunter, Priest; solo viability; class identity; balance ranges.*
- [ ] Each class completes the vertical slice **solo**.
- [ ] Each has: a solo damage plan, a defensive/recovery tool, a pack answer, a mobility/control/escape tool ([CLASS_DESIGN](../design/CLASS_DESIGN.md)).
- [ ] **Inter-class TTK within ±20%** vs a same-level standard at equal gear.
- [ ] **Priest deals competitive solo damage** (not a weak group-healer); **Warrior is not a slow low-damage tank**; **Hunter needs no pet AI**.
- [ ] No required progression needs another class's role.

## 5. Level 1–10 Gate
*Validates the first complete progression bracket.*
- [ ] A new player of **each class** reaches **Lv 10** with **no progression blocker** in target pacing.
- [ ] Greenmarch + Thornwood pass the [anti-empty checklist](../design/WORLD_AND_ZONES.md#world-content-sizing-anti-empty-checklist).
- [ ] First **elite** and first **rare-named** are readable and soloable with correct play.
- [ ] **Onboarding** teaches move/target/ability/loot/equip/recover in ≤2 min.
- [ ] New-player and experienced-player playtests recorded for each class.

## 6. Level 1–30 Content Gate
*Validates the complete leveling journey.*
- [ ] **Each class** completes **1→30 solo** with no blocker (full playthrough recorded).
- [ ] All six regions exist, connect, and pass the anti-empty checklist.
- [ ] Full ability kits to 30 incl. capstones + all three choice nodes function.
- [ ] All enemy families + tiers (standard/elite/rare) present and stable; undead holy-weakness lever works.
- [ ] Per-bracket pacing within target ([PROGRESSION_AND_XP](../design/PROGRESSION_AND_XP.md#per-bracket-pacing-targets)).

## 7. Endgame Foundation Gate
*Validates level-30 open-world equipment farming.*
- [ ] At Lv 30, each class can **locate, attempt, and defeat each of the 3 world bosses solo** in 2–5 min.
- [ ] Legendary/Relic drops exist with **bad-luck protection** that demonstrably works.
- [ ] **Target farming** yields a wanted slot upgrade within a focused session.
- [ ] Reinforcement upgrade + salvage economy balanced ([ITEMS_AND_EQUIPMENT](../design/ITEMS_AND_EQUIPMENT.md)).
- [ ] Repeated-session **retention** check passes ([PLAYTEST_PLAN](../qa/PLAYTEST_PLAN.md)).

## 8. Technical Beta Gate
*Validates: saves, migrations, performance, browser compatibility, Vercel deployment, error handling.*
- [ ] **All [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md) met** on the reference machine (FPS, draw calls, memory, load, save).
- [ ] **No known save-destroying bug**; migrations pass for **every historical save version**; export/import round-trips losslessly; corruption recovery falls back to backup.
- [ ] Loads and plays in **Chromium + Firefox**; reduced-effects mode works on integrated graphics.
- [ ] Clean **production Vercel deploy**; SPA + caching headers correct; rollback available.
- [ ] Global error handling shows a recoverable screen, not a blank canvas.

## 9. Content Beta Gate
*Validates: progression pacing, drop rates, class balance, enemy difficulty, world navigation, onboarding, level-30 retention.*
- [ ] Playtest KPIs in range: minutes-per-level per bracket, deaths-per-level, drop cadence, class TTK spread.
- [ ] No **critical or blocker** bugs open; no critical progression blockers.
- [ ] Navigation/map/goal-tracker let a returning player resume in <1 min.
- [ ] Level-30 retention validated across multiple sessions.

## 10. 1.0-BETA Gate
*Defines exactly what makes this a beta, not an internal build.*
- [ ] **Every item in [BETA_ACCEPTANCE_CRITERIA](../qa/BETA_ACCEPTANCE_CRITERIA.md) is satisfied.**
- [ ] Gates 1–9 all pass as current invariants (full regression green).
- [ ] The [final quality review](./ASSUMPTIONS.md#final-quality-review-brief-31) checklist is fully green.
- [ ] A player can start a new character, reach 30, develop a build, improve equipment, explore the whole beta world, and keep farming meaningful upgrades — **solo, locally, on Vercel, with no account**.

---

## Gate procedure
1. Run the automated suites (unit, integration, browser, perf, save-migration).
2. Run the required playtests for the band and capture telemetry.
3. Walk the checklist; any unchecked item = **fail** → fix or descope (never silently waive a gate).
4. Record the result + evidence in the version's deliverables; only then start the next band.

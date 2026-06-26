# Changelog

Development proceeds **one phase at a time** (see [docs/production/VERSION_ROADMAP.md](./docs/production/VERSION_ROADMAP.md)).
Each entry is an **independently testable build**. After each phase, work pauses for testing before the next begins.

---

## 0.2.0-INDEV — "The Hunter"
**Goal:** a second, fully distinct class — a ranged **Hunter** — plus the ranged combat tech to support it, proving the slice works for more than one playstyle. Toward the [Three-Class Gate](./docs/production/RELEASE_GATES.md#4-three-class-gate).

**Added**
- **Data-driven classes** (`src/sim/classes.ts`): a class registry (primary stat, resource behaviour, ability kit). The Warrior (melee/STR/Fury) is unchanged; the **Hunter** (ranged/DEX/Focus) is new. A `PlayerClass` component + `setPlayerClass` make the kit/resource/primary swappable; **save** persists the class.
- **Hunter early kit**: Quick Shot (filler projectile), Piercing Arrow (Focus spender), Volley (cone of arrows), **Disengage** (off-GCD backflip + brief move-speed via a Fleet status), and **Snare Trap** (placed trap). Focus regenerates passively (vs Fury's build/decay).
- **Pooled projectiles** (`src/sim/projectiles.ts`): plain structs in a reused pool — zero per-shot allocation — that home to their target and resolve damage via the shared applier. Used by Hunter shots **and** enemy shots. Rendered from a matching mesh pool (`src/render/projectile-view.ts`).
- **Ranged-skirmisher enemy**: the Greenmarch **Reaver** — shoots and **kites** (back-pedals when you close), countered by closing the gap or breaking LoS. The camp is now mixed (Bloomhusks + Reavers). Any hit now aggros an idle enemy (ranged pulls work).
- **Traps + root** (`src/sim/systems/trap.ts`): Snare Trap roots + lightly damages the first enemy to enter, then is consumed; a `Root` status stops enemy movement (kiting tool). Rendered as a ground ring (`src/render/trap-view.ts`).
- **New ability targeting** in the combat system: `projectile`, `cone`, `dash`, and `trap`, alongside the existing melee/AoE/self.
- **Class-select** overlay for new characters (`src/render/class-select.ts`); the HUD is class-aware (Fury/Focus label, kit-driven hotbar incl. key 5); DEX/STR smart-loot so drops favour your class.
- Tests: class registry, Hunter projectile combat + a **Hunter TTK 3–6s** combat-sim, traps/root, the Reaver shooting the player, and class switching → **94 unit tests**; a new "play as the Hunter" e2e (7 e2e).

**Verified (automated):** `typecheck` ✓ · `npm test` → 94/94 ✓ · `build` ✓ (~153 KB gzip) · `test:e2e` → 7/7 ✓ (incl. Hunter ranged shots + save/reload). The Warrior path and all 0.1.x systems remain green.

**Tuning note:** Hunter single-target was tuned **down** into the TTK band and closer to the Warrior; the strict **inter-class ±20% TTK** balance is the job of the `0.2.1` Three-Class Gate (with the Priest), validated via the combat-sim + telemetry.

**Pending owner playtest:** is the Hunter *fun* and solo-viable end-to-end? does kiting feel good without trivializing (leash still holds)? plus the standing 0.1.x perf/fun items.

**Not included (by design):** the Priest (next), other zones/families, elites/rares, Reinforcement, consumables, full ability kits past the early game.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173 → pick Warrior or Hunter
# Hunter: 1 Quick Shot · 2 Piercing Arrow · 3 Volley · 4 Disengage · 5 Snare Trap
```

**Next phase →** `0.2.1-INDEV` "The Priest" → **Three-Class Gate**: the third class (holy damage + Atonement self-sustain + shields), a caster enemy archetype (telegraph + interrupt), and the inter-class balance pass (all three solo the slice within ±20% TTK).

---

## 0.1.1-INDEV — "Loop Hardening"
**Goal:** make the vertical slice **robust, performant, and measurable** — the engineering pass behind the [Core Loop Gate](./docs/production/RELEASE_GATES.md#3-core-loop-gate) so the owner's playtest runs on solid ground.

**Added**
- **Spatial grid broad-phase** (`src/sim/spatial-grid.ts` + `systems/spatial.ts`): a uniform-cell index rebuilt each tick, used for targeting candidate gathering and social aggro so neighbour queries stay near-O(1) as enemy counts climb toward the ≤40-active-AI budget. Integrated as an optional dependency (full-scan fallback preserved for tests).
- **AI throttling**: distant **idle** enemies update on a slow cadence (sim-radius gated) — they cost almost nothing until the player is near.
- **Leak hardening**: uncollected loot now **despawns after a grace period** (`LootDrop.ttl`), keeping world-entity count bounded over long sessions; per-tick **scratch arrays are reused** in the combat/AI systems to cut steady allocation churn.
- **Salvage v1** (`src/sim/salvage.ts`, unlocked Lv 3): convert unwanted gear into **Whetstones** + gold; **item lock**, per-item salvage, and **salvage-all-Common**. Materials are a wallet (not items), persisted in the save.
- **Inventory polish**: backpack **sorted by power**, gold + whetstone wallet, equip / lock / salvage actions, and the salvage-all button (Lv-3 gated with a hint).
- **Telemetry** (`src/sim/telemetry.ts`): kills, deaths, damage dealt/taken, XP, gold, loot, salvage, session time, and **avg TTK + downtime** — fed by sim events, shown on the perf overlay and exposed on the handle to validate the [SOLO_BALANCE_RULES](./docs/design/SOLO_BALANCE_RULES.md) bands during playtests.
- Tests: spatial grid, salvage (gating/yield/lock/salvage-all), telemetry, and a **loot-TTL leak proof** (entity count returns to baseline) → **85 unit tests**; a new telemetry e2e (6 e2e).

**Verified (automated):** `typecheck` ✓ · `npm test` → 85/85 ✓ · `build` ✓ (~150 KB gzip) · `test:e2e` → 6/6 ✓. New gate-relevant proofs: bounded entity growth (loot TTL); broad-phase + AI throttling bound per-tick work; telemetry surfaces TTK/downtime/death-rate.

**Pending owner playtest (unchanged from 0.1.0):** the "20-minute grind is enjoyable" rating, the real 60-minute memory-plateau session, and "60 FPS with 20 active enemies" on reference hardware — the structures are now in place to make those pass; telemetry gives the numbers to tune against.

**Not included (by design):** other classes (Hunter/Priest), other zones/families, elites/rares, Reinforcement upgrade, consumables — all later phases.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173
# Grind the camp; open I/C → sort/lock/salvage gear (salvage unlocks at Lv 3).
# The perf overlay now shows kills / avg TTK / downtime / deaths.
```

**Next phase →** `0.2.0-INDEV` "The Hunter" — the second class (ranged/Focus/kiting) + a ranged-skirmisher enemy archetype. **Gated on the owner's Core Loop playtest sign-off**: per the roadmap, do not widen to more classes until the loop is confirmed fun.

---

## 0.1.0-INDEV — "Vertical Slice"
**Goal:** the first **complete grinding loop** — as a Warrior, fight a Greenmarch camp, gain XP/levels, loot gear, equip upgrades, recover, repeat; the run persists. Targets the [Combat Gate](./docs/production/RELEASE_GATES.md#2-combat-gate) + [Core Loop Gate](./docs/production/RELEASE_GATES.md#3-core-loop-gate).

**Added**
- **Warrior early kit + Fury** (`src/sim/combat/abilities.ts`): Cleaving Strike (filler, builds Fury, frontal cleave), Sunder (spender + Armor Break), Whirl (self-AoE), Bulwark (off-GCD damage reduction). Resource cost/gain, Haste-scaled GCD, timed buffs/debuffs (`statuses.ts`), and leech — applied through one shared damage path (`src/sim/combat/apply.ts`).
- **Melee enemy AI** (`src/sim/systems/enemy-ai.ts`): Bloomhusks (Greenmarch) with idle→engage→attack→leash/reset(heal)→dead/respawn, aggro radius, **social aggro**, leashing, a telegraphed wind-up, and cheap steering (move + ground-snap + prop collision).
- **Progression** (`src/sim/stats.ts`, `progression.ts`): the canonical XP curve, the con (level-difference) system + anti-farm gray rule, level-up with stat recompute + refill.
- **Loot → inventory → equip** (`src/sim/loot/*`, `inventory.ts`): data-driven item generation (Common/Uncommon, per-slot budget + affixes), drop tables (~10% uncommon from a standard), corpse drops, gold auto-pickup, `F` to loot, equip with derived-stat recompute and upgrade deltas.
- **Recovery & death** (`src/sim/systems/recovery.ts`): out-of-combat HP ramp (≤8s) + Fury decay, in-combat Fury trickle, death → respawn at spawn with a **Shaken** debuff (no XP loss).
- **Save v1** (`src/sim/save.ts`, `src/platform/save-store.ts`): versioned serialize/apply (character, gold, gear, inventory, position) persisted to **IndexedDB**, autosave on key events + timer + page-hide, loaded on boot. (Migration/corruption hardening with `idb`+`zod` is scheduled for the Technical Beta phase per ADR-005.)
- **HUD & UI** (`src/render/hud.ts`, `inventory-panel.ts`, `loot-view.ts`, enemy con-colour nameplate): player frame (HP/Fury/XP/level + combat state), ability hotbar with cooldown/affordability, gold, loot prompt, toasts, an interactive inventory/equipment panel (`I`/`C`) with compare + equip, and rarity-coloured loot beams. Minimal procedural **audio** (`src/platform/audio.ts`).
- An entity **factory** (`src/sim/factory.ts`) shared by the bootstrap and tests.
- Tests: stats, items/loot, the warrior combat loop incl. a **TTK 3–6s** combat-sim, the enemy-AI FSM (aggro/social/leash), and a save round-trip → **72 unit tests**; Playwright now drives an attack/GCD sequence, targeting, and a **save/reload persistence** check (5 e2e).

**Removed:** the 0.0.4 target dummies (replaced by real Bloomhusk enemies + AI).

**Verified (automated):** `typecheck` ✓ · `npm test` → 72/72 ✓ · `build` ✓ (~149 KB gzip) · `test:e2e` → 5/5 ✓. Gate items checked by tests: damage = canonical formula; soft tab-target + range/LoS; GCD + cooldowns + resource costs; enemy aggro/social/leash/reset/respawn; TTK 3–6s; loot→inventory→equip; XP/level-up; save/reload restores state.

**Pending owner playtest (subjective/long-running gate items):** the "20-minute grind is enjoyable" rating, the 60-minute no-leak session, "60 FPS with 20 active enemies" on reference HW, and final balance tuning (camp density/aggro, drop cadence, TTK spread) — these need a human playtest and are the focus of `0.1.1`.

**Not included (by design):** other classes (Hunter/Priest), other zones/families, elites/rares, Rare+ rarity, salvage/Reinforcement, consumables, world bosses, class-select, full UI/map.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173
# 1–4 abilities, Tab/click to target, walk over gold + F to loot, I/C for inventory.
# Kill Bloomhusks → XP/level, loot drops, equip upgrades; progress saves automatically.
```

**Next phase →** `0.1.1-INDEV` "Loop Hardening": pooling/AI throttling/spatial grid, drop & inventory polish, salvage v1, telemetry counters, and the playtest-driven balance pass — making the slice robust and provably within the [SOLO_BALANCE_RULES](./docs/design/SOLO_BALANCE_RULES.md) bands.

---

## 0.0.4-INDEV — "First Contact"
**Goal:** a combat skeleton against a target dummy — select it, attack it, and watch damage numbers fly. First step toward the [Combat Gate](./docs/production/RELEASE_GATES.md#2-combat-gate).

**Added**
- **Combat ECS components** (`src/core/ecs/components.ts`): `Health`, `Offense`, `Defense`, `AbilityState`, `Target`, `Targetable`, `EnemyInfo`, `Dummy`, plus a `DamageType` school.
- **Canonical damage formula** (`src/sim/combat/damage.ts`) — `rawHit → mitigated (armorDR/resistDR/weakness) → crit → round(× variance)` with `armorDR = armor/(armor + K(L))`, `K(L)=50+25·L`. Pure & deterministic: the random crit/variance roll is passed in, so unit tests pin exact numbers.
- **Soft tab-targeting** (`src/sim/combat/targeting.ts`) — nearest-in-cone acquisition (~100° `v1`), Tab cycle, and a cheap segment-vs-cylinder line-of-sight check. All pure.
- **Combat system** (`src/sim/systems/combat.ts`) — ticks the GCD (1.0s `v1`) and per-ability cooldowns, a ~0.25s input buffer, soft-acquire / lock validation, applies the formula, faces the target, and emits combat events.
- **Two abilities on the GCD** (`src/sim/combat/abilities.ts`) — *Strike* (basic) and *Heavy Strike* (cooldown). Data-driven; no class resources yet.
- **Target dummies** (×3) that take damage and **auto-respawn** after death (`src/sim/systems/dummy.ts`).
- **Render/UI** (reads sim only): enemy view with capsule, billboarded HP bar, hit flash, and a target reticle (`src/render/enemy-view.ts`); **pooled** floating damage numbers (`src/render/damage-numbers.ts`); a target frame (`src/render/target-frame.ts`).
- **Input**: Tab (cycle target), Esc (clear), `1`/`2` (abilities), left-click (select) (`src/platform/input.ts`).
- Tests: damage / targeting / combat-system unit suites (**53 unit tests**); Playwright now drives an **attack + GCD** sequence and **Tab/Esc** targeting.

**Verified:** `typecheck` ✓ · `npm test` → 53/53 ✓ · `build` ✓ (~140 KB gzip) · `test:e2e` ✓ (boot + movement + attack/GCD + targeting).

**Acceptance (0.0.4):** input→hit feedback well under 100ms (30 Hz sim, next-frame numbers); damage matches the canonical formula in unit tests; GCD enforced (unit + e2e). ✓

**Not included (by design):** enemy AI/aggro/leashing, loot, progression/XP, classes & resources, healing/shields, status effects, interrupts.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173
# 1/2 to attack the dummies ahead, Tab to lock, click to select, Esc to clear
```

**Next phase →** `0.1.0-INDEV` "Vertical Slice": the Warrior early kit vs one Greenmarch enemy family with XP, loot, equip, and a v1 save — the first complete grinding loop → **Combat Gate + Core Loop Gate**.

---

## 0.0.3-INDEV — "Greybox Movement"
**Goal:** walk a character around a greyboxed world with a third-person camera, collision, and ground-snap. Reaches the **Core Movement Gate**.

**Added**
- Procedural greybox **terrain**: a deterministic heightfield with a flattened spawn and gentle hills, rendered as a vertex-coloured mesh (`src/world/heightfield.ts`, `src/render/terrain-mesh.ts`).
- **Kinematic character controller**: camera-relative WASD, gravity + jump, terrain ground-snap, static-collider push-out, world bounds (`src/sim/systems/movement.ts`, `src/sim/collision.ts`).
- **Third-person chase camera** with mouselook (hold right-mouse), wheel zoom, follow smoothing, and **collision spring** (raycasts terrain/props so the view never clips) (`src/render/camera-rig.ts`).
- **Input** controller (keyboard + mouse) exposing plain control state to the sim; **P** toggles pause (`src/platform/input.ts`).
- Player capsule with a facing indicator (`src/render/player-view.ts`); instanced rock props (one draw call).
- Render interpolation between fixed sim steps (`lerp`/`lerpAngle` in `src/core/math.ts`).
- Tests: heightfield sampling, collision push-out, math helpers (+ existing) = **29 unit tests**; Playwright now drives **WASD movement** and asserts the player moves and stays grounded.

**Removed:** the 0.0.2 spinning-cube demo (its instancing lesson now lives in the real terrain/props).

**Verified:** `typecheck` ✓ · `npm test` → 29/29 ✓ · `build` ✓ (~136 KB gzip) · `test:e2e` ✓ (boot + movement).

**Acceptance (Core Movement Gate):** smooth WASD movement; chase camera that doesn't clip terrain; no fall-through (ground-snap) and prop collision; a traversable terrain chunk; input working; loop stable. ✓

**Not included (by design):** combat, targeting, enemies, abilities, loot, UI panels.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173
# WASD to move, hold right-mouse to look, wheel to zoom, Shift sprint, Space jump, P pause
```

**Next phase →** `0.0.4-INDEV` "First Contact": a target dummy, soft tab-targeting, a basic attack + one ability on the global cooldown, the canonical damage formula, and floating damage numbers.

---

## 0.0.2-INDEV — "Scaffold"
**Goal:** an empty Three.js scene renders in-browser with a stable fixed-timestep game loop, an ECS-lite skeleton, and a performance overlay. Establishes the technical foundation before any gameplay.

**Added**
- Vite + TypeScript project; `three` rendering; strict `tsconfig`.
- Fixed-timestep simulation loop decoupled from interpolated rendering (`src/core/loop.ts`, `src/core/time.ts`).
- ECS-lite world — entities + data components + systems (`src/core/ecs/`).
- Seedable RNG (`src/core/rng.ts`) and a typed event bus (`src/core/events.ts`).
- Renderer with sun + hemisphere lighting, fog, ground plane, resize handling (`src/render/renderer.ts`).
- Demo scene: 144 instanced spinning cubes (**one draw call**) driven by the ECS — proves fixed-step sim + render interpolation + instancing (`src/render/demo-scene.ts`).
- Performance overlay devtool: FPS, frame ms, draw calls, entities, sim steps (`src/devtools/perf-overlay.ts`).
- Tests: Vitest unit suites (ECS, RNG, loop accumulator — 17 tests) + Playwright boot smoke test.
- Vercel static-deploy config (`vercel.json`); `.gitignore`.

**Verified**
- `npm run typecheck` ✓ · `npm test` → 17/17 ✓ · `npm run build` ✓ (~131 KB gzip JS) · `npm run test:e2e` ✓ (canvas renders, loop running, draw calls > 0, no console errors).

**Acceptance (Core Movement Gate baseline):** scene renders; loop ticks at fixed DT; perf overlay reports FPS/draw calls; build + tests pass. ✓

**Not included (by design):** movement, input, camera control, collision, combat, gameplay, content, art beyond primitives.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173 — spinning cubes + perf overlay
npm test                     # unit tests
npm run test:e2e             # browser smoke test
```

**Next phase →** `0.0.3-INDEV` "Greybox Movement": WASD character controller, third-person chase camera, collision, and a greyboxed terrain chunk → **Core Movement Gate**.

---

## 0.0.1-INDEV — "Blueprint"
**Goal:** a complete, internally consistent development plan before any code.

**Added**
- 40 cross-linked planning documents under [`/docs`](./docs/README.md): research, design, technical, production, QA, assets, and decision records — covering the full path from `0.0.1-INDEV` to `1.0-BETA`.

**Not included (by design):** any runtime code, dependencies, or assets.

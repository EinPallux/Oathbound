# AGENTS.md — start here

Entry point for **any coding agent or LLM** working in this repository (Claude Code, Cursor, Copilot, etc.). Read this first; it tells you **what the project is, where it currently stands, what to build next, how to verify, and the rules to follow.**

## What this is
**Oathbound** — a chill, solo-friendly **3D browser MMORPG** (TypeScript + Vite + **Three.js**), a local single-player experience through its `1.0-BETA` milestone, deployable to **Vercel** with **no account/backend/database**. The complete design/technical/production blueprint lives in [`/docs`](./docs/README.md) (start at [`docs/README.md`](./docs/README.md)). It is the **single source of truth** for design decisions.

## ▶ Current status — where to continue
> **Keep this section up to date at the end of every phase.**

- **Current build: `0.6.0-INDEV` — feature-complete (awaiting playtest).** Everything `0.0.1` → `0.5.0`, plus `0.6.0` **CP1 (Legendary)** and the owner-requested **world/biome/player-model pass**, is **merged** into `claude/game-design-docs-70dim2`. The remaining `0.6.0` work is a **stacked branch chain awaiting PR**: **CP2 (3 world bosses)** `claude/oathbound-0.6.0-world-bosses` → **CP3 (Relics)** `claude/oathbound-0.6.0-relics` → **CP4 (Lv-30 endgame loop)** `claude/oathbound-0.6.0-endgame` (each verified). The full Lv 1–30 game is playable end-to-end: 3 classes, 6 regions, the grind/loot/equipment loop, Epic + Legendary + **Relic** rarity, Reinforcement + bad-luck protection, the Lv-30 capstone, three telegraphed world bosses, hand-designed relics, and a Lv-30 endgame chase with target-farming guidance.
- **Done & verified:** `0.0.1`–`0.0.4` foundations · `0.1.0`–`0.1.1` first loop · `0.2.0`–`0.2.1` three classes · `0.3.0` First Ten Levels · `0.4.0` Fen & Ember (Lv 11–20: deeper kits + talents + resistance + support/pack-leader archetypes; Sunken Fen + Emberreach; **Epic + Reinforcement + BLP**) · **`0.5.0` Road to Thirty (Lv 21–30): Riven Peaks (frost) + Gravereach (undead/holy-weak), the Lv-30 upgrade-capstone, and a validated 1→30 journey.**
- **Health (last full check):** `typecheck` ✓ · **270/270** unit ✓ · `build` ✓ (~175 KB gzip) · **13/13** e2e ✓ · no conflict markers / code smells.
- **Gates passed:** **Core Movement** + the *automatable* scope of **Combat / Core Loop / Three-Class / Level 1–10 / Level 1–30 Content** + the **Endgame Foundation** gates (no XP gaps; all classes reach 30; no HP walls or one-shots vs any zone's tankiest standard; **every class solos every world boss with an endgame loadout**, the Legendary power margin is bounded, and target-farming/BLP yields upgrades within a focused session). The **subjective playthrough-feel / retention** of each is the owner's playtest.
- **⏳ Awaiting owner playtest (does not block code):** the **1→30 feel** end-to-end — pacing, the two endgame zones, and the Lv-30 capstone "spike". A standing tuning note: with a full set of level-appropriate uncommon gear, single-target TTK on same-level **standards is fast (~1.5–3.5 spender-casts)** and standards are low individual threat — within the "chill" target but worth confirming; revisit in the **0.8.x balance pass**.
- **✅ Feature-complete (awaiting playtest) — `0.6.0` "The Chase" (equipment depth + Lv-30 endgame)** → the **Endgame Foundation Gate** (spec: [`docs/design/ENDGAME_FOUNDATION.md`](./docs/design/ENDGAME_FOUNDATION.md)). **CP1 done:** **Legendary** rarity (orange, 4 affixes, ×1.45; ~6% tail on rare-named / ~1.5% on elites; counts as rare+ for BLP; rarity-coloured loot toasts). **Owner-requested world pass (between CP1 and CP2):** the world was grown from a 100 m greybox into a **680 m open world** with **biomes** (snow-capped Riven Peaks, the sunken Fen, etc.) and **environmental scenery** (trees/boulders/pebbles/bushes/grass/reeds/flowers + rivers + roads). Landed **non-destructively** — no gameplay-systems/API/balance changes, collision unchanged (rocks only), enemy families/levels/tiers/named-spawns preserved; world size + the directional zone layout now live in `src/world/layout.ts`. World bosses still drop into the (now far larger) zones the same way. Also added (owner-requested): a **procedural low-poly player model** with class weapons (Warrior sword+shield · Hunter bow · Priest staff+halo) + walk/idle/attack-cast animations — cosmetic class identity only (equipped gear deliberately doesn't show yet), driven by a new **additive** `AbilityUsed` sim event (combat emits → renderer animates). **CP2 done:** **3 solo world bosses** — Emberhorn (Emberreach/fire ~Lv 20), the Rimewyrm (Riven/frost ~Lv 25), Maelgrith (Gravereach/blight, the Lv-30 capstone fight). New `boss` tier + `Boss` component + `boss-ai` system: HP-threshold **phases**, a **telegraphed heavy** (generalised `GroundAoe` with `hitsPlayer` — a filling danger zone you step out of), big HP tuned to a multi-minute solo fight via the real damage formula, lone/wide-leash/5-min respawn, and a **Legendary-leaning `boss` loot tier**. **CP3 done (this branch, stacked on CP2):** **Relics** — a new apex `relic` rarity of hand-designed uniques (`src/sim/loot/relics.ts`): four build-enablers (Ashbrand *execute* · Heart of the Rimewyrm *boss-slayer* · Crown of the Hollow King *reaper* · Sael's Bloodroot Sigil *crit-leech*), one pool per boss, ~8 % drop tail. Effect plumbing = a `RelicMods` bundle (computed in `recomputeDerived`) read by small hooks in `combat/apply.ts` (damage) + `rewards.ts` (on-kill); save-compatible via an optional `Item.relic`. Class-agnostic combat-modifier relics for now (per-ability relics are a later extension of the same registry). **CP4 done (this branch, stacked on CP3):** the **Lv-30 endgame loop + target-farming guidance** — at the cap the Goal Tracker pivots to "Endgame" (Relic collection N/4 + the next relic to hunt: boss, zone, drop), a data-driven target board (`src/sim/content/endgame.ts`), a persistent `RelicCollection` (discovered on pickup, saved), world bosses plotted on the full map, and **Endgame Foundation Gate** automatable scope validated by tests (every class solos every boss with an endgame loadout; bounded power margin; BLP/target-farming yields upgrades). See CHANGELOG. **▶ Next: `0.7.x` UX/accessibility polish** (then 0.8.x optimization/balance → 0.9.x RCs → 1.0-BETA). Confirm with the owner before starting the next version. **Open item:** the 0.6.0 CP2→CP3→CP4 branch chain awaits PR/merge; the subjective endgame retention/feel is the owner's playtest.
- **Branching:** the owner reviews via PR. Build each checkpoint on a feature branch (`claude/oathbound-<topic>`) → open a PR into `claude/game-design-docs-70dim2`. The owner merges + deletes the branch. (History: `0.4.0`–`0.5.0` landed via PRs #10–#20.)
- **Live progress log:** [`CHANGELOG.md`](./CHANGELOG.md) (every phase, each ending with "Next phase →").
- **The full plan:** [`docs/production/VERSION_ROADMAP.md`](./docs/production/VERSION_ROADMAP.md) (`0.0.1-INDEV` → `1.0-BETA`).

## ⚠️ Working agreement (the repo owner's workflow — IMPORTANT)
- **Build ONE roadmap phase at a time.** Do **not** implement multiple phases in a single run — the owner tests each build.
- **After finishing a phase:** update [`CHANGELOG.md`](./CHANGELOG.md) **and** the *Current status* section above → run all checks → commit → push → then **STOP and ask the owner before starting the next phase.**
- Develop on the branch the owner specifies (currently `claude/oathbound-phase-0-0-4-to8alw`). One commit per phase, including its verification results. Do **not** open a PR unless asked.

## How to run & verify
```bash
npm install
npm run dev        # dev server → http://localhost:5173
npm test           # unit tests (Vitest)
npm run test:e2e   # browser smoke/behaviour tests (Playwright)
npm run build      # typecheck (tsc --noEmit) + production build → dist/
npm run typecheck  # types only
```
**Keep `typecheck` + `test` + `build` green before committing.** Add tests with each new system (unit for logic, e2e for behaviour).

*Remote-environment note:* Chromium is pre-installed at `/opt/pw-browsers`; `playwright.config.ts` auto-resolves the binary. **Do not run `playwright install`.**

## Conventions (non-negotiable)
- **Sim/render separation:** code under `src/sim/**` and `src/core/ecs/**` must **not** import `three` or touch the DOM. The simulation owns gameplay truth and stays unit-testable + future-server-portable; rendering (`src/render/**`) only *reads* sim state. See [ARCHITECTURE_PLAN](./docs/technical/ARCHITECTURE_PLAN.md).
- **Fixed-timestep sim (30 Hz) + interpolated render** — see `src/core/loop.ts`. Save `prev*` fields for interpolation.
- **Data-driven content** + **seedable RNG** (`src/core/rng.ts`) for anything random, so loot/spawns and tests are deterministic. See [CONTENT_DATA_STRATEGY](./docs/technical/CONTENT_DATA_STRATEGY.md).
- **All numeric values are `v1 tuning targets`** — validated by gates/telemetry, not final law.
- **Originality:** never copy Hordes.io content, assets, names, or balancing — it is a design reference only ([THIRD_PARTY_ASSET_POLICY](./docs/assets/THIRD_PARTY_ASSET_POLICY.md)).
- **Don't build [deferred features](./docs/production/DEFERRED_FEATURES.md)** (multiplayer, accounts, dungeons, raids, PvP, trading…) before the solo loop is polished.
- **TypeScript is strict** (`verbatimModuleSyntax`, `noUnusedLocals/Parameters`). Use `import type` for type-only imports.

## Repo map
```
/docs            The full plan & single source of truth (index: docs/README.md)
                   - production/VERSION_ROADMAP.md   phased plan 0.0.1 → 1.0-BETA
                   - production/RELEASE_GATES.md      objective pass/fail gates
                   - production/ASSUMPTIONS.md        source-of-truth registry
                   - decisions/DECISION_RECORDS.md    ADRs for major choices
/src/core        loop, time, rng, events, math, ecs (world/components)   [no three]
/src/sim         systems (movement…) + collision (pure)                  [no three]
/src/world       pure world data (heightfield…)                          [no three]
/src/render      renderer, camera-rig, terrain-mesh, player-view         [three]
/src/platform    input (audio/storage land here later)
/src/devtools    perf overlay (and future spawn/level/teleport tools)
/src/game        bootstrap (composition root), states
/tests/unit      Vitest (pure logic)      /tests/e2e  Playwright (behaviour)
CHANGELOG.md     per-phase build log (live progress)
```

## Decisions
Major technical/design choices are recorded as ADRs in [docs/decisions/DECISION_RECORDS.md](./docs/decisions/DECISION_RECORDS.md). Follow them; if you must diverge, add or update an ADR explaining why.

## Definition of done (the destination)
The objective `1.0-BETA` bar is in [docs/qa/BETA_ACCEPTANCE_CRITERIA.md](./docs/qa/BETA_ACCEPTANCE_CRITERIA.md). Get there by walking the [roadmap](./docs/production/VERSION_ROADMAP.md) one gated phase at a time.

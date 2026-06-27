# AGENTS.md — start here

Entry point for **any coding agent or LLM** working in this repository (Claude Code, Cursor, Copilot, etc.). Read this first; it tells you **what the project is, where it currently stands, what to build next, how to verify, and the rules to follow.**

## What this is
**Oathbound** — a chill, solo-friendly **3D browser MMORPG** (TypeScript + Vite + **Three.js**), a local single-player experience through its `1.0-BETA` milestone, deployable to **Vercel** with **no account/backend/database**. The complete design/technical/production blueprint lives in [`/docs`](./docs/README.md) (start at [`docs/README.md`](./docs/README.md)). It is the **single source of truth** for design decisions.

## ▶ Current status — where to continue
> **Keep this section up to date at the end of every phase.**

- **Current build: `0.5.0-INDEV`.** Everything `0.0.1` → `0.5.0` is **merged** into `claude/game-design-docs-70dim2` (HEAD `57bea83` at last sync). The full Lv 1–30 game is playable: 3 classes, 6 regions, the grind/loot/equipment loop, Epic rarity + Reinforcement + bad-luck protection, and the Lv-30 capstone.
- **Done & verified:** `0.0.1`–`0.0.4` foundations · `0.1.0`–`0.1.1` first loop · `0.2.0`–`0.2.1` three classes · `0.3.0` First Ten Levels · `0.4.0` Fen & Ember (Lv 11–20: deeper kits + talents + resistance + support/pack-leader archetypes; Sunken Fen + Emberreach; **Epic + Reinforcement + BLP**) · **`0.5.0` Road to Thirty (Lv 21–30): Riven Peaks (frost) + Gravereach (undead/holy-weak), the Lv-30 upgrade-capstone, and a validated 1→30 journey.**
- **Health (last full check):** `typecheck` ✓ · **200/200** unit ✓ · `build` ✓ (~163 KB gzip) · **11/11** e2e ✓ · no conflict markers / code smells.
- **Gates passed:** **Core Movement** + the *automatable* scope of **Combat / Core Loop / Three-Class / Level 1–10 / Level 1–30 Content** gates (no XP gaps; all classes reach 30; no HP walls or one-shots vs any zone's tankiest standard). The **subjective playthrough-feel** of each is the owner's playtest.
- **⏳ Awaiting owner playtest (does not block code):** the **1→30 feel** end-to-end — pacing, the two endgame zones, and the Lv-30 capstone "spike". A standing tuning note: with a full set of level-appropriate uncommon gear, single-target TTK on same-level **standards is fast (~1.5–3.5 spender-casts)** and standards are low individual threat — within the "chill" target but worth confirming; revisit in the **0.8.x balance pass**.
- **▶ Next phase:** **`0.6.0` — equipment depth + the Lv-30 endgame** (Legendary/Relic tiers, named-rare & world-boss chase) → the **Endgame Foundation Gate**. The beta's long tail; spec in [`docs/design/ENDGAME_FOUNDATION.md`](./docs/design/ENDGAME_FOUNDATION.md). **Confirm with the owner before starting.**
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

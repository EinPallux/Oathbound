# Oathbound — Planning & Design Documentation

This is the **single source of truth** for the design, technical direction, production roadmap, and quality plan of **Oathbound**, a 3D browser-based solo-MMORPG planned from version `0.0.1-INDEV` to `1.0-BETA`.

> 📍 **Current state lives elsewhere.** This `/docs` set is the **static plan/blueprint** (the single source of truth for *decisions*). For **where the build currently stands and what to implement next**, see [`AGENTS.md`](../AGENTS.md) and the live log in [`CHANGELOG.md`](../CHANGELOG.md). Implementation has begun and follows the [Version Roadmap](./production/VERSION_ROADMAP.md) one phase at a time.

## Repository assessment (at planning time — `0.0.1-INDEV`)

The table below records the repository **at the start of planning**, when this documentation set was the first content added. Runtime code has since been scaffolded — see [`CHANGELOG.md`](../CHANGELOG.md) for current contents.

| Item | State at planning time |
|------|------------------------|
| Git repository | Yes — branch `claude/game-design-docs-70dim2`, remote `EinPallux/Oathbound` |
| Commits before planning | **None** (empty repository) |
| Source code | None (scaffolded later, from `0.0.2-INDEV`) |
| Dependencies / `package.json` | None (added from `0.0.2-INDEV`) |
| Assets | None |
| Documentation | This set (created by the planning task) |

There was nothing to inspect or preserve at planning time; this documentation set was the first content added to the repository.

## How to read these docs

If you are a future implementation session, read in this order:

1. **Vision & scope** → [GAME_VISION](./design/GAME_VISION.md), then [GAME_DESIGN_DOCUMENT](./design/GAME_DESIGN_DOCUMENT.md) (the umbrella spec that links everything).
2. **What we learned from** → [HORDES_IO_ANALYSIS](./research/HORDES_IO_ANALYSIS.md), [COMPARABLE_GAMES](./research/COMPARABLE_GAMES.md).
3. **How it plays** → [CORE_GAMEPLAY_LOOP](./design/CORE_GAMEPLAY_LOOP.md), [COMBAT_DESIGN](./design/COMBAT_DESIGN.md), [CLASS_DESIGN](./design/CLASS_DESIGN.md).
4. **Numbers & systems** → [PROGRESSION_AND_XP](./design/PROGRESSION_AND_XP.md), [ITEMS_AND_EQUIPMENT](./design/ITEMS_AND_EQUIPMENT.md), [ENEMY_DESIGN](./design/ENEMY_DESIGN.md), [WORLD_AND_ZONES](./design/WORLD_AND_ZONES.md), [SOLO_BALANCE_RULES](./design/SOLO_BALANCE_RULES.md), [ENDGAME_FOUNDATION](./design/ENDGAME_FOUNDATION.md).
5. **How it's built** → [TECH_STACK_EVALUATION](./technical/TECH_STACK_EVALUATION.md), [ARCHITECTURE_PLAN](./technical/ARCHITECTURE_PLAN.md), [RENDERING_AND_PERFORMANCE](./technical/RENDERING_AND_PERFORMANCE.md), [SAVE_SYSTEM_PLAN](./technical/SAVE_SYSTEM_PLAN.md), [CONTENT_DATA_STRATEGY](./technical/CONTENT_DATA_STRATEGY.md).
6. **When it's built** → [VERSION_ROADMAP](./production/VERSION_ROADMAP.md), [PHASE_DEPENDENCIES](./production/PHASE_DEPENDENCIES.md), [RELEASE_GATES](./production/RELEASE_GATES.md).
7. **Guardrails** → [DEFERRED_FEATURES](./production/DEFERRED_FEATURES.md), [RISK_REGISTER](./production/RISK_REGISTER.md), [ASSUMPTIONS](./production/ASSUMPTIONS.md), [Decision Records](./decisions/DECISION_RECORDS.md).

## Document map

### Research (`/docs/research`)
- [HORDES_IO_ANALYSIS.md](./research/HORDES_IO_ANALYSIS.md) — what to learn, redesign, and avoid from the primary reference.
- [COMPARABLE_GAMES.md](./research/COMPARABLE_GAMES.md) — other lightweight browser RPGs and their lessons.
- [SOURCE_LOG.md](./research/SOURCE_LOG.md) — every external source, with confirmed-vs-assumed labeling.

### Design (`/docs/design`)
- [GAME_VISION.md](./design/GAME_VISION.md) · [GAME_DESIGN_DOCUMENT.md](./design/GAME_DESIGN_DOCUMENT.md) · [CORE_GAMEPLAY_LOOP.md](./design/CORE_GAMEPLAY_LOOP.md)
- [COMBAT_DESIGN.md](./design/COMBAT_DESIGN.md) · [CLASS_DESIGN.md](./design/CLASS_DESIGN.md) · [PROGRESSION_AND_XP.md](./design/PROGRESSION_AND_XP.md)
- [ITEMS_AND_EQUIPMENT.md](./design/ITEMS_AND_EQUIPMENT.md) · [ENEMY_DESIGN.md](./design/ENEMY_DESIGN.md) · [WORLD_AND_ZONES.md](./design/WORLD_AND_ZONES.md)
- [SOLO_BALANCE_RULES.md](./design/SOLO_BALANCE_RULES.md) · [ENDGAME_FOUNDATION.md](./design/ENDGAME_FOUNDATION.md) · [UX_AND_ACCESSIBILITY.md](./design/UX_AND_ACCESSIBILITY.md)

### Technical (`/docs/technical`)
- [TECH_STACK_EVALUATION.md](./technical/TECH_STACK_EVALUATION.md) · [ARCHITECTURE_PLAN.md](./technical/ARCHITECTURE_PLAN.md) · [RENDERING_AND_PERFORMANCE.md](./technical/RENDERING_AND_PERFORMANCE.md)
- [SAVE_SYSTEM_PLAN.md](./technical/SAVE_SYSTEM_PLAN.md) · [CONTENT_DATA_STRATEGY.md](./technical/CONTENT_DATA_STRATEGY.md) · [VERCEL_DEPLOYMENT_PLAN.md](./technical/VERCEL_DEPLOYMENT_PLAN.md) · [FUTURE_MULTIPLAYER_BOUNDARIES.md](./technical/FUTURE_MULTIPLAYER_BOUNDARIES.md)
- **Online (owner-committed, [ADR-013](./decisions/DECISION_RECORDS.md#adr-013-going-online--authoritative-node-server--sqlite)):** [MMO_ARCHITECTURE.md](./technical/MMO_ARCHITECTURE.md) (server, protocol, SQLite) · [VPS_HOSTING_GUIDE.md](./technical/VPS_HOSTING_GUIDE.md) (what VPS to buy + Linux setup)

### Production (`/docs/production`)
- [VERSION_ROADMAP.md](./production/VERSION_ROADMAP.md) · [PHASE_DEPENDENCIES.md](./production/PHASE_DEPENDENCIES.md) · [RELEASE_GATES.md](./production/RELEASE_GATES.md)
- [RISK_REGISTER.md](./production/RISK_REGISTER.md) · [ASSUMPTIONS.md](./production/ASSUMPTIONS.md) · [DEFERRED_FEATURES.md](./production/DEFERRED_FEATURES.md) · [POST_BETA_MMO_HORIZON.md](./production/POST_BETA_MMO_HORIZON.md)
- **[MMO_ROADMAP.md](./production/MMO_ROADMAP.md)** — the owner-committed online track (phases M0→M8: server, multiplayer, accounts, SQLite, VPS ops)

### QA (`/docs/qa`)
- [TEST_STRATEGY.md](./qa/TEST_STRATEGY.md) · [PLAYTEST_PLAN.md](./qa/PLAYTEST_PLAN.md) · [PERFORMANCE_BUDGETS.md](./qa/PERFORMANCE_BUDGETS.md) · [BETA_ACCEPTANCE_CRITERIA.md](./qa/BETA_ACCEPTANCE_CRITERIA.md)

### Assets (`/docs/assets`)
- [ART_DIRECTION_PLAN.md](./assets/ART_DIRECTION_PLAN.md) · [ASSET_PIPELINE.md](./assets/ASSET_PIPELINE.md) · [THIRD_PARTY_ASSET_POLICY.md](./assets/THIRD_PARTY_ASSET_POLICY.md) · [THIRD_PARTY_ASSETS.md](./assets/THIRD_PARTY_ASSETS.md) (registry template)

### Decisions (`/docs/decisions`)
- [DECISION_RECORDS.md](./decisions/DECISION_RECORDS.md) — lightweight ADRs for every major technical/design choice.

## Conventions used in these docs

- **Confirmed vs. assumed.** Research facts are tagged `[CONFIRMED]` (with a source) or `[ASSUMED]`/`[INFERRED]`. Design targets are tagged `v1 tuning target` when they are starting values to be validated by playtest telemetry, not final law.
- **Single source of truth.** Each number lives in exactly one canonical document; other docs link to it rather than restating it. If you find a contradiction, the canonical doc named in [ASSUMPTIONS.md](./production/ASSUMPTIONS.md) wins — fix the copy.
- **Originality.** All names, lore, zones, monsters, abilities, and items here are original to Oathbound.

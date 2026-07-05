# Future Multiplayer Boundaries

> **⚠️ Historical (realised by the MMO track, ADR-013).** This doc's premise — keep the multiplayer *option* open without building networking — is now history: the seam it prescribed is exactly what let the MMO track (M0–M7) land the authoritative server cleanly. Kept for context. Current online architecture: [MMO_ARCHITECTURE](./MMO_ARCHITECTURE.md).

How we keep the **option** of real multiplayer open **without implementing or overengineering** any networking for the beta. The rule: a clean **simulation/render seam** and **command/event shapes** that a server could later own — nothing more. Full (non-committed) sequencing lives in [POST_BETA_MMO_HORIZON](../production/POST_BETA_MMO_HORIZON.md).

> **The local game must run with zero networking layer.** Combat and progression logic simply must not be *inseparably embedded in rendering*. We are honest: converting a local Three.js RPG into an MMO is a **major project**, not a feature flag.

## Boundaries we put in now (cheap, justified)
| Boundary | How beta benefits today | Why it helps a future server |
|---|---|---|
| **Sim has no `three`/DOM imports** | unit-testable gameplay | the same sim code can run headless on a server |
| **Input → intents/commands** (not direct mutations) | clean UI/sim separation; replayable | commands are exactly what a client would send to a server |
| **Events out of sim** (damage, loot, level-up) | decoupled render/UI/audio/telemetry | server can emit the same events to clients |
| **Seedable RNG service** for rolls | reproducible tests & loot sims | server can be the authority on rolls (anti-cheat) |
| **Entity ids + data components** (ECS-lite) | easy save serialization | snapshot/delta replication maps naturally to components |
| **Target by entity id** (soft tab-target) | cheap, readable combat | trivial to server-validate "X hit Y" vs free-aim hitboxes |
| **`LootOwner`/eligibility field on drops** | always local player now | becomes per-player/instanced loot with a data change ([ENEMY_DESIGN](../design/ENEMY_DESIGN.md#drop-ownership-future-proofing)) |
| **Threat abstracted behind a system** | trivial solo threat now | tank-threat/aggro rules slot in without a combat rewrite ([COMBAT_DESIGN](../design/COMBAT_DESIGN.md#9-aggro-leashing-reset-pve)) |
| **zod validation at boundaries** | safe save import | the same discipline validates untrusted server/client payloads |

## Boundaries we deliberately DON'T build now (avoid overengineering)
- No netcode, no client-side prediction/reconciliation, no interest management, no serialization wire format, no lobby/session layer, no account system, no server runtime. Building these now would slow the beta and likely be redone once real requirements exist.

## What would have to change (honest assessment)
When/if multiplayer is pursued (post-beta), expect substantial work:

**Reusable mostly as-is**
- Content registries (items/abilities/enemies/zones), combat **formulas**, item-generation & loot logic, the ECS-lite sim systems (run server-side), art/assets, UI components (re-bound to networked state).

**Must move to / become server-authoritative**
- The **simulation tick** (movement, combat, AI, loot rolls, XP) becomes authoritative on the server; clients send intents and render replicated state.
- **Spawning, rare/world-boss timers, drop rolls** become server-owned (anti-cheat).
- **Persistence** moves from local IndexedDB to **server-side accounts/characters**.

**Net-new systems required**
- Authoritative server runtime + transport, account/auth, **interest management** (who-sees-what), state replication (snapshots/deltas), input prediction/reconciliation, lag compensation, **security/anti-cheat**, rate-limiting, moderation/chat, operational tooling, live economy controls, and group/instancing infrastructure for dungeons/raids.

**Content changes for groups**
- World bosses re-tuned/instanced for parties; some best-in-slot may become group content — but **open-world solo progression stays protected** ([SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md#future-multiplayer-fairness-recorded-now-not-built)).

## Save-data migration to online
- Local saves become a **one-time import source** into server accounts (or are kept as a separate offline mode). The [SAVE_SYSTEM_PLAN](./SAVE_SYSTEM_PLAN.md) versioning makes a clean export possible. Fields needing server custody (inventory, progression, currency) are already id-stable and schema-validated.

## Security note (recorded, not built)
A local single-player game has **no trust boundary** — the player can edit their own save; that's fine. The moment multiplayer exists, **the client becomes untrusted**: every roll/outcome must be server-validated. Designing combat around **entity-id targeting + seedable server-side RNG + command/event flow now** is precisely what makes that future validation tractable.

## Decision linkage
The *timing* of multiplayer prep is itself a decision: **do the cheap seams now, defer everything else** — recorded in [ADR-012](../decisions/DECISION_RECORDS.md#adr-012-timing-of-multiplayer-preparation). Whether dungeons/raids come before or after the MMO server is [ADR-011](../decisions/DECISION_RECORDS.md#adr-011-local-beta-endgame--whether-dungeonsraids-come-before-or-after-10-beta) (answer: **after**).

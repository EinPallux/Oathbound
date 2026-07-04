# Decision Records (ADRs)

Lightweight records for every major technical and design decision, in the brief's format: **Decision · Context · Options considered · Chosen direction · Reasons · Tradeoffs · Risks · Revisit-if.** These are the *why* behind the canonical docs; if a decision changes, update its ADR and the owning doc ([source-of-truth registry](../production/ASSUMPTIONS.md#2-source-of-truth-registry-one-owner-per-decision)).

Status legend: **Accepted** (current direction) · all are revisitable per their conditions.

---

## Technical Decision Records

### ADR-001: Raw Three.js vs React Three Fiber
- **Status:** Accepted.
- **Context:** We need a browser 3D renderer for a high-entity action-grind game with an owned game loop.
- **Options:** (a) **Raw Three.js**; (b) React Three Fiber; (c) Babylon.js / PlayCanvas; (d) custom WebGL.
- **Chosen:** **Raw Three.js** for the core scene; UI is separate DOM (ADR-002).
- **Reasons:** explicit control of the fixed-timestep loop, update order, instancing, and pooling; best perf headroom; minimal abstraction; Hordes.io itself validated *starting* on Three.js before any custom engine ([HORDES_IO_ANALYSIS](../research/HORDES_IO_ANALYSIS.md#6-technical-lessons-relevant-to-a-modern-threejs-project)).
- **Tradeoffs:** we hand-write loop/lifecycle that R3F would provide; less "React-y" DX.
- **Risks:** more boilerplate (R22 over-abstraction is the opposite risk — we stay concrete).
- **Revisit if:** UI/scene coupling becomes painful, or the team is far more productive in React for the whole client.

### ADR-002: UI Technology
- **Status:** Accepted.
- **Context:** Inventory grids, tooltips, menus, accessibility, fast iteration.
- **Options:** (a) **DOM/HTML+CSS overlay**; (b) canvas/WebGL-drawn UI; (c) R3F + drei HTML.
- **Chosen:** **DOM overlay** above the Three.js canvas, driven by a tiny custom signal/store.
- **Reasons:** crisp text, native layout, accessibility (focus, scaling, screen-reader hooks), and far faster iteration than canvas UI.
- **Tradeoffs:** must sync UI with sim state and manage pointer passthrough.
- **Risks:** overlay perf with many elements (mitigated by nameplate-density budget, [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md)).
- **Revisit if:** DOM overlay perf or sync proves worse than an in-canvas approach.

### ADR-003: Combat Targeting Model
- **Status:** Accepted.
- **Context:** Combat must suit browser perf, solo grind, 3 classes, future MP, low assets, indie scope.
- **Options:** tab-target; soft targeting; cursor/reticle; full action; **tab/action hybrid**.
- **Chosen:** **Soft tab-target hybrid** (lock target or auto-acquire in a forward cone; AoE by shape).
- **Reasons:** cheap (id + range/LoS, no per-frame hitbox physics), readable, low-friction solo grinding, server-validatable by entity id for future MP. Full rationale: [COMBAT_DESIGN](../design/COMBAT_DESIGN.md#1-targeting-model--decision).
- **Tradeoffs:** less twitch-skill ceiling than full action combat.
- **Risks:** could feel "auto"; mitigated by telegraph-dodging, positioning, interrupts, resource play.
- **Revisit if:** playtests strongly prefer free-aim action combat (A2 assumption).

### ADR-004: World Segmentation & Streaming
- **Status:** Accepted.
- **Context:** A compact open world that feels continuous but fits browser memory and indie scope.
- **Options:** (a) one giant seamless map; (b) **connected zone chunks with short-transition loads**; (c) isolated lobby scenes.
- **Chosen:** **connected zone chunks** (each a scene; ≤2s fade at borders; keep adjacent warm) + in-zone chunking/LOD/instancing.
- **Reasons:** best balance of immersion vs memory vs feasibility; avoids seamless mega-streaming cost/bugs; avoids lobby-game feel. [WORLD_AND_ZONES](../design/WORLD_AND_ZONES.md#streaming--segmentation-decision).
- **Tradeoffs:** brief loading fades between zones.
- **Risks:** transition leaks (covered by zone-transition leak tests, [TEST_STRATEGY](../qa/TEST_STRATEGY.md)).
- **Revisit if:** seamless traversal becomes a design requirement.

### ADR-005: Save Storage
- **Status:** Accepted.
- **Context:** Reliable local persistence of character/inventory/world state; versioned; no backend.
- **Options:** (a) localStorage; (b) **IndexedDB (via `idb`)**; (c) OPFS.
- **Chosen:** **IndexedDB** for saves; localStorage only for small settings; JSON export/import.
- **Reasons:** structured, async (no jank), comfortably larger than localStorage, good for versioned schemas. [SAVE_SYSTEM_PLAN](../technical/SAVE_SYSTEM_PLAN.md).
- **Tradeoffs:** async API + migration code.
- **Risks:** corruption (mitigated by checksums + backup slot, R16).
- **Revisit if:** data stays trivially small (localStorage would suffice) or OPFS offers a clear win.

### ADR-006: ECS vs Simpler Architecture
- **Status:** Accepted.
- **Context:** Many entities (player, enemies, projectiles, loot) and cross-cutting systems (combat touches health/resource/AI/loot).
- **Options:** (a) pure OOP entity classes; (b) **ECS-lite** (ids + data components + system functions); (c) a heavy ECS framework.
- **Chosen:** **pragmatic ECS-lite**, no framework dependency.
- **Reasons:** data-oriented iteration, composability, trivial save serialization, keeps sim logic out of rendering — without framework ceremony or premature enterprise architecture. [ARCHITECTURE_PLAN](../technical/ARCHITECTURE_PLAN.md#ecs-lite-model--adr-006).
- **Tradeoffs:** we maintain a small world/registry ourselves.
- **Risks:** under- or over-engineering (R22) — we keep it minimal.
- **Revisit if:** entity counts/system complexity justify a dedicated ECS library, or if it's overkill and plain composition is clearly simpler.

### ADR-007: State Management
- **Status:** Accepted.
- **Context:** UI and game systems need shared, reactive state without a heavy framework.
- **Options:** (a) Redux; (b) Zustand/MobX; (c) **tiny custom signal/store (pub-sub)**.
- **Chosen:** a **small custom event-driven store** for UI, fed by sim **events**; sim state itself lives in the ECS, not a UI store.
- **Reasons:** keeps bundle small, data flow obvious, and avoids coupling gameplay truth to a UI state library; commands-in/events-out shape also suits future MP ([FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md)).
- **Tradeoffs:** we write a little glue a library would provide.
- **Risks:** reinventing too much — kept intentionally tiny.
- **Revisit if:** UI state grows complex enough to warrant a small signals library.

### ADR-008: Collision & Navigation
- **Status:** Accepted.
- **Context:** Character-vs-terrain movement, simple static colliders, range/LoS checks, and enemy movement — not rigid-body dynamics.
- **Options:** (a) full physics engine (Rapier/cannon/ammo); (b) **custom kinematic controller + cheap steering nav**; (c) navmesh (recast).
- **Chosen:** **custom kinematic controller** (capsule vs heightfield + box/cylinder volumes) + **steering/raycast navigation** (optional per-zone grid for chokepoints). No physics engine, no navmesh for beta.
- **Reasons:** matches exactly what we need; cheap, predictable, easier to make server-authoritative later; avoids wasm payload/determinism complexity. [TECH_STACK_EVALUATION](../technical/TECH_STACK_EVALUATION.md).
- **Tradeoffs:** we own controller math; simpler nav can look less "smart."
- **Risks:** pathfinding cost/AI stutter (R5) — mitigated by AI throttling + active caps.
- **Revisit if:** real physics interactions or complex navigation become design requirements (then evaluate Rapier/recast).

### ADR-009: Procedural vs Sourced Assets
- **Status:** Accepted.
- **Context:** No assets exist; tiny team; tight perf budgets; legal safety.
- **Options:** (a) buy/source asset packs; (b) **procedural-first low-poly + small modular kit**; (c) commission everything.
- **Chosen:** **procedural-first**, low-poly + vertex color + a small modular kit; external assets only CC0/clearly-licensed, logged in the registry.
- **Reasons:** cheapest to produce/render/download, instancing-friendly, consistent, ages well, avoids licensing risk; never copies Hordes.io. [ART_DIRECTION_PLAN](../assets/ART_DIRECTION_PLAN.md), [ASSET_PIPELINE](../assets/ASSET_PIPELINE.md).
- **Tradeoffs:** more engineering for procedural generation; less visual fidelity than bought AAA packs.
- **Risks:** visual sameness/animation gaps (R6/R7) — mitigated by per-zone palettes + procedural anim.
- **Revisit if:** a high-quality, safely-licensed asset set would save significant time without breaking budgets/style.

---

## Design Decision Records

### ADR-010: Equipment Generation & Upgrade Complexity
- **Status:** Accepted.
- **Context:** Equipment must be a deep retention pillar but legible — not stat-soup or mandatory crafting.
- **Options:** (a) fixed hand-made items only; (b) **affix-based generation (5 tiers + Relics) + optional Reinforcement upgrade**; (c) full crafting/sockets/runewords economy.
- **Chosen:** **(b)** — bounded affix generation with budgets, smart-loot, bad-luck protection, and an **optional** gold/material Reinforcement (+1..+5 ilvl steps), capped below the next tier.
- **Reasons:** the Diablo-like affix chase is the genre's most durable solo loop ([COMPARABLE_GAMES](../research/COMPARABLE_GAMES.md)); Reinforcement is a gold/material **sink** + RNG insurance, **not** mandatory crafting. [ITEMS_AND_EQUIPMENT](../design/ITEMS_AND_EQUIPMENT.md).
- **Tradeoffs:** generation/balance complexity; another system to test (item-gen tests).
- **Risks:** equipment inflation / clutter (R12/R13) — mitigated by budgets, salvage-all, capped upgrade.
- **Revisit if:** playtests show Reinforcement adds clutter (cut it) or the chase needs more/less depth.

### ADR-011: Local-beta endgame & whether dungeons/raids come before or after 1.0-BETA
- **Status:** Accepted.
- **Context:** The beta needs a long tail at level 30; raids/dungeons are an eventual goal but are genuine *group* content.
- **Options:** (a) build instanced dungeons/raids for the beta; (b) **open-world solo endgame** (rares, elite camps, named monsters, target farming, 3 solo world bosses, Relics); (c) fake group content with bots.
- **Chosen:** **(b)** for the beta; dungeons/raids are **after** 1.0-BETA and **after** real multiplayer.
- **Reasons:** reuses systems the solo loop already needs; avoids half-built group content; faking with bots is explicitly forbidden; a static local app can't host authoritative group content anyway. [ENDGAME_FOUNDATION](../design/ENDGAME_FOUNDATION.md), [DEFERRED_FEATURES](../production/DEFERRED_FEATURES.md).
- **Tradeoffs:** no instanced group PvE in the beta.
- **Risks:** level-30 lacking purpose (R15) — mitigated by the chase ingredients + retention playtests.
- **Revisit if:** post-beta, after the [do-not-proceed conditions](../production/PHASE_DEPENDENCIES.md#the-do-not-proceed-rule-anti-scope-creep-enforcement) are all met and real multiplayer exists.

### ADR-012: Timing of Multiplayer Preparation
- **Status:** Accepted.
- **Context:** Future multiplayer is desired, but premature netcode would derail the solo beta.
- **Options:** (a) build networking now; (b) **only cheap architectural seams now, defer all netcode**; (c) ignore multiplayer entirely.
- **Chosen:** **(b)** — sim/render separation, commands-in/events-out, entity-id targeting, seedable RNG, loot-owner field, zod boundaries. No servers/netcode/accounts.
- **Reasons:** keeps the future door open at near-zero cost while honestly shipping a local game; avoids R21 (premature MP architecture) and R22 (over-abstraction). [FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md).
- **Tradeoffs:** a little discipline now (keeping sim free of render/DOM imports).
- **Risks:** doing *too much* "for later" — bounded explicitly to the listed seams.
- **Revisit if:** the project commits to the [post-beta MMO horizon](../production/POST_BETA_MMO_HORIZON.md) (then a real networking design begins).

### ADR-013: Going online — authoritative Node server + SQLite
- **Status:** Accepted.
- **Context:** The owner has committed to real multiplayer: Oathbound should be hostable on a Linux VPS and played with friends, with persisted game data moving to SQLite. This is the "revisit-if" of ADR-012 coming true — it activates [POST_BETA_MMO_HORIZON](../production/POST_BETA_MMO_HORIZON.md) ahead of 1.0-BETA by owner decision. Plan: [MMO_ROADMAP](../production/MMO_ROADMAP.md); design: [MMO_ARCHITECTURE](../technical/MMO_ARCHITECTURE.md).
- **Options:** *(runtime)* (a) **Node server reusing the existing sim**; (b) rewrite the sim in Go/Rust; (c) hosted realtime platforms (Colyseus Cloud, Nakama, PlayFab). *(transport)* WebSocket vs WebRTC/UDP. *(storage)* (a) **SQLite via `better-sqlite3`**; (b) Postgres; (c) keep browser storage + a sync layer. *(scale posture)* friends-server (≤ ~20 players) vs "real MMO" infrastructure.
- **Chosen:** **one Node 22 process running the untouched headless sim at 30 Hz**, WebSocket transport (JSON v1, zod-validated), **SQLite in WAL mode** as the single server-side store (hot columns + versioned `SaveData` JSON per character), Caddy for TLS/static/proxy, systemd for lifecycle — sized and simplified for a **friends server**, self-hosted on a small Linux VPS. Solo/offline mode (browser storage, Vercel) keeps working unchanged.
- **Reasons:** the sim is already DOM/`three`-free and Node-proven (unit tests run it headless), input already flows through the `ControlState` intent interface, sim events are ready-made broadcast deltas, and `SaveData` is a versioned POJO — a Node server *reuses* all of it; any rewrite discards it. WebSocket needs no NAT/STUN story and rides port 443. SQLite is in-process (zero extra ops), transactional, more than sufficient at this scale, and trivially backed up as one file; Postgres adds a service to run for no benefit at ≤20 players.
- **Tradeoffs:** JS single-thread ceiling (fine at target scale; faster-core VPS + interest management are the recorded levers); TCP head-of-line blocking vs UDP (acceptable for a 30 Hz tab-target game); JSON wire overhead (msgpack/delta snapshots recorded as later levers); SQLite is single-writer (irrelevant: one process).
- **Risks:** the M2 per-player sim refactor regressing the solo game (mitigation: land it behavior-neutral first, full suite green); netcode feel (dedicated M4 phase with an explicit latency bar); data loss on the VPS (WAL + flush-on-signal + nightly backups + a tested restore drill).
- **Revisit if:** concurrent players regularly exceed ~50 (storage/transport/scale posture all re-open), or the solo/offline mode is formally dropped (would simplify the client to online-only).

### Design note: Hunter pet (no permanent pet in beta)
Not a full ADR but recorded: a permanent Hunter pet is **excluded** from 1.0-BETA (AI/nav/anim/balance scope + identity risk); a **Beastmaster** spec is an optional **post-beta** addition. Rationale: [CLASS_DESIGN](../design/CLASS_DESIGN.md#hunter-and-the-pet-question). Revisit post-beta.

---

## How to add a new ADR
Copy the format (Decision · Context · Options · Chosen · Reasons · Tradeoffs · Risks · Revisit-if), give it the next ADR number, set **Status: Accepted/Proposed/Superseded**, and link it from the owning canonical doc and the [source-of-truth registry](../production/ASSUMPTIONS.md#2-source-of-truth-registry-one-owner-per-decision). Superseded ADRs stay in the file (struck through) for history.

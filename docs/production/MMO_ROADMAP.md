# MMO Roadmap — Oathbound Online (M0 → M8)

The owner has **committed to real multiplayer**: Oathbound becomes playable as a small MMORPG — a self-hosted, server-authoritative game you run on a **Linux VPS** and play with friends — and all persisted game data (accounts, characters, world flags) moves to **SQLite** on the server. This activates the [POST_BETA_MMO_HORIZON](./POST_BETA_MMO_HORIZON.md) and supersedes the "multiplayer is deferred" firewall in [DEFERRED_FEATURES](./DEFERRED_FEATURES.md) **for the items listed here only** (server, networking, accounts, chat). Everything else on that list (PvP, trading, guilds, dungeons, raids, auction house, …) **stays deferred**.

- **Decision record:** [ADR-013](../decisions/DECISION_RECORDS.md#adr-013-going-online--authoritative-node-server--sqlite) (authoritative Node server + SQLite).
- **Technical design:** [MMO_ARCHITECTURE](../technical/MMO_ARCHITECTURE.md) (server runtime, protocol, multiplayer sim refactor, SQLite schema).
- **Hosting:** [VPS_HOSTING_GUIDE](../technical/VPS_HOSTING_GUIDE.md) (exact VPS spec + Linux setup, step by step).

## Scope & honest framing

This is the **major project** the docs always said it would be — not a feature flag. The good news: the codebase was built for this moment. The sim (`src/sim`, `src/core`) has zero `three`/DOM imports and already runs headless under Node (the unit tests prove it); input flows through the abstract `ControlState` interface; combat targets by entity id; RNG is seeded; `LootDrop.owner` exists; `SaveData` is a clean versioned POJO. What's genuinely new: a server runtime + transport, a per-player input refactor of the sim, accounts/auth, SQLite persistence, replication to clients, and operations.

**Target scale (v1 tuning target):** a *friends server* — **≤ ~20 concurrent players** on one world instance, one process, one VPS. This target drives every simplification below (no interest management at first, JSON wire format first, one world). The architecture leaves room to grow, but we do not build for thousands.

**What this is NOT (still deferred):** PvP, trading/economy, guilds, dungeons/raids, mail, auction house, mounts, seasons, monetization. Group content beyond "fight the open world together" waits until the shared world is proven fun.

## Ground rules for the track

- **One phase at a time**, exactly like the 0.x roadmap: build → verify → CHANGELOG + status update → commit/push → **stop and ask the owner**.
- **Solo/offline mode keeps working the whole time.** The Vercel build remains a zero-networking, browser-storage single-player game. Online is a *mode*, not a replacement (revisit-if recorded in ADR-013). Every refactor (per-player input, etc.) must keep `typecheck` + unit + e2e green for the offline game.
- **Sim/render rule extends:** `src/sim`, `src/core`, `src/world`, and the new `src/net/protocol.ts` stay free of `three`/DOM **and** free of Node-only imports (`node:*`, `ws`, `better-sqlite3`) — they must run in both browser and Node. Server-only code lives in `/server`.
- **The server is the authority** for everything gameplay: movement, combat, AI, loot rolls, XP, spawns, boss timers. Clients send intents and render replicated state. The client becomes untrusted the moment M1 lands.

## Phase overview

| Phase | Name | Delivers | Risk/size |
|---|---|---|---|
| **M0** | Server Scaffold | headless sim ticking on Node, WS echo, shared protocol module, deps, scripts | S |
| **M1** | First Connection | one client plays *online*: login (dev), spawn, move, see the world served by the server | M |
| **M2** | Shared World | per-player sim refactor; N players see each other, fight, loot & level together | **L** |
| **M3** | Accounts + SQLite | real accounts, sessions, character slots in SQLite; autosave to DB; local-save import | M |
| **M4** | Netcode Feel | client-side prediction + reconciliation, interpolation buffer, reconnect, validation/rate limits | **L** |
| **M5** | Playing Together | XP sharing, loot tagging rules, multi-player threat, world-boss scaling, respawn/assist rules | M |
| **M6** | Chat & Presence | chat overlay, system messages, /who, MOTD, server password (friends-only lock) | S |
| **M7** | Ops & Hardening | prod build, systemd + Caddy + TLS + firewall + backups, admin commands, bot load test | M |
| **M8** | Friends Beta | real playtest with friends; balance/perf/bug pass → **Online Gate** | M |

Recommended sequencing: run this track **now, before 0.8.x** — the 0.8.x "Hardening" goals (save reliability, perf, testing) are largely absorbed into M3/M4/M7 in their server-side form. The owner decides final version numbering (suggestion: ship M-phases as `0.8.0-ONLINE.x` builds, and fold the old 0.8/0.9 hardening/RC bands into the run-up to `1.0-BETA` afterwards).

---

## M0 — Server Scaffold ("it ticks")

**Goal:** a Node process that runs the *existing* sim headless at 30 Hz and accepts WebSocket connections. No gameplay over the wire yet.

- Add `/server` (see [MMO_ARCHITECTURE §2](../technical/MMO_ARCHITECTURE.md#2-repository-layout--build)): entry, tick loop (replaces the RAF `GameLoop` with a drift-corrected timer), world bootstrap **reusing** `src/sim` + `src/core` + `src/world` (heightfield/colliders/spawns/bosses from the same seeds or the same `.oathbound-map.json` the client loads — Talar by default).
- Add `src/net/protocol.ts` (pure, isomorphic): message type constants + zod schemas for every client↔server message. zod becomes a real dependency (it was always the plan at boundaries).
- Deps: `ws`, `better-sqlite3` (unused until M3), `zod`; dev: `tsx`, `esbuild`. New scripts: `npm run server:dev` (tsx watch), `npm run server:build` (esbuild bundle, native module external), `npm run server:start`.
- A headless "sim smoke" unit test: boot the server world, tick 300 times, assert enemies wander/AI runs and no crash — this pins the "sim runs on Node" invariant forever.

**Verify:** `typecheck` ✓ (client + server) · unit ✓ · offline game untouched (e2e ✓) · `server:dev` boots, logs tick rate ~30 Hz for 60 s without drift, accepts a WS connection and answers a ping.

## M1 — First Connection ("I am walking on the server")

**Goal:** one browser client plays movement online against the authoritative server.

- Protocol v1: `hello` → `welcome` (player entity id, map name, spawn), `input` (per-tick: move flags, yaw, jump — the serialized `ControlState`), `snapshot` (positions/HP of nearby-everything, 10–20 Hz), `event` (sim `CombatEvent`s pass-through).
- Server: session → player entity (`createPlayer`), a per-connection input buffer feeding the sim tick; snapshot broadcaster (all entities whose state changed).
- Client: an **online bootstrap variant** next to `boot()` — connects, loads the same map/world visuals locally (terrain is deterministic/static, so only *entities* replicate), renders replicated entities with the existing views, applies snapshots with simple interpolation. Local player moves by *server echo* in this phase (prediction comes in M4). A minimal "Play Online" entry on the start screen (server URL + name).
- No DB: server state is in-memory, dev login is name-only.

**Verify:** offline suite green · manual: client on machine A, server on machine B (or localhost + throttled network), walk the world, reload and reconnect. e2e: a Playwright test drives the online client against a locally spawned server process.

## M2 — Shared World (the big sim refactor)

**Goal:** N players in one world who can see each other and *play the actual game* — combat, loot, XP — together. This is the highest-risk phase; it touches the sim's core assumption of a single player.

- **Per-player input:** replace the shared injected `input: ControlState` in `createMovementSystem`/`createCombatSystem` with a per-entity `PlayerInput` component (same shape as `ControlState`, filled each tick — from the network on the server, from `InputController` in offline mode). `PlayerControlled` stays as the marker; every system that implicitly assumed "the one player" (enemy aggro target selection, recovery, telemetry, boss AI player checks) is generalized to iterate/select among all `PlayerControlled` entities. **This refactor lands in the offline game too** (it's invisible there — one player) and is covered by unit tests.
- **Multi-player gameplay minimum:** enemy AI picks its target among eligible players (nearest-aggro v1); `LootDrop.owner` is set to the tagging player and pickup is owner-validated; XP to the tagger (sharing rules come in M5); per-player `Target`, death, respawn, vendor/inventory/equip/salvage/reinforce/talent commands validated server-side (they become protocol messages — the sim already exposes them as functions).
- **Client:** render other players using the existing procedural class player-model + nameplates; show their casts/abilities via the existing `AbilityUsed` event flow.
- **Server-owned RNG:** the `0xc0ffee` gameplay RNG lives only on the server now (per-entity `fork()` streams as today). Loot/crit rolls are authoritative.

**Verify:** offline suite green (refactor is behavior-neutral solo) · new unit tests: two `PlayerControlled` entities move/fight/loot independently; aggro picks the right player; loot ownership enforced · manual/e2e: two browser contexts on one server — see each other move, kill the same camp, each gets own loot, levels persist for the session.

## M3 — Accounts + SQLite (persistence moves server-side)

**Goal:** identity + durable storage. Everything the game persists now lives in **SQLite on the server** ([schema](../technical/MMO_ARCHITECTURE.md#6-sqlite-persistence)).

- **Accounts & auth:** username + password (Node `crypto.scrypt`), opaque session tokens (hashed at rest), register/login over the WS (or a tiny HTTP endpoint before upgrade). Optional server-wide join password for friends-only servers (config).
- **SQLite** via `better-sqlite3` (WAL): `accounts`, `sessions`, `characters` (hot columns + full `SaveData` JSON), `world_state` (boss/world flags), `meta` + ordered migrations. The existing `serialize()`/`applySave()` pair is the read/write boundary — the browser `save-store.ts` transport is simply swapped for DB calls server-side.
- **Write-behind autosave:** same triggers as today (equip/loot/level/…, coalesced) + periodic flush + on disconnect + graceful `SIGTERM` flush; one transaction per character flush.
- **Character slots:** the 3-slot roster moves server-side per account; character select screen reads the server list.
- **Local-save import:** a one-time "import my solo character" flow — client exports `SaveData` from IndexedDB, server zod-validates + migrates + creates the character. (The long-promised migration path from [SAVE_SYSTEM_PLAN](../technical/SAVE_SYSTEM_PLAN.md#future-multiplayer-note).)
- Offline mode keeps IndexedDB, untouched.

**Verify:** unit tests on schema/migrations/import (fixture saves) · restart the server → characters, gold, inventory, oathstones, relics, world-boss timers all survive · wrong password rejected, second login invalidates or rejects (pick + test a rule) · offline suite green.

## M4 — Netcode Feel (make it *good* over the internet)

**Goal:** hide latency; survive bad networks; stop trusting the client.

- **Client-side prediction** for the local player's movement (run the same movement+collision code locally per input, tag inputs with sequence numbers) + **server reconciliation** (server acks last-applied seq; client rewinds/replays on mismatch). Remote entities: fixed interpolation delay buffer (~100–150 ms).
- **Reconnect/resume:** token-based resume, entity kept alive briefly on disconnect; clean rejoin otherwise.
- **Validation & limits:** zod-validate every message (already), clamp movement input, per-connection message rate limits, ability/interact requests only pass through the sim's own cooldown/range/resource checks (they already exist — the sim *is* the anti-cheat once it runs server-side), per-IP connection caps.
- Wire-size pass only if needed at this scale: delta snapshots / interest radius / msgpack are the recorded levers (see architecture doc), not defaults.

**Verify:** playable and pleasant at simulated 100–150 ms RTT + 1% loss (Playwright/`tc netem` manual check) · reconnect mid-fight resumes correctly · malformed/flooding clients are dropped without server harm (unit + integration tests).

## M5 — Playing Together (multiplayer game rules)

**Goal:** the *rules* that make shared PvE feel fair — the first real game-design work of the track (respecting [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md): solo viability stays protected).

- **XP sharing:** full XP to everyone who meaningfully participated or is nearby-grouped (v1: flat share to all players within range who damaged/healed; no party system yet).
- **Loot:** per-player drop rolls on shared kills (everyone eligible rolls their own loot — instanced loot, the `LootDrop.owner` payoff) — no ninja-looting possible by construction.
- **Threat:** simple multi-player threat table (damage + healing aggro) replacing nearest-target v1 from M2.
- **World bosses:** HP/telegraph tuning per participant count (v1: HP scales with engaged players; mechanics unchanged); still soloable at solo tuning when alone.
- **Death & assists:** respawn as today; being dead near friends who finish the kill still counts for quest/XP eligibility (v1 rule, tunable).

**Verify:** unit tests for share/tag/threat/scaling math · 2–3 clients: shared kills give fair XP/loot, boss with 3 players is a real (not trivial, not walled) fight, solo boss unchanged.

## M6 — Chat & Presence

**Goal:** the minimum social layer a friends server needs.

- Chat overlay (DOM, follows ADR-002; toggle/focus key via `keybinds.ts`), zone-wide chat v1, system lines (X joined/left, X killed Maelgrith, level-ups), `/who`, `/me`, basic mute; server MOTD; join password UI. Rate-limited + length-capped server-side; chat log table optional (off by default, privacy).

**Verify:** two clients chat; flood is rate-limited; offline mode unaffected.

## M7 — Ops & Hardening (the VPS is a product now)

**Goal:** anyone (the owner) can stand up or update the server in minutes, and it survives reboots, crashes, and disk mishaps. Deliverables are mostly scripts + docs, finalized in [VPS_HOSTING_GUIDE](../technical/VPS_HOSTING_GUIDE.md).

- **Prod pipeline:** `server:build` bundle + client `dist/` served by **Caddy** (auto-TLS) which also proxies `wss://…/ws`; one `deploy.sh` (build → upload → migrate → restart).
- **systemd** unit (auto-restart, journald logs), **UFW** firewall, non-root service user, config file (`server.toml`/env: port, map, join password, admin list, save cadence).
- **Backups:** nightly `sqlite3 .backup` + rotation (+ documented optional Litestream); tested **restore** procedure.
- **Admin commands** (in-chat `/admin …` or CLI socket): kick/ban, broadcast, save-now, shutdown-with-warning, teleport/give behind an admin flag (dev-tools parity).
- **Bot load test:** a headless `ws` client script simulating N moving/fighting players; measure tick time + bandwidth at 20 bots on the target VPS.

**Verify:** fresh VPS → playable HTTPS deploy strictly by following the guide · reboot survives · backup/restore drill passes · 20-bot soak: tick ≤ ~half budget (≤16 ms) and bandwidth within estimates.

## M8 — Friends Beta → **Online Gate**

**Goal:** real humans, real internet, real verdict. Playtest with friends; fix; tune; repeat.

**Online Gate (objective):** ① 3+ players complete a multi-hour session with no server crash, no rollback/dupe/loss of character data; ② reconnect works mid-session; ③ movement/combat feel acceptable at real EU-home latencies; ④ a shared world-boss kill is fair and fun; ⑤ backups + restart drill passed on the live box; ⑥ solo/offline build still passes its whole suite. Subjective feel = owner + friends playtest, as always.

---

## Risks (delta to [RISK_REGISTER](./RISK_REGISTER.md))

| Risk | Mitigation |
|---|---|
| **M2 refactor breaks the solo game** | land per-player input as a pure refactor first (offline-behavior-neutral, full suite green) before any netcode uses it |
| `bootstrap.ts` (927-line composition root) resists an online variant | extract shared world-building helpers as part of M1, don't fork-and-diverge |
| Netcode feel disappoints (rubber-banding) | M4 is a dedicated phase with an explicit latency-simulation bar, not an afterthought |
| Scope creep toward "real MMO" features | the deferred list still stands; anything not in M0–M8 goes back on it |
| Single seeded RNG stream changes solo determinism assumptions in tests | keep test seams (injectable RNG) — server just *owns* the instance |
| Data loss on the VPS | WAL + write-behind flush on signal + nightly backups + restore drill (M7 gate) |
| Cheating among friends | server-authoritative sim covers ~all of it; input clamps + rate limits (M4); we explicitly do **not** build heavier anti-cheat for a friends server |

## AdminTools impact

**None required.** The Map Builder couples to the game only through the versioned `.oathbound-map.json` format (mirrored `map-format.ts`); the server parses maps with the game's own `src/world/map-format.ts`, so maps built in AdminTools work online unchanged. The only standing obligation remains keeping the two format copies in sync. (A future "server admin panel" in AdminTools is possible but explicitly out of scope for M0–M8.)

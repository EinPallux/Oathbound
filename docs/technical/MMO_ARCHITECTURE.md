# MMO Architecture — Authoritative Server, Networking & SQLite

Technical design for **Oathbound Online**: a self-hosted, server-authoritative multiplayer mode with **SQLite** persistence. Phasing/sequence lives in [MMO_ROADMAP](../production/MMO_ROADMAP.md); the hosting how-to in [VPS_HOSTING_GUIDE](./VPS_HOSTING_GUIDE.md); the decision in [ADR-013](../decisions/DECISION_RECORDS.md#adr-013-going-online--authoritative-node-server--sqlite). This doc extends (does not replace) [ARCHITECTURE_PLAN](./ARCHITECTURE_PLAN.md) — every boundary there still holds.

## 1. Big picture

One Node process owns the world. Browsers are dumb-ish terminals: they send **intents**, they render **replicated state**.

```
        Browser client (per player)                     Linux VPS
┌─────────────────────────────────────┐   wss://    ┌───────────────────────────────────────┐
│ InputController → ControlState      │  ────────►  │ Caddy (TLS, static dist/, /ws proxy)  │
│   serialized per tick as `input`    │             │        │                              │
│                                     │             │        ▼                              │
│ Renderer + UI read a REPLICATED     │  ◄────────  │ Node server (single process)          │
│ entity store (snapshots + events)   │  snapshots  │  ┌──────────────────────────────────┐ │
│                                     │  + events   │  │ THE SAME SIM: src/sim + src/core │ │
│ local terrain/scenery from the same │             │  │ + src/world, ticked at 30 Hz     │ │
│ map JSON / seeds (deterministic)    │             │  │ (headless — no three, no DOM)    │ │
└─────────────────────────────────────┘             │  └───────────┬──────────────────────┘ │
                                                    │              │ serialize()/applySave() │
                                                    │              ▼                         │
                                                    │        SQLite (better-sqlite3, WAL)    │
                                                    └───────────────────────────────────────┘
```

Three facts make this cheap for *this* codebase:

1. **The sim already runs headless.** `world.update(DT)` is pure data + systems; unit tests run it under Node today. The server replaces the RAF `GameLoop` (`src/core/loop.ts`) with a drift-corrected 30 Hz timer — the sim itself is untouched.
2. **The intent layer already exists.** Systems consume input via the `ControlState` interface (`src/platform/input.ts`), not the DOM. Serializing `ControlState` per tick *is* the client→server input packet.
3. **The tick deltas already exist.** The sim's `EventBus` events (`src/sim/combat/events.ts`: damage, death, loot, level-up, ability-used, boss-phase, …) are exactly what the server broadcasts; the client's HUD/SFX/toast wiring already consumes them.

**Terrain does not replicate.** The world is deterministic (map JSON from AdminTools, or seeds 1337/99/7777 for the procedural world), so client and server build identical geometry independently; only **entities** (players, enemies, bosses, loot drops, ground AoEs) and **events** go over the wire.

## 2. Repository layout & build

Stay a single repo/package (no monorepo ceremony at friends-scale):

```
/src
  /net/protocol.ts     NEW — isomorphic: message types + zod schemas + (de)serializers
                       rule: no three/DOM/node imports; usable by client AND server
  /sim /core /world    unchanged rule + NEW rule: no Node-only imports either
  /render /game /platform /ui   client-only, as today
/server                NEW — Node-only code
  main.ts              entry: config, db, world boot, wss, tick loop
  tick.ts              30 Hz drift-corrected loop → world.update(DT) + snapshot/flush cadence
  world-boot.ts        build heightfield/colliders/spawns from map JSON or seeds (reuses src/world, src/sim/content)
  net/                 connection lifecycle, session auth, input buffering, snapshot broadcaster
  db/                  sqlite open/pragmas, migrations/, repositories (accounts, characters, world_state)
  auth.ts              scrypt hashing, session tokens
  admin.ts             admin commands
  config.ts            server.toml / env parsing
/tests/unit            + server sim-smoke, protocol, db/migration, multiplayer-rules tests (Vitest, node env — as today)
```

- **Dependencies:** runtime `ws`, `better-sqlite3`, `zod` (server); `zod` is also used by the client (protocol + save import). Dev: `tsx` (dev server), `esbuild` (prod bundle; `better-sqlite3` marked external).
- **Scripts:** `server:dev` (tsx watch), `server:build` (esbuild → `dist-server/`), `server:start` (node). Client build/deploy unchanged; in production Caddy serves the same `dist/` the Vercel build produces.
- **TypeScript:** keep the strict root config; `server/tsconfig.json` extends it with Node types. `verbatimModuleSyntax` stays (mind `import type` in shared modules).

## 3. Server runtime

- **Tick loop:** fixed 30 Hz (`DT = 1/30`, same constant), drift-corrected `setTimeout` loop (schedule by absolute next-tick time, catch up bounded by the existing `MAX_FRAME` idea). Per tick: ① drain+apply queued client messages (inputs, commands) → per-player `PlayerInput` components ② `world.update(DT)` ③ collect sim events → per-client event queues ④ every Nth tick (10–15 Hz) build+send snapshots ⑤ periodic persistence flush.
- **One world instance, one process.** No workers/sharding at this scale; the sim comfortably fits one core (90 enemies + ≤20 players, ECS-lite maps). Recorded lever if it ever hurts: AI throttling by player distance already exists conceptually in the plan docs.
- **Command messages** (equip/salvage/sell/reinforce/talent-pick/vendor/pickup/travel): thin protocol wrappers over the existing pure sim functions (`inventory.ts`, `salvage.ts`, `vendor.ts`, `travel.ts`, `pickUpNearest`, …), executed inside the tick, server-validated by construction (range/cost/cooldown checks live in those functions or gain them).
- **RNG:** the gameplay `Rng(0xc0ffee)` instance lives only on the server (per-entity `fork()` streams as today) → authoritative loot/crit/AI rolls. Seed becomes a config value; tests keep injecting their own.

## 4. Protocol (`src/net/protocol.ts`)

- **Transport:** one WebSocket per client, `wss://` via Caddy. **Encoding v1: JSON** — debuggable, and at ≤20 players the math is trivial (≈25 entities changing × ~40 B × 15 Hz ≈ **15–40 kbit/s per client**; even ×20 clients is nothing on a VPS port). Recorded levers, only if measurements demand: delta-vs-acked snapshots, interest radius, msgpack/CBOR, quantized positions.
- **Every message zod-validated on receipt, both directions.** Unknown/invalid → count + drop; repeat offenders disconnected.

| Dir | Message | Payload (sketch) |
|---|---|---|
| C→S | `hello` | protocol version, session token (or register/login/import first) |
| S→C | `welcome` | your entityId, map name/hash + seeds, tick number, tick/snapshot rates, full snapshot, character SaveData |
| C→S | `input` | `seq`, move flags (f/b/l/r), `yaw`, jump, queued ability slots, interact, target-cycle, click-target entityId — the serialized `ControlState`, ≤30 Hz |
| C→S | `cmd` | equip/salvage/sell/reinforce/talent/pickup/travel/respawn… (discriminated union) |
| S→C | `snapshot` | tick, `lastInputSeq` (for reconciliation), changed entities: id, kind, x, z, yaw, hp/maxHp, cast/anim state, name/class/level for players |
| S→C | `events` | batched sim `CombatEvent`s (damage numbers, deaths, loot toasts, level-ups, boss phases…) |
| S→C | `roster`/`chat`/`system` | join/leave, chat lines, MOTD, admin broadcast |
| C→S | `chat` | channel + text (server-side rate/length limits) |

- **Client entity store:** the online client keeps a lightweight replicated store (id → interpolated state) that the existing render views read — same read-only contract renderers already honor. Remote entities render at an interpolation delay (~100–150 ms buffer); the local player uses prediction (below).
- **Prediction & reconciliation (M4):** client applies its own inputs immediately through the *same* shared movement+collision code (`src/sim/systems/movement.ts` + `collision.ts` are importable in the browser — they already are), stamps `seq`; on each snapshot, rewind to server state and replay unacked inputs. Combat/abilities are **not** predicted (cast bars tolerate a RTT).

## 5. Multiplayer inside the sim (the M2 refactor)

The one structural change to `src/sim`: **"the player" becomes "a player."**

- **`PlayerInput` component** (new, in `components.ts`): a plain-data snapshot of `ControlState` for this tick (move flags, yaw, and the consumed edge-triggers). `createMovementSystem`/`createCombatSystem` stop taking `input` as a dependency and instead read each `PlayerControlled` entity's `PlayerInput`. Offline: a tiny adapter copies `InputController` → the single player's `PlayerInput` each tick (behavior-identical). Server: the network layer fills it from `input` packets. Camera `pitch`/`dist` stay client-only; `yaw` rides in the packet because movement is camera-relative.
- **Generalize single-player assumptions:** enemy/boss AI target selection (nearest eligible player v1 → threat table in M5), recovery/death/respawn (already iterate), telemetry, any `query(C.PlayerControlled)[0]`-style code.
- **Loot:** `LootDrop.owner` (the seam planted for exactly this) = tagging player; `pickUpNearest` validates owner; M5 upgrades shared kills to **per-player instanced rolls** (each eligible player gets an independent drop roll from the same table — no contested loot).
- **XP/quests:** tagger gets full XP (M2) → nearby-participant sharing (M5). Quest progress is per-character (it already lives in SaveData).
- **Numbers stay solo-anchored:** no combat re-tuning except world-boss HP scaling by engaged player count (M5); [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md) remains law.

## 6. SQLite persistence

**Engine:** `better-sqlite3` (synchronous, in-process, fastest option for a single-process game server; transactions are trivial). Pragmas: `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`. The DB is a single file (e.g. `/var/lib/oathbound/oathbound.db`), backed up nightly ([guide §backups](./VPS_HOSTING_GUIDE.md#7-backups)).

**Design stance — hybrid rows:** `SaveData` (`src/sim/save.ts`) is already the canonical, versioned, soon-zod-validated character document, with stable ids everywhere (item `uid` is save-stable by design). So a character row = **hot queryable columns** (identity, class, level, position, gold — what the server/roster/admin queries) + **the full `SaveData` as a JSON column** (inventory, equipment, talent choices, oathstones, relics, pity, quests). This reuses `serialize()`/`applySave()` unchanged as the exact DB boundary and avoids prematurely normalizing items — a dedicated `items` table becomes worthwhile only when cross-character features (trading/stash) exist, which stay deferred. (SQLite's `json_*` functions still allow ad-hoc queries into the blob for admin/analytics.)

### Schema v1

```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);          -- schema_version, created_at
CREATE TABLE migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash BLOB NOT NULL, pass_salt BLOB NOT NULL,                     -- node:crypto scrypt
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, last_login_at INTEGER
);

CREATE TABLE sessions (
  token_hash BLOB PRIMARY KEY,                                          -- sha-256 of the opaque token
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);

CREATE TABLE characters (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL,                                                -- 0..2, roster parity with today
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  class_id TEXT NOT NULL,                                               -- 'warrior'|'hunter'|'priest'
  level INTEGER NOT NULL, gold INTEGER NOT NULL,
  pos_x REAL NOT NULL, pos_z REAL NOT NULL,
  save_json TEXT NOT NULL,                                              -- full versioned SaveData
  save_schema_version INTEGER NOT NULL,
  playtime_s INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE (account_id, slot)
);

CREATE TABLE world_state (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
  -- world-boss respawn deadlines, world-event flags — cross-restart world memory
```

- **Migrations:** ordered files in `server/db/migrations/`, applied transactionally at boot, recorded in `migrations`. Inside `save_json`, the *existing* `SaveData.schemaVersion` + pure-function migration approach from [SAVE_SYSTEM_PLAN](./SAVE_SYSTEM_PLAN.md) applies unchanged — one migration discipline for rows, one for documents.
- **Write path (write-behind):** gameplay marks characters dirty (same triggers as today's `autosave()`: equip, loot, level, talent, vendor, oathstone, quest, …); a flusher writes dirty characters every 30–60 s, on player disconnect, and on `SIGTERM`/`SIGINT` (graceful shutdown drains everything). Each flush = one transaction. Crash-loss window ≤ the flush interval; WAL keeps the file consistent.
- **What lives where (explicit):** SQLite = accounts, sessions, characters (all player data incl. inventory/equipment/progress/discoveries), dynamic world flags. Disk files = map JSON, content data, config (already versioned in git). Client localStorage = device preferences only (settings, keybinds — they're per-device by nature, per [SAVE_SYSTEM_PLAN](./SAVE_SYSTEM_PLAN.md)). IndexedDB = offline-mode saves only, plus the one-time import source.
- **Import:** client uploads its IndexedDB `SaveData` → zod-validate + migrate → insert as a new character (name chosen at import). One-way, once per slot.

## 7. Security model (friends-scale, honest)

- The client is **untrusted** from M1 on — but because the whole sim runs server-side, *most anti-cheat is free*: cooldowns, resource costs, range/LoS, movement integration, loot rolls, XP are all computed on the server. A hacked client can at most send well-formed intents.
- Remaining input surface, all handled in M4: zod-validate everything; clamp move flags/yaw; rate-limit messages per connection; per-IP connection caps; chat limits; sessions expire; passwords scrypt-hashed; tokens hashed at rest; TLS everywhere (Caddy).
- **Not built** (out of scope for a friends server, recorded): movement-plausibility heuristics beyond clamps, replay/ban infrastructure, encryption-level tamper detection, DDoS mitigation beyond the provider's default.

## 8. Offline mode & the two builds

- The Vercel/static build keeps working exactly as today (single-player, IndexedDB, zero networking) — the per-player-input refactor is invisible to it. Online mode is an additive entry point (`Play Online`) in the same client bundle.
- E2E strategy: the existing offline Playwright suite stays; online e2e spins up the real server on a random port and drives 1–2 browser contexts against it (Vitest for protocol/db units).

## 9. AdminTools

No changes required. Coupling remains the mirrored `map-format.ts` (`MAP_FORMAT_VERSION`) only; the server loads `.oathbound-map.json` through the game's own `src/world/map-format.ts` (`normalizeMap`/`unpackHeights` are pure and Node-safe). Maps built in the Map Builder are deployed to the server as static files (same `public/maps/` convention) and named in server config.

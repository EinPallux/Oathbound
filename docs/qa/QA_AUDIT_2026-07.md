# Oathbound QA Audit — July 2026 (pre-M8 production hardening)

Read-only audit of the whole codebase (gameplay sim, server/netcode, client/rendering, repo hygiene) after M0–M7. **No code was changed by this audit.** Findings are prioritized for a follow-up fix pass. Every item was verified against the actual source (file:line given); a "checked & FINE" list at the end records suspicions that turned out clean so they aren't re-investigated.

**Legend:** severity = impact × likelihood on a friends-scale VPS running M8. `sim` / `server` / `client` / `hygiene` tags the audit stream that found it.

---

## VERY HIGH — fix before any friends beta (crash, data loss, or "can't actually play")

### VH1 · Server process dies on an unguarded damage source `[server + sim]`
- **Where:** `src/sim/combat/apply.ts:44-46` (`world.get<Offense>(source, C.Offense)!` and `def`/`h` non-null assertions) + no crash guard in `server/clock.ts:65` (tick loop) or `server/main.ts` (no `uncaughtException`/`unhandledRejection`).
- **What:** `applyDamage` assumes the attacker entity still exists. `heal.ts:19` guards the same lookup (`if (!off || !h …) return`); `apply.ts` does not.
- **Repro:** Hunter places a Snare Trap (30 s TTL) → disconnects → after the 20 s reconnect-grace the player entity is reaped → an enemy walks into the still-live trap → `trap.ts:39` calls `applyDamage(world, trap.source, …)` with a destroyed source → `TypeError` inside `world.update()` → escapes the `setTimeout` tick callback → **whole server exits, every player disconnected.** `Restart=always` then crash-loops on the same reproducible input. Projectiles and ground-AoE share this entry point (delayed damage after the caster is gone).
- **Fix direction:** guard `off`/`def`/`h` in `apply.ts` (mirror `heal.ts`); independently, wrap `game.step()` in try/catch and add top-level `process.on('uncaughtException'/'unhandledRejection')` so one bad tick can't kill everyone.

### VH2 · Per-IP connection cap collapses to ONE global counter behind Caddy → server hard-caps at 8 total players `[server]`
- **Where:** `server/net.ts:31-36` uses `req.socket.remoteAddress`; production topology proxies through Caddy (`deploy/Caddyfile:19` → `127.0.0.1:8080`).
- **What:** Behind the reverse proxy every real player's peer address is `127.0.0.1`. `X-Forwarded-For` is never read. So the `maxConnPerIp` (default **8**) counts *all* players against one bucket.
- **Impact:** the **9th player to join is rejected** with "too many connections" — on a game whose entire premise is "played with friends." Also nullifies the anti-DoS intent (all attackers + players share one counter).
- **Fix direction:** read `X-Forwarded-For` (trusting only the local proxy hop), or key the cap on the forwarded client IP; raise/rename the default now that it's a real per-client cap. Caddy passes `X-Forwarded-For` by default via `reverse_proxy`.

### VH3 · Unauthenticated scrypt DoS starves the tick loop `[server]`
- **Where:** `server/auth.ts:17,23` (`scryptSync`, default N=16384, ~15–40 ms blocking) run on the **same thread as the sim tick**; the per-connection rate limiter (`net.ts:18-19`, capacity 60, refill 45/s) applies one uniform budget to *all* message types.
- **What:** one unauthenticated socket sending ~45 `register`/s forces ~45 blocking scrypt hashes/s — more than a CPU-second of blocking work per wall-second — stalling `game.step()` for everyone (rubber-banding, disconnects). `register` also creates unbounded accounts. A known username makes `login` equally expensive.
- **Fix direction:** a much stricter, separate budget for auth messages (e.g. a few/min per connection + per-IP); consider `scrypt` async (non-blocking) so hashing never blocks the tick; cap accounts / require the join-password before hashing.

### VH4 · `deleteChar` while in-world orphans a live entity and can overwrite a brand-new character `[server + sim]`
- **Where:** `server/net.ts:149,157` deliberately exempts `deleteChar` from the `already_in_world` guard; `server/game.ts:149-151` only runs `DELETE FROM characters` — it does not evict the live entity, clear `active`, or drop the orphan.
- **Repro:** play slot 0 → `/deleteChar 0` (DB row gone, entity still live) → disconnect (→ orphan keyed `acct:0`) → reconnect, `createChar` slot 0 (allowed; writes a new row) → the old orphan's grace timer fires `saveCharacter(acct,0,…)` and **overwrites the new character with the deleted one's state.** Best case, the delete silently discards the session's progress.
- **Fix direction:** forbid `deleteChar` on an in-world/orphaned slot (return an error), or fully evict+cancel the orphan on delete.

### VH5 · Imported saves aren't value-validated → NaN position poisons the shared world; absurd stats enter the economy `[server + sim]`
- **Where:** `server/game.ts:507-517` (`validateSave` checks only `typeof === 'number'`, which is **true for `NaN`**); `src/net/protocol.ts:71` (`save: z.unknown()`); no `maxPayload` on the server (`main.ts:26`) so the `ws` 100 MiB default applies; `applySave` writes values straight onto components (`save.ts:98,104,110`).
- **What:** an authenticated client can `importChar` with `position.x = NaN` (the exact hazard `yaw.finite()` guards for yaw — but position has no guard), `level = 1e9`, `gold = -1`, or hand-crafted items/affixes. A NaN Transform propagates through `q(NaN)` in `snapshot.ts:12` into **everyone's** broadcast and breaks distance math (enemies never aggro, etc.). No size cap means multi-MB blobs get `JSON.stringify`'d into the DB per slot.
- **Fix direction:** real schema validation on import (finite + range/length caps on position, level, gold, inventory/equipment, affixes); add `maxPayload` to `WebSocketServer` and a serialized-size cap before `createCharacter`.

---

## HIGH — fix during M8 (multiplayer correctness, leaks, player-facing bugs)

### H1 · Boss heavy attack (ground-AoE) only damages the first player in the world `[sim]`
`src/sim/systems/ground-aoe.ts:59-64` — `tickPlayer` takes the first `PlayerControlled` result and breaks. The boss telegraphs correctly at its top-threat target's feet (`boss-ai.ts:128`) but only player #1 can ever be hit: the real target stands in the pool and takes nothing, while player #1 eats telegraphs aimed at others. Bosses effectively can't hit anyone but one player. → damage *every* player inside the radius.

### H2 · Oathstones / respawn-binding only work for the first player `[sim]`
`src/sim/systems/waypoint.ts:19-24` grabs the first `PlayerControlled` entity and returns. On a server only one player can ever attune Oathstones or rebind respawn; everyone else stays bound to spawn and gets no activation events. (Unit test only covers one player, so CI is blind to it.) → iterate all players.

### H3 · World-boss HP scaling never resets on leash `[sim]`
`src/sim/systems/boss-ai.ts:55-60,105-117` resets `scaledForPlayers`/`h.max` only on death; the leash-reset path (`enemy-ai.ts:230-238`) knows nothing about `Boss`. A 3-player pull scales HP ×2.2; if they wipe/run, the boss leashes and heals to the *scaled* max, so the next solo puller faces a 2.2× boss forever, and a later bigger raid never re-scales up. → reset boss scaling on leash, not just death.

### H4 · Oathstone activation is world-global and leaks across characters/accounts `[sim]`
`src/sim/save.ts:65-69` (serialize) + `:135-140` (applySave). Activation is per-character intent stored in a **world-global** component: `serialize` snapshots *all* activated stones in the shared world into whichever character is flushing, and `applySave` re-activates world stones from any joining character's save. Veteran A's unlocks bleed into newbie B's save on B's next autosave — B can then fast-travel everywhere permanently. → scope activation per player (own component / per-save set), not the shared world.

### H5 · Quest progress silently wiped on server flush and on `Game.save()` `[sim + client]`
Two paths, same root cause — `serialize()` omits `SaveData.quests` (`src/sim/save.ts:71-86`), which is injected by the game layer:
- **Server:** `flushEntity` (`game.ts:287`) calls bare `serialize()`. An offline save imported *with* quest progress has it wiped by the first autosave. (`src/game/bootstrap.ts:624` injects quests only in the browser autosave path.)
- **Client:** `Game.save()` (`bootstrap.ts:889`) also omits `data.quests` that `autosave()` sets (`623-625`). Exposed on `window.__oathbound` and used by e2e (`boot.spec.ts:418,457`) → any save through it erases active + completed quests on next load.

### H6 · Loot beams and trap rings never dispose their GPU resources `[client]`
`src/render/loot-view.ts:50-54` and `src/render/trap-view.ts:41-45` allocate a fresh geometry+material per drop/trap but the removal path only calls `scene.remove(m)` — no `.dispose()`. Loot drops constantly and Hunters place traps continuously, so a long session accumulates orphaned GPU buffers until FPS degrades / the WebGL context is lost. `ground-aoe-view.ts:64-67` shows the correct 3-line pattern to copy.

### H7 · Held keys stick on window blur → character auto-runs forever `[client]`
`src/platform/input.ts` has no `blur`/`visibilitychange` handler to clear key state. Alt-Tab (or any OS focus steal) while holding W eats the keyup; the character auto-runs until the player taps W again. Affects offline *and* online (the stuck input is sent to the server every tick). Pointer-lock loss is handled for the mouse but not for the keyboard. → reset held keys on blur/visibility change.

---

## MEDIUM — quality, robustness, and pre-production polish

- **M-a · Camera occlusion raycast scans every terrain triangle each frame** `[client]` — `src/render/camera-rig.ts:40` `ray.intersectObjects([terrain])` with a >100k-tri, `frustumCulled=false`, no-BVH mesh; camera is inside the bounding sphere so Three falls through to a full per-triangle scan. Likely the single biggest hidden per-frame CPU cost. → heightfield-analytic camera collision or a BVH.
- **M-b · `sessions` table grows unbounded** `[server]` — `db.ts:154-167`: every login/register/resume inserts a 30-day row; no logout, no purge, no per-account cap (grep confirms no `DELETE FROM sessions`). `findSessionAccount` filters expired rows at read time but never deletes them. → periodic purge + optional per-account session cap.
- **M-c · `enterImport` spawns the entity before the DB write** `[server + sim]` — `game.ts:204-219`: on a duplicate-name import, `createCharacter` throws *after* `spawn()`, and the catch's `leave(ws)` parks a 20 s phantom orphan (visible to others) for a player who only saw an error. `enterNew` has the correct order — mirror it (write row, then attach).
- **M-d · Online client has no HUD** `[client]` — `online.ts` shows no health/resource bars, hotbar/cooldowns, target frame, damage numbers, minimap, or loot/inventory UI, yet the status line advertises "1-6 abilities · F loot" (`online.ts:463`). A player can be dying with zero feedback. Largest confusion risk in the newest code; likely known scaffolding but must close before friends actually play.
- **M-e · Online client assumes `selfId` is in every snapshot** `[client]` — `online.ts:328-333` prunes any replica missing from a snapshot (including the local player's mesh), and `pending` in `prediction.ts` only drains in `reconcile()` (runs only when `self` present). If the server ever omits the local entity (death/interest-cull/grace quirk), the player mesh vanishes and the prediction buffer grows at tick rate. → guard for self-absence.
- **M-f · Login timing oracle enumerates usernames** `[server]` — `game.ts:120-121`: unknown users return instantly, known users incur full scrypt; the latency delta leaks which usernames exist. → constant-time path (hash a dummy on miss).
- **M-g · `Game.stop()` / `bootOnline().stop()` are incomplete teardowns** `[client]` — `bootstrap.ts:890-898` and `online.ts:536-542` don't dispose the renderer/terrain/replicas or remove several window listeners; only masked today because logout does `location.reload()` and `main.ts:75` discards the online `stop` handle (so it's never even called). A future reload-free logout leaks an entire world per relog. → complete the teardown or leave an explicit comment tying it to the reload.
- **M-h · Version + README badly out of date** `[hygiene]` — `package.json` is still `0.7.2-INDEV` across all eight shipped M-phases; `README.md` claims "no account, no backend, no database … local single-player" and forbids implementing networking; `AGENTS.md` header says `0.7.1-INDEV`, "deployable to Vercel with no backend," an ancient branch name, and a repo map that omits `/server`, `/deploy`, `/src/net`; `index.html` boot tag says "local single-player." `docs/production/MMO_ROADMAP.md:38` suggests the `0.8.0-ONLINE.x` scheme. → rewrite README, sync one version number across package.json/AGENTS/index.html, bump to the documented scheme.
- **M-i · Stale technical/planning docs lack supersession banners** `[hygiene]` — `docs/technical/SAVE_SYSTEM_PLAN.md` ("no remote database"), `VERCEL_DEPLOYMENT_PLAN.md` ("no backend/accounts"), and `FUTURE_MULTIPLAYER_BOUNDARIES.md` describe a pre-MMO world with no ADR-013 banner (other docs got one). → add banners or fold into the current deployment/persistence docs.
- **M-j · 9 env-limited e2e failures aren't machine-marked** `[hygiene]` — tracked only as CHANGELOG prose; a fresh CI run shows 9 red with no annotation. → env-gated `test.fixme`/tag so "expected-fail on headless GL" is explicit.

---

## LOW — correctness edges, micro-perf, and small hardening

- **Dead players can act during the 2 s respawn window** `[sim]` — neither `movement.ts:42` nor `combat.ts:82` checks the player's own `Health`; a dead player can walk/fire until `recovery.ts` respawns (RESPAWN_DELAY=2).
- **Per-tick allocations in hot loops** `[sim + client]` — `combat.ts:101` rebuilds the ability kit every player every tick (memoizable per class/choices/level); `enemy-ai.ts:75` + `boss-ai.ts:45` allocate a `new Set` per tick; `hud.ts:184,233,293` rebuild kit/signature/innerHTML every frame. 30 Hz / 60 fps GC churn.
- **`recovery.ts:41` `deadTimers` + `telemetry.ts:44` `firstHit` map leaks** `[sim]` — entries keyed by entity are only deleted on respawn/kill; an entity reaped while dead (or a non-killing leash) leaves a permanent stale entry. Telemetry is offline-only today, so its impact is future-facing; it also doesn't filter by player (counters mix players).
- **Protocol fields unbounded** `[server]` — `protocol.ts:93,102`: `seq` and `ability` have no range. `seq = MAX_SAFE_INTEGER` makes `net-input.ts:32` ignore all later inputs (self-harm); `ability` isn't consumed server-side yet but should get `.min(0).max(n)` before combat is wired.
- **`PredictedPlayer.pending` unbounded if snapshots stop** `[client/net]` — `prediction.ts:88,115` only drains on ack advance; a silent server makes the client buffer + replay indefinitely. → cap by age/length.
- **Dead boss stays visible** `[client]` — `online.ts:326` hides dead state only for `kind === 'enemy'`; a dead boss remains standing.
- **Chat send bypasses the guarded `send()`** `[client]` — `online.ts:379` calls `ws.send(...)` directly without the `readyState === OPEN` check used everywhere else; a message typed during a drop is silently lost or throws.
- **Ability/jump edge-triggers queue while paused** `[client]` — `bootstrap.ts:666` skips `world.update` but the input queues keep filling; the queued ability fires the instant you unpause.
- **`hud.ts:27` re-declares `PICKUP_RADIUS = 2.5`** `[sim/client]` instead of importing the exported one from `loot.ts:23` — silent drift risk between the interact prompt and actual pickup range.
- **`.gitignore` gaps** `[hygiene]` — add generic `*.db`/`*.db-*` (an ad-hoc `OATHBOUND_DB=./dev.db` run would be committable) and `.env`/`server.env` (join-password insurance).
- **`vercel.json` `buildCommand: "vite build"` skips the typecheck** that `npm run build` includes `[hygiene]` — if Vercel is still a live target, use `npm run build`; if abandoned for the VPS, delete it (and the Vercel plan doc). *Owner decision.*
- **`CREDITS.md` has no audio attribution** `[hygiene]` — `public/bgm.mp3` (7.5 MB) is shipped and used (`music.ts:8`) but uncredited; add attribution/license if third-party.

---

## FILE & REPO CLEANUP (the owner explicitly asked for this)

Ordered by payoff. All verified with repo-wide grep for importers/references.

1. **`public/new_assets/` — 12 PNGs, ~21 MB, DELETE (or move out of `public/`)** — zero runtime loaders (grep finds only two code *comments* in `presets.ts:61,665` and a CHANGELOG line). Because Vite copies `public/` verbatim, these are ~60% of every `dist/` and get rsync'd to the VPS on every deploy. They were one-time reference art, already voxelised into `presets.ts`. If worth keeping, move to `docs/assets/reference/` (untracked or docs, not `public/`) and update the two comments.
2. **`QuestSetup.md` + `ImportInfo.md` (repo root) — MOVE to `docs/guides/` and de-stale** — real authoring guides (map import, quest/dialog) not duplicated in `docs/`, so keep them; but both reference a bundled `sample.oathbound-map.json` / `?map=sample` that no longer exists (only `talar` ships), and `ImportInfo.md` frames deployment as Vercel-only. Fix on move.
3. **`src/sim/factory.ts:140 createWisp` — DELETE** — never imported anywhere (repo-wide grep). (`createBloomhusk`/`createReaver` are test-used; keep.)
4. **`GameState.Boot` / `GameState.Menu` (`src/game/states.ts:5-6`) — remove or wire up** — unreferenced; only `Playing`/`Paused` used. Menu flow arrived via `app.ts` without this enum.
5. **`src/devtools/perf-overlay.ts` — gate behind DEV/query-param** — currently constructed and visible in *production* (`bootstrap.ts:208`) despite its header claiming it's excluded from prod builds. (e2e asserts on it at `boot.spec.ts:52`, so gate via `import.meta.env.DEV` or a `?perf` param, not deletion.)
6. **Un-export module-local consts** — `LOOT_TTL` (`rewards.ts:30`), `MOUNT_SPEED_MULT` (`movement.ts:23`), `EMPTY_RELIC_MODS` (`relics.ts:113`) are exported but only used in their own module.
7. **`src/main.ts:75`** discards the `bootOnline().stop` handle → `online.ts:536-542` is dead today. Store it (ties into the M-g teardown fix) or drop the return.

**Verified clean / do NOT touch:** `src/world/presets.ts` (1355 lines — fully live: `custom-map.ts`, `asset-geometry.ts`, `settings.ts`, validated by tests); `public/bgm.mp3` (used); all `package.json` deps + scripts (each import verified); all `src/render/*` files have importers; `null-input.ts`, `ui/icons.ts`, `asset-geometry.ts` used; tsconfig/vite/playwright wiring correct; no TODO/FIXME/commented-out blocks or `console.log` spam in `src/` (unusually clean); working tree has no untracked scratch files; docs already carrying ADR-013 supersession banners are fine.

---

## Cross-cutting themes (root causes worth fixing structurally)

- **"First player" pattern (`query(...)[0]`) is the recurring multiplayer bug** — VH-adjacent H1, H2, and the general shape behind several. A grep for `PlayerControlled` systems that take the first result would surface any remaining instances; the fix is always "iterate all players."
- **`serialize()` is the save boundary but is used inconsistently** — the browser injects `quests` and the server doesn't (H5), and world-global state leaks into per-character saves (H4). The serialize/applySave contract needs one owner and per-player scoping.
- **The import path is a live trust boundary with only placeholder validation** (VH5) — `save.ts:3-5` acknowledges zod hardening was deferred, but `importChar` is exploitable *now*.
- **The server shares one thread for tick + auth + I/O with no crash guard** — VH1 and VH3 both stem from this; a try/catch around the tick + async/off-thread scrypt + top-level handlers harden the whole class.

---

*Generated by a 4-stream read-only audit (sim/core/world, server/net/deploy, client/render/platform, repo hygiene). No files other than this report were created or modified.*

# Changelog

Development proceeds **one phase at a time** (see [docs/production/VERSION_ROADMAP.md](./docs/production/VERSION_ROADMAP.md)).
Each entry is an **independently testable build**. After each phase, work pauses for testing before the next begins.

---

## M2 "Shared World" — N players move, fight & loot together (per-player sim refactor)
**Goal (see [docs/production/MMO_ROADMAP.md](./docs/production/MMO_ROADMAP.md)):** the big structural phase — make the single-player sim genuinely multi-player so several friends share one world. Landed **behaviour-neutral for the offline game** (it just has one player).
- **Keystone: per-player input.** New `PlayerInput` component (a `ControlState` per entity). The movement + combat systems no longer read one injected `input`; they read each `PlayerControlled` entity's own `PlayerInput` (falling back to an optional `deps.input` for focused unit tests). New `addPlayer(world, field, input, …)` attaches it; `createSimWorld`'s primary player is now optional (a server omits it and adds one player per connection). So N players each drive their own entity through the **unchanged** movement/combat code.
- **Generalized the single-player assumptions:** enemy AI and boss AI now target the **nearest living player** per enemy (identical with one player); recovery already iterated per player. Kill rewards were already keyed on the `killer` entity, so **XP + loot ownership are per-player for free**.
- **Owner-instanced loot:** gold auto-collects to a drop's `owner`, and `pickUpNearest(world, player)` refuses a drop owned by a *different* live player (unowned/orphaned drops stay free) — you can't ninja another player's loot.
- **Multiplayer server** (`server/game.ts`): one **player entity per connection**, each with its own `NetworkControlState`; `hello`→`welcome` returns *that connection's* entity id; input routes to the right player; disconnect destroys the player; server-side interact (F) runs `pickUpNearest` for that player. Snapshots already broadcast all players, so everyone sees everyone.
- **Fighting over the wire:** the `input` message gained `ability`/`interact`/`cycle` (optional); `NetworkControlState` buffers them; the online client sends them. Abilities auto-acquire a target in the facing cone, so networked players fight by facing an enemy and pressing an ability.
- **Deferred (documented):** an `events` channel for damage numbers / cast visuals / toasts (combat is already *visible* via HP + enemy state in snapshots), player **nameplates** (names aren't replicated yet), inventory/vendor/equip/salvage/talent **commands** over the wire, and **XP sharing** rules (M5 — M2 gives XP to the tagger, which was already correct).

**Verified:** `typecheck` ✓ (client + server) · `npm test` → **350/350** ✓ (new `multiplayer` test: two players move independently, an enemy aggros the nearest and leaves the far one untouched, loot is owner-instanced) · `build` ✓ (offline `index` bundle unchanged; `online` chunk intact) · `server:build` ✓. **Live two-client end-to-end:** two `ws` clients on one server got **distinct entities (10, 11)**, drove different directions (moved 17.8 m and 19.4 m), and **each saw the other** in its snapshots at a different position. **e2e: parity with baseline** — the same 9 environment-limited tests fail on this and pre-M2 code, the other 9 pass; the core-system refactors add **no** new failures (offline behaviour-neutral). *(The browser client's live multiplayer feel is the owner's playtest — run the server, open two tabs with `?server=127.0.0.1:8080`.)* **Next phase → M3 "Accounts + SQLite"** (real accounts + durable server-side persistence) — confirm with the owner.

---

## M1 "First Connection" — movement over the wire, server-authoritative
**Goal (see [docs/production/MMO_ROADMAP.md](./docs/production/MMO_ROADMAP.md)):** one browser client plays *movement* online against the authoritative server — the client sends input, the server's sim owns the truth, snapshots come back and are rendered. The client is now **untrusted**: it sends intents, never outcomes.
- **Protocol grew** (`src/net/protocol.ts`): `input` (C→S — a per-tick serialized ControlState: move flags + camera yaw + jump, with a monotonic `seq`) and `snapshot` (S→C — `tick`, `ack` = last input seq applied, and an array of replicated entities: id, kind, x/z/yaw, hp/maxHp, enemy state). Still zod-validated both ways.
- **Isomorphic net core** (unit-tested, no three/DOM/Node): `src/net/net-input.ts` — `NetworkControlState` implements the same `ControlState` the keyboard does, folding `input` packets in (older/duplicate seqs ignored) so the **movement system drives the player from network input with zero sim changes**; `src/net/snapshot.ts` — `buildSnapshot(world)` reads the ECS and emits every positioned gameplay entity.
- **Authoritative server loop** (`server/game.ts` `GameServer`): owns the world + connected clients + the network input; each tick advances the sim (reading the latest input) and **broadcasts a snapshot at `snapshotHz` (15 Hz)**; new clients get an immediate snapshot after `welcome`. `net.ts` routes `input`→game and registers/*unregisters* connections; `world-boot.ts` now takes the input source; `main.ts` wires it. **The sim is the anti-cheat** — cooldowns/collision/movement integration all run server-side.
- **Minimal browser online client** (`src/game/online.ts`): connects, sends the local `InputController`'s intent every tick, and renders the replicated world from snapshots with interpolation — **no local simulation** (the local player moves by server echo; prediction is M4). Reuses the game's `Renderer`/`CameraRig`/`Sky` + terrain mesh; entities are simple stand-in meshes; a small status line shows connection state. Entry: **`?server=<ws-url|host>`** in `main.ts` (lazily code-split — the offline single-player build is byte-for-byte unaffected; `?server` absent → the normal game). HUD/inventory/combat UI/audio come as online is fleshed out (M2/M5). Events channel (damage numbers/toasts) deferred to M2.

**Verified:** `typecheck` ✓ (client + server) · `npm test` → **347/347** ✓ (new `net-movement` test: a forward `input` packet moves the authoritative player, the snapshot reflects it with the right `ack`, releasing input halts, and stale seqs are ignored) · `build` ✓ (a separate `online` chunk splits out; offline `index` bundle unchanged) · `server:build` ✓. **Live end-to-end:** a real `ws` client connected to the running server, drove `forward`, and over 2.5 s received **39 snapshots (~15 Hz)** showing the player **move 16.3 m** — server-authoritative networked movement confirmed. **e2e: parity with baseline** — the same 9 environment-limited gameplay tests fail on this and pre-M1 code (headless-render limit), the offline boot path is intact, no new failures. *(The browser online client's live feel is the owner's playtest — browser e2e is unreliable in this container; the server/protocol core is fully verified headlessly.)* **Next phase → M2 "Shared World"** (per-player sim refactor: N players see & fight together) — confirm with the owner.

---

## M0 "Server Scaffold" — the sim ticks headless on Node + a WebSocket server
**Goal (first MMO phase, see [docs/production/MMO_ROADMAP.md](./docs/production/MMO_ROADMAP.md)):** stand up an authoritative Node server that runs the **existing** simulation headless at 30 Hz and accepts WebSocket connections — no gameplay over the wire yet. Proves the sim/render seam pays off and gives M1 a foundation.
- **Shared, render-free sim boot** (`src/sim/boot/sim-world.ts`, `createSimWorld`): the ECS + entity set (player → enemies → bosses → oathstones → vendor, fixed order) + the 12-system pipeline, extracted verbatim from `bootstrap.ts` so the browser and the server assemble the **identical** sim and can never drift. `bootstrap.ts` now calls it — a **behaviour-neutral** refactor (offline game unchanged; proven by e2e parity below).
- **`/server` (Node-only):** `main.ts` (entry), `clock.ts` (drift-corrected 30 Hz tick loop — the headless replacement for the RAF `GameLoop`), `world-boot.ts` (loads the authored map from disk and builds the world with the game's own `map-format`/`custom-map` code — Talar by default), `net.ts` (WS handshake + ping), `config.ts` (env-driven), plus `server/tsconfig.json` (Node types). Bundles to a single `dist-server/server.mjs` via esbuild.
- **Isomorphic wire protocol** (`src/net/protocol.ts`): zod-validated message schemas for the M0 handshake (`hello`→`welcome`) and latency `ping`→`pong`, with `encode`/`decode` helpers. Every frame is validated on receipt in both directions — malformed/wrong-protocol frames get a coded `error`, never a crash. No three/DOM/Node imports (usable by client **and** server).
- **Supporting seams:** `src/platform/null-input.ts` (a no-op `ControlState` — the "player who does nothing" the server ticks in M0; replaced by network input in M1/M2); `buildCustomWorldData()` added to `world/custom-map.ts` (map JSON → render-free world data); the **collision** voxel constants `VOXEL_CUBE`/`VOXEL_STEP` moved from `render/terrain-mesh.ts` to `world/layout.ts` (the sim reads them, so a headless server must too) and re-exported for unchanged renderer imports.
- **Deps/scripts:** added `ws` + `zod` (runtime), `tsx`/`esbuild`/`@types/node`/`@types/ws` (dev); scripts `server:dev`, `server:build`, `server:start`, `typecheck:server`. (`better-sqlite3` is deferred to M3 where it's first used.) **AdminTools: no changes.**

**Verified:** `typecheck` ✓ (client) · `typecheck:server` ✓ · `npm test` → **345/345** ✓ (incl. a new `server-sim-smoke` test that boots the shared world and ticks it 300× on Node, asserting AI runs without crashing) · `build` ✓ · `server:build` ✓ → the bundle **ran for 5 min at a steady 30.0 Hz with zero drift**; a live WS client got correct `pong`, `welcome` (map "talar", tickHz 30), and `error` replies for a malformed frame and a wrong protocol version. **e2e: parity with the pre-change baseline** — the same 9 gameplay tests fail on both the original and this code in this headless container (slow software rendering, ~250 ms frames — an environment limit, not a regression) and the other 9 pass on both; the refactor adds **no** new failures. **Next phase → M1 "First Connection"** (one client plays movement online) — confirm with the owner.

---

## MMO plan — Oathbound Online + SQLite (owner-requested, planning phase — no code)
**Goal:** plan the full transition from local single-player to a **self-hostable MMORPG**: an authoritative game server on a **Linux VPS**, friends playing together in one world, and all persisted game data (accounts, characters, world flags) moved to **SQLite** server-side.
- **[docs/production/MMO_ROADMAP.md](./docs/production/MMO_ROADMAP.md)** — the phased track **M0→M8** (server scaffold → first online connection → shared-world per-player sim refactor → accounts + SQLite → prediction/reconciliation netcode → group XP/loot/threat/boss rules → chat & presence → VPS ops/backups/hardening → friends beta + **Online Gate**), sized as a *friends server* (≤ ~20 players), one phase at a time like the 0.x roadmap. Solo/offline mode keeps working throughout.
- **[docs/technical/MMO_ARCHITECTURE.md](./docs/technical/MMO_ARCHITECTURE.md)** — one Node 22 process runs the **existing headless sim** at 30 Hz (the sim/render seam pays off: `ControlState` becomes the input packet, sim events become the broadcast stream, terrain stays deterministic and never replicates); WebSocket + zod protocol; **SQLite (`better-sqlite3`, WAL)** schema v1 (`accounts`, `sessions`, `characters` = hot columns + versioned `SaveData` JSON via the existing `serialize()`/`applySave()` boundary, `world_state`, migrations); write-behind autosave; one-time local-save import; friends-scale security model.
- **[docs/technical/VPS_HOSTING_GUIDE.md](./docs/technical/VPS_HOSTING_GUIDE.md)** — the exact VPS to buy (**2 vCPU / 4 GB / 40 GB NVMe, Ubuntu 24.04, e.g. Hetzner CX22 ~€4–5/mo + a domain**) and the full setup: Caddy (auto-TLS, serves the client, proxies `/ws`), systemd, UFW, nightly SQLite backups + restore drill, deploy script.
- **[ADR-013](./docs/decisions/DECISION_RECORDS.md#adr-013-going-online--authoritative-node-server--sqlite)** records the decision (Node-reusing-the-sim over rewrite/hosted platforms; WebSocket over WebRTC; SQLite over Postgres/browser-sync). DEFERRED_FEATURES gained a partial-supersession note (multiplayer/accounts/networking/chat now in scope; dungeons/raids/PvP/trading/guilds still deferred); POST_BETA_MMO_HORIZON marked activated; AGENTS.md status updated. **AdminTools needs no changes** — it couples only via the map JSON format, which the server parses with the game's own `map-format.ts`.

**Verified:** docs-only change — `typecheck` ✓ · unit ✓ · `build` ✓ (no code touched). **Next phase → M0 "Server Scaffold"** (after owner review of the plan).

---

## Realistic road textures — City / Grassland / Sandland (owner-requested)
**Goal:** fix the Road tool so roads read as real environmental roads instead of one flat tan colour — a paved **City** road, an earthen **Grassland** road and a sandy **Sandland** road, each looking right in its surroundings.
- **Three procedural road textures** (`render/paving.ts`, `makeRoadTexture` + `roadMaterial`, mirrored in the Map Builder's `engine/paving.ts`): **City** — warm-grey cobbled setts in running bond over dark mortar; **Grassland** — packed-earth dirt with soft worn wheel lanes, pebbles and fine grain; **Sandland** — drifting tan sand with wind-ripple streaks, faint compacted tracks and fine grit. Full-colour, tileable canvas textures (seamless across the 9 wrap offsets).
- **Textured road ribbons:** the draped ribbon builder now emits **world-scaled UVs** (a 4 m texture repeat — U across the road width, V along its length) so stones/grain keep a constant real-world size on roads of any width or length — added in the game's `render/scenery-view.ts` and `render/custom-map-view.ts` and the editor's `engine/ribbon.ts`.
- **Road surface picker:** the editor **Road** tool gains a *Surface* dropdown (City / Grassland / Sandland); the choice rides along in the map as a new optional `style` on a road path (`MapPath.style`, mirrored `format/map.ts` ↔ `world/map-format.ts`) and selects the texture both in the editor preview and in-game. Roads with no style default to **City**; procedural-world roads use the **Grassland** dirt texture.
- Render-only content: no engine/sim changes; rivers are unaffected (they ignore `style`).

**Verified:** `typecheck` ✓ (both repos) · `npm test` → 344/344 ✓ · `build` ✓ (both repos) · headless renders of all three textures as close-up swatches and as roads draped over rolling terrain — each reads clearly as its environment (cobbled stone / dirt / sand) and tiles seamlessly, with **zero console errors**.

---

## 12 new City buildings for the Map Builder (owner-requested — voxelised from reference art)
**Goal:** turn the owner's `public/new_assets` reference renders into placeable low-poly assets for the City, in the same primitive-parts style as the rest of the preset library.
- **New presets** (`world/presets.ts`, mirrored in the Map Builder's `format/presets.ts`), all category `structure` so they appear automatically in the editor's **Structures** palette: **Timbered House, Tall Townhouse, Tudor Cottage, Corner House** (half-timbered Tudor houses), **Worker's Hut, Stable** (barn + hay + lean-to), **Bathhouse** (chimney steam + an outdoor steaming tub), **Inn** (mug sign + covered porch), **Church** (nave + bell tower + spire + cross + rose window), **Tower Manor** & **Grand Manor** (grand multi-gabled houses), and a **Stone Fountain** (basin + column + water jets).
- Built from the shared `box`/`cyl`/`cone` primitives with a few new helpers — `chimney`, `leadWin` (leaded glass), `flowerBox`, `studs` (half-timber framing), `gableEnd`/`gableEndX` (stepped gable-end fills) and `gableRoofX` (ridge along the wide axis) — plus a small warm-terracotta / plaster / leaded-glass palette. Each carries a box footprint collider.
- Render-only content: no engine changes; they load through the existing `preset:<id>` custom-asset path in both the editor and the game.

**Verified:** `typecheck` ✓ (both repos) · `npm test` → 344/344 ✓ (incl. the preset-validity/unique-id test) · `build` ✓ (both repos) · headless renders of all 12 via the Map Builder's real `customAssetGeometry` (each reads clearly as its reference building), and an in-editor check: all 12 appear in the Structures palette as rendered thumbnails with **zero console errors**.

---

## Textured ground — real material textures on the cube tops (owner-requested)
**Goal:** make each terrain cube read as its *surface* — grassy blades, craggy stone, sandy grit — the same way City ground already reads as cobbled stone, instead of a flat colour. (Supersedes a first pass that only varied the per-cube colour, which read as a noisy mosaic rather than a texture.)
- **Procedural material textures** (`render/paving.ts`, `makeGroundTexture`): tileable canvas textures for **grass** (blades + soft meadow blotches), **rock** (irregular chunks + dark cracks) and **grit** (fine sandy/snowy speckle), alongside the existing cobble paving. Light-keyed detail so a per-cube biome tint shows through.
- **Per-material cube-top overlays** (`render/voxel-terrain.ts`): the single paving overlay became **one overlay mesh per material**. Each cube top emits a world-UV quad into its material's overlay (chosen by `groundMaterial(biome)`), tinted by the biome colour × a small boost — so the detail tiles seamlessly across cubes and reads as continuous grass/rock/sand. Cobble keeps its grey/warm tint.
- **`colorForBiome` reverted to flat** base colours (height gradients + snow caps only) — it's now just the *tint* the texture multiplies under; the old per-cube grain + `rockNoise` are gone. New `groundMaterial(biome)` maps each painted index to a material. The **procedural world** feeds a stand-in index from its dominant biome so it's textured too (grass / rock).
- Kept **byte-identical** with the Map Builder (`AdminTools`: `engine/paving.ts`, `oathbound/palette.ts`, `engine/terrain.ts`) so the editor preview matches the game 1:1.

**Verified:** `typecheck` ✓ · `npm test` → 344/344 ✓ · `build` ✓ (both repos) · headless renders over the real Talar map: grass cubes show grassy blades, mountains show craggy stone, the city keeps its cobbles — each cube textured like its material. In-game `?autostart` boot: the player stands on textured grass and textured cobbles with **zero console errors**.

---

## Big, dynamic combat animations (owner-requested)
**Goal:** make ability animations read as powerful, full-body actions instead of a lone arm swing — a wind-up, a whole-body commit, weapon arcs, spell flares — and add signature moves so different ability types look different.
- **Whole-rig actions:** an ability no longer just moves the arms. `applyAction` now also drives the torso (twist/lean/lunge/crouch — pivoting from the feet), the head (tracks the target / looks up), the legs (steps + stances), a forward body lunge, and the priest's gem flare. Combat-only channels (arm cross/twist, torso lunge) rest at zero each frame so they revert the instant the move ends. Still suppressed while mounted.
- **Warrior** — the basic strike is now a **coil → diagonal downswing with a lunging step and follow-through** (torso whips into it, head tracks, shield braces); whirlwind is a **rising spin >1 full turn** with sword + shield flung out. New signature moves: an overhead **ground slam** (raise high → slam → land in a crouch, for `groundAoE`), a charging **lunge-stab** (`charge`/`dash`), and a **battle shout** (sword thrust skyward, chest out, for `self` buffs).
- **Ranger** — the shot is a **bladed archer's stance**: bow up and aiming, body turned side-on while the head sights forward, draw to full → hold → **loose with a recoil kick**. New: a **sweeping multishot** (`cone`) that fans three rapid draws across an arc; the trap set is now a clean **bend-and-place** crouch.
- **Priest** — the offensive cast is **gather → hurl** (raise the staff as the gem builds, then thrust it forward with a body push and a flare); the blessing **raises the staff aloft and holds it high**, head up, floating a touch while the gem pulses. New: a **smite** (`groundAoE`) that charges overhead then swings down as the gem blazes.
- **More ability types map to distinct motions:** warrior `selfAoE/groundAoE/charge/dash/self` and priest `groundAoE` now pick dedicated animations instead of all collapsing into one swing/cast.

**Verified:** `typecheck` ✓ · `npm test` → 344/344 ✓ · `build` ✓ · headless renders of the shipped `player-view.ts` firing every move via `triggerAction`, sampled at wind-up + strike/peak progress for all three classes (18 frames) — each move reads as a big, clean action with no broken/collapsed poses (the trap crouch was retuned after a first pass folded the body over), and zero page errors.

---

## Livelier idle/walk + an active-riding gallop (owner-requested)
**Goal:** make all three class models feel more dynamic while standing and walking, and give the wolf mount a proper *active-riding* animation instead of a static seat.
- **Head sub-group:** each class's skin/eyes/mouth/hair now sit on a `head` pivot at the neck base (parented to the torso), so the head can nod/turn/tilt on its own while everything still reads at the same rest position — hoods, scarves and collars stay on the body.
- **Livelier idle (on foot):** standing now layers a breathing lift, a slow **weight-shift sway** (subtle torso yaw + roll), a **slow head look-around**, and a breath-driven **arm drift** — small enough to read as alive without fidgeting.
- **Livelier walk (on foot):** a **bigger arm/leg swing**, a **shoulder twist that counter-rotates the hips**, a lean into each step, and a **head bob that partly counter-turns** so the gaze stays forward — a much more dynamic gait than the old straight-swing.
- **Active-riding gallop:** moving on the wolf is now a lively **bound** — the wolf's body **bobs (vertical suspension) and rocks fore/aft**, its legs **bound in front/back pairs** (offset so it reads as a real 4-beat gait, amplitude ramping with speed) and its **tail streams** out behind. The **rider posts** with the gait, **leans forward** into the gallop and **rocks** with each bound, hands riding the reins. All gated by the mount blend so it fades in/out cleanly on mount/dismount, and by speed so an **AFK mount still just breathes** (the standing wolf idle is preserved).

**Verified:** `typecheck` ✓ · `npm test` → 344/344 ✓ · `build` ✓ · headless renders of the shipped `player-view.ts` — two frame samples each of **idle** (head/body drift is alive), **walk** (stride reverses, torso twists) and **gallop** (legs bound, body suspends, rider posts + leans), plus **side + front** riding-integrity views and an **AFK-on-mount** frame, across all three classes — the rider sits clean on the wolf at speed (no clipping/detachment) and there are zero page errors.

---

## Wolf mount + faster travel (owner-requested)
**Goal:** replace hold-Shift *sprint* with a summonable **wolf mount**, nudge base walk speed up, and refine the priest/ranger weapon holds.
- **Faster on foot:** base `runSpeed` 6 → **6.6**.
- **Call Mount (Shift):** sprint is gone; **Shift** now toggles a mount. Off a mount, Shift starts a **2-second summon channel** (any movement cancels it) — shown on the HUD cast bar; on completion a **wolf** appears and you ride it at **+60% move speed**. Pressing **Shift** while mounted **dismounts instantly**. Pure sim state on `Character` (`mounted`, `mountCast`); the movement system owns the toggle/channel/speed (`MOUNT_CAST_TIME`, `MOUNT_SPEED_MULT`). Input turned the held `sprint` flag into a `consumeMount()` press; the keybind/label is now **`mount` → "Call Mount"** (still Shift).
- **The wolf** (`src/render/player-view.ts`, `buildWolf`): a chunky voxel dire-wolf voxelised from the reference — grey back, cream underside/legs, amber eyes, pointed ears, bushy tail, with a leather saddle (gold trim), a chest harness + gold medallion, and rear saddlebags. It has a 4-leg diagonal **trot** driven by speed, persists across class switches, and is hidden until you ride.
- **Rider on the mount:** the whole rider now lives under a liftable `figure` group; while mounted it lifts onto the saddle, the legs drop **astride** down the wolf's sides (splayed, not walking), the body sits upright, and the nameplate floats higher — the blend is smoothed so mount/dismount isn't a pop. Verified from front/¾/side for all three classes: no clipping, weapons hang naturally.
- **Weapon holds:** the Priest now grips the staff at the **middle** of the shaft and at a **bolder angle**; the Ranger's **bow is bigger and more vertical**, and the **quiver is enlarged to span the whole back**.
- **Wolf idle animation (follow-up):** the wolf's torso/head/tail became pivoted sub-groups, so standing still it now **breathes** (a subtle body bob the rider rides along with — the legs stay planted), **sways its tail**, and **nods its head** — no longer frozen when AFK. The trot still ramps in with speed on top of it.

**Verified:** `typecheck` ✓ · `npm test` → 344/344 ✓ · `build` ✓ · headless renders of the shipped `player-view.ts` (all classes, on-foot + mounted — no clipping; two idle frames confirm the breathe/tail/head motion) + an in-game `?autostart` smoke test: **Shift summons the wolf, mounted move speed is higher, Shift dismounts** — zero console errors. e2e: the movement test (`WASD moves the player`) passes; the enemy-spawn-dependent e2e tests time out on the Talar/Cube-World `?autostart` map — a **pre-existing** failure (confirmed identical on the base branch with this change stashed; they wait for enemies that don't spawn near the autostart point), unrelated to this change.

---

## New class player models (owner-requested — voxelised from reference art)
**Goal:** replace the plain blocky avatars with detailed, Cube-World-style class models matching owner-supplied reference art, and scale the avatar up a touch so the extra detail doesn't look squished.
- **Rebuilt `src/render/player-view.ts`** — each class is now a richly voxel-skinned figure on the **same animation rig** (walk / idle / one-shot swing-draw-cast untouched, still driven by `AbilityUsed`; still purely cosmetic — equipped gear deliberately doesn't show):
  - **Warrior** — steel plate over a navy gambeson, red collar scarf + hanging tabard, a leather baldric, gold-trimmed pauldrons/bracers/knees, a sword held point-down, a **back-slung sword**, and a **navy kite shield with a gold diamond emblem**.
  - **Ranger** — a flowing **green hooded cloak**, leather harness with a **gold stag**, a **back quiver** (white fletching), gold-trimmed boots, and a **recurve bow** carried at the side.
  - **Priest** — a **hooded cream robe** with gold trim, a blue front panel + **gold cross**, an ornate gem-studded gold mantle, wide sleeves, a long robe skirt, and a **gold-framed glowing-gem staff** (the staff gem keeps the cast-flash emissive).
- **Bigger avatar:** a new `MODEL_SCALE = 1.22` uniformly enlarges the figure (feet stay grounded on the terrain); the overhead nameplate floats up to match.
- **Editor mirror:** the Map Builder's Player-Spawn **size reference** (`src/oathbound/player-model.ts`) now renders the new warrior at the same scale, and the spawn marker reads `~3.0m (1:1)`.
- **Owner polish pass:** dropped the Ranger's back cape; every class now holds its weapon at a shared **~65°-above-ground** forward angle (`HOLD_ANGLE`) instead of dead-vertical/point-down; the Warrior's **sword is beefier** and its **kite shield bigger + turned 50° to the side** (`SHIELD_ANGLE`); and the Priest lost the odd leg-skirt in favour of full robed legs + a short blue front drape (shoes with a gold ankle trim peek out).

**Verified:** `typecheck` ✓ (both repos) · `npm test` → 344/344 ✓ · `build` ✓ (both repos) · headless renders of the **shipped** `player-view.ts` (all three classes from front / ¾ / back) and of the editor's `buildPlayerModel()` — models match the reference art with clean silhouettes, no clipping, and zero console errors.

---

## Cube World is now the game's only style (toggle removed)
**Goal:** the owner picked the Cube World look, so the game drops the smooth/voxel switch — it always renders as fine cubes. The **Map Builder keeps** its `Terrain: Smooth ⇄ Cubic` toggle (handy for visual editing).
- Removed the `voxelTerrain` setting + the Settings → Graphics toggle and the `?voxel=` override; bootstrap always builds the cube bubble, switches on the voxel collision grid, and pulls the fog in. The unused smooth-terrain build paths are no longer called in-game (the builders stay exported for the editor/tests).
- **Overlay audit** (checked everything else drawn on the terrain for the same "smooth over cubes" problem): **placed assets** sit on `field.sample` — now the quantized cube tops — so they stand on the cubes (models stay low-poly by design, not cubes); **painted water** is a flat plane at the water level, which is already correct blocky water; **paving** was the one real offender and is fixed (per-cube). **Rivers / roads / legacy lakes** are smooth ribbons/discs draped on the terrain and would ramp over the steps — but Talar uses none, so they're left as a known minor limitation (easy to cube-ify if you start using them).

**Verified:** `typecheck` ✓ · `npm test` → 344/344 ✓ · `build` ✓ · headless: booting with no `?voxel=` renders Cube World (cube + per-cube paving), the Settings panel has no voxel toggle, player stands on the cube tops — zero console errors.

---

## Voxel paving fix — paved ground steps with the cubes
**Goal:** City/Cobblestone ground was drawing as one smooth coarse sheet draped over the fine voxel terrain (it was built at the map's authoring resolution, ~15 m quads, so on a slope it looked like a flat plane amid the cubes). Now the voxel bubble emits **one flat, stone-textured quad per paved cube top** (world-scaled UVs so stones tile seamlessly across cubes), so paved ground reads as textured cubes — flat where the ground is flat, stepped (paved tops + grey risers) on slopes — matching the terrain. The old smooth overlay is hidden in voxel mode. `render/voxel-terrain.ts` + bootstrap wiring; no format change.

**Verified:** `typecheck` ✓ · `npm test` → 344/344 ✓ · `build` ✓ · headless on Talar: flat plaza shows fine cobblestone on the cubes, and a paved slope steps down in cobblestone cubes (paving submesh spans a 16 m / 8-step height range) — zero console errors.

---

## Voxel terrain v2 — fine cubes, textured tops, real cube collision
**Goal:** the follow-ups on the Cube World toggle — much finer cubes (the coarse ~23 m blocks made the player look ant-sized), ground textures that read correctly on the cubes, and collision that stands on the cubes instead of clipping through their edges.
- **Fine cubes via a player-centred bubble** (`render/voxel-terrain.ts`): the map is far too large to voxelize whole at a fine size, but the scene fog only shows a few hundred metres, so the game builds just a bubble of ~3 m cubes around the player and rebuilds it as they roam (the fog hides the edge; the voxel-mode fog is pulled in to match). ~3 m cubes ≈ 1.5× the player instead of ~11×.
- **Real cube collision** — no longer render-only. `Heightfield` gains a voxel grid: `sample()` snaps to a fixed world cube grid and quantizes (`voxelHeightAt`), so the player, enemies and placed assets all stand on the exact cube tops the renderer draws (render + collision share the one function, so they always agree). Movement adds cube-wall step-blocking (`movement.ts`): grounded moves that would climb more than ~1.5 steps are blocked per-axis, so you slide along cliff faces instead of walking up them — gentle stepped slopes still auto-climb and jumping is unaffected.
- **Ground textures on the cubes**: `pavedSurfaceGeometry` takes an optional height function, so in voxel mode the City/Cobblestone paved-stone overlay lays on the cube tops (it showed flat grey before). Mirrored in the Map Builder, where the cubic preview is also finer and shows the paving.
- Settings copy updated ("you walk on the cube tops"). `tests/unit/voxel-collision.test.ts` (snap + quantize + render/collision agreement) and `movement.test.ts` (cube-wall blocking vs smooth climb-through) added.

**Trade-offs (documented):** the voxel bubble rebuilds when the player crosses ~a third of its radius — a brief hitch on that frame (fine on a real GPU; movable to a worker later). Voxel mode pulls the view distance in to the fog bubble (as Cube World does). The Map Builder preview is a whole-map mesh, so huge maps (Talar) show a little coarser there than the game's near-field.

**Verified:** `typecheck` ✓ (both) · `npm test` → 344/344 ✓ · `build` ✓ (both) · headless on Talar: fine cubes on rolling + mountain terrain, cobblestone texture on the plaza cubes, player feet quantized onto cube tops (66.0 → 72.0 across a step); editor shows fine cubes + paving — zero console errors.

---

## Voxel / "Cube World" terrain toggle (render-only)
**Goal:** an evaluation toggle to see the world (and the Map Builder) rendered as stepped cubes — Cube World / Trove style — before deciding whether to adopt the theme. Purely a rendering change: the sim, collision, colliders, map format and export are all unchanged.
- **Shared builder** (`cubicTerrainGeometry`, mirrored `map-format.ts` ↔ Map Builder `map.ts`): pure, three-free geometry — the heightfield sampled onto a grid of flat-topped columns, each height quantized to a step, with vertical side walls dropping to lower neighbours so cliffs show. Flat per-face normals + a per-tile colour give the faceted blocky look (side faces darkened for depth). The renderer passes in the height sampler + colour fn, so one builder serves the procedural world, custom maps, and the editor.
- **Game:** a `voxelTerrain` setting (Settings → Graphics: "Voxel terrain (Cube World style)"), applied by swapping the terrain mesh **live** — no reload. `?voxel=1` / `?voxel=0` overrides the saved setting at boot. Works on the procedural world and custom maps (Talar). `buildCubicTerrainMesh` in `terrain-mesh.ts`.
- **Map Builder:** a top-bar "Terrain: Smooth ⇄ Cubic" toggle previews the look live while you author; the smooth mesh stays present (hidden) so sculpt/paint picking is unaffected, and the toggle rides through map load/resize. The exported `.json` is identical either way.
- **Caveat (documented):** render-only, so in cubic mode placed assets/paving/water still sit at their true (smooth) heights and can float or clip against the quantized ground on slopes. Collision follows the smooth heightfield, not the visible cubes. Both are intentional for a look-only toggle — if we adopt the theme, we'd quantize placement + collision too.
- `tests/unit/cubic-terrain.test.ts` (new): flat ground → tops only; height quantization; cliffs emit darker side walls; finite attributes + Uint32 indices. `settings.test.ts` covers the new field.

**Verified:** `typecheck` ✓ (both repos) · `npm test` → 339/339 ✓ · `build` ✓ (both repos) · headless: editor smooth↔cubic on sculpted hills (+ live step tuning), in-game smooth vs cubic on Talar at a hillside, and the in-game Settings toggle swapping the terrain live (47,089 → 415,136 verts) — zero console errors throughout.

---

## Blue-Roof Tavern preset (owner-requested — built from a reference image)
**Goal:** turn an owner-supplied reference image (a timber-framed medieval tavern with a blue slate roof) into a placeable Three.js asset for the Map Builder + game.
- **New `structure` preset `tavern-blueroof` ("Blue-Roof Tavern")** (`presets.ts`, mirrored editor ↔ game): a grand two-storey **timber-framed inn** built from the shared primitive + `gableRoof` vocabulary — a grey **stone ground floor** (plinth + corner quoins), a **jettied** cream **upper floor** with dark timber framing (corner posts, rails, studs, chevron braces) and a stepped plaster front gable, a steep **blue-slate gable roof** (ridge cap + bargeboards + fascia), a tall **stone chimney** with cap + flue pots, **warm glowing lattice windows** (front, sides, and a diamond attic light), an iron-strapped arched **door** with a stone surround + steps, a **covered porch** (posts, blue lean-to roof, two barrels + a crate), a leafy planter, and a **hanging beer-mug sign**. Box-footprint collider `{ hw: 2.5, hd: 2.1 }`; it lists in the **Structures** library right after Inn/Tavern.
- Added three small tavern helpers to `presets.ts` (`litWindow`, `sideWindow`, `barrel`) + a tavern palette block; the editor and game copies stay byte-identical after the header.

**Verified:** `typecheck` ✓ (both repos) · `npm test` → 335/335 ✓ · `build` ✓ (both repos) · headless render of the **shipped** `presets.ts` (both repos) resolves `tavern-blueroof` (122 parts) and renders the tavern from four angles, matching the reference; a headless **editor** run confirms the "Blue-Roof Tavern" chip appears in the Assets palette (with a generated thumbnail) and places on the terrain ("Placed 1 asset"), with zero console errors.

---

## Paving polish + Mountains ground + 12 medieval city buildings
**Goal:** three follow-ups to the Ground work — shrink the oversized paving stones, add a rocky **Mountains** ground, and add grand **city** buildings (Stormwind-style, not villagey).
- **Smaller paving (City + Cobblestone):** the paved look moved off the terrain vertex colours (which were mesh-resolution-limited, so slabs looked huge) onto a **repeat-tiled texture overlay** — a procedural cobblestone canvas (`src/render/paving.ts`, mirrored in the Map Builder) laid on a thin mesh over paved cells with world-scaled UVs (`pavedSurfaceGeometry`, ~2.2 m repeat → ~0.44 m stones). Stone size is now independent of terrain resolution; City & Cobblestone share the texture (City cool grey, Cobblestone a touch warmer). The terrain vertex colour under paving is now a flat base tone.
- **Mountains ground (index 20):** appended to `BIOME_IDS` (now **21**). `colorForBiome` gives it a rocky grey-brown that lightens with height, a positional rock-mottle, and a snow cap on the peaks (synced editor `palette.ts` ↔ game `custom-map-view.ts`). Selectable in the Ground tool as “Mountains (rocky)”.
- **12 medieval city buildings** (`presets.ts`, mirrored): `cathedral, castle-keep, town-hall, guildhall, city-manor, grand-gatehouse, mage-tower, barracks, city-townhouse, bell-tower, market-hall, citadel-tower` — big stonework, blue-slate **pitched gable roofs** (new `gableRoof` helper builds real tilted roof planes instead of pyramid cones), spires with gold finials, crenellations, banners. All are `structure` presets with box/round colliders (the gatehouse is intentionally walk-through, like `gate`).
- `tests/unit/ground.test.ts`: adds Mountains (rocky low → snow-bright peaks) and asserts City/Cobblestone are now **flat** vertex colours with a non-empty `pavedSurfaceGeometry` overlay. `tests/unit/presets.test.ts` (new): every preset is structurally valid with a unique id, and all 12 city buildings resolve as colliding structures.

**Verified:** `typecheck` ✓ (both repos) · `npm test` → 335/335 ✓ · `build` ✓ (both repos) · headless (editor): placed all 12 buildings on a paved plaza with a snow-capped mountain ridge — buildings render varied and grand, paving stones are now small running-bond cobbles (well under the ~2.4 m spawn-marker scale), zero console errors.

---

## "Ground" tool: rename Biome → Ground + many more ground surfaces (incl. paved City)
**Goal:** more ground variety for custom maps — grass/forest/desert/mesa/city and more — with a believable **city** surface (paved stone, not grass).
- **Format (mirror):** `BIOME_IDS` extended from 7 to **20** — appends `city, desert, mesa, savanna, tundra, dirt, sand, mud, cobblestone, ash, jungle, ice, basalt` after the original gameplay biomes (0–6). Append-only, so old maps keep their indices; the new ones are **cosmetic ground colours** on custom maps (they don't drive gameplay/scatter).
- **Colour mapping** (`colorForBiome`, synced editor `palette.ts` ↔ game `custom-map-view.ts`): now takes world (x,z) and colours each ground type. **City** and **cobblestone** use a deterministic per-slab paving shade (flagstone tiles + darker seams) so they read as real paved stone at terrain-mesh resolution; mesa gets red strata by height, tundra a snow cap, etc.
- **Editor:** the **Biome** tool is now **Ground**, with a 20-entry palette dropdown (Grass, Forest, Desert, Mesa, City (paved stone), Cobblestone road, …).
- `tests/unit/ground.test.ts`: every index colours; grass is green, city near-grey (not grassy), desert warm, mesa red, basalt dark; city/cobble vary by position (paving) while flat grounds don't.

**Verified:** `typecheck` ✓ · `npm test` → 331/331 ✓ · `build` ✓ · headless: painted City/Desert/Mesa/Grass bands in the editor (City shows grey paved slabs) and loaded the same in-game — the city band samples near-grey stone (r≈g≈b≈0.15) vs green grass, zero console errors.

---

## Painted water (Map Builder "Water" tool) — flood lakes, basins & gorges to a height
**Goal:** replace the old press-drag circular **Lake** tool with a paint-based **Water** tool that fills the ground up to a chosen surface height, so you can author big/detailed water regions (e.g. gorges) — and render it in-game.
- **Format (mirror):** new optional `waterPacked` — a per-cell water-surface-height grid (same res as heights), packed base64 Int16-cm with a "dry" sentinel. Helpers `packWater` / `unpackWater` / `hasWater` and a pure `waterSurfaceGeometry(water, heights, res, size)` that builds the surface mesh **only where the water sits above the terrain** (so it fills basins up to the level and hides where the ground pokes through). Legacy circular `lakes` still load + render.
- **Game render** (`custom-map-view.ts`): builds the painted-water surface from `waterPacked` and adds it (a flat translucent surface at each cell's painted level). Visual only — no swimming/collision (as before).
- `tests/unit/water.test.ts`: pack/unpack round-trip (incl. NaN dry cells), and the surface geometry (emits above terrain, clips a flooded slope, nothing when dry / below ground).

**Verified:** `typecheck` ✓ · `npm test` → 328/328 ✓ · `build` ✓ · headless: authored a flooded-basin map in the Map Builder (paint + erase + export `waterPacked`) and loaded it in-game — the water surface renders flat at the painted level (all verts y=0 over an −8 m bowl), zero console errors.

---

## Fix: sinking into the ground on detailed (heightmap) custom maps
**Goal:** on custom maps finer than the terrain render cap (e.g. heightmap imports), the player stood half-buried — collision didn't match the drawn ground.
- **Root cause:** the terrain *mesh* is tessellated at most `TERRAIN_RENDER_RES` (217) vertices/side, but the gameplay heightfield (what the player snaps to) used the **full** authored resolution. On a fine/noisy field the mesh draws a smoother surface than the player collides with, so you sink into the parts the mesh rounds off. (The default procedural world is smooth, so its 433→217 render never diverges noticeably — only authored heightmaps do.)
- **Fix:** `buildCustomHeightfield` now resamples the gameplay field **down to the render grid** when the map is finer than it, so collision sits exactly on the surface that's drawn. Maps at/below the render resolution are untouched (used as authored).
- `tests/unit/custom-heightfield.test.ts`: on a 433-res ripply field the new collision matches the drawn surface (Δ < 0.05 m) whereas the old full-res field diverged (Δ > 1 m); a small map is left as-is.

**Verified:** `typecheck` ✓ · `npm test` → 322/322 ✓ · `build` ✓ · headless on a 433-res detailed map: across 24 probe points the player's **feet match the drawn terrain surface to 0.000 m** (was half-buried), and the player visibly stands on the ground.

---

## Fix: custom maps loaded by filename (`?map=name.oathbound-map.json`) failed
**Goal:** loading a map by its full filename — or a missing map — produced the cryptic console error *“Unexpected token '<', "<!doctype "… is not valid JSON”* and silently fell back to the default world.
- **Root cause:** the loader treated any `?map=` value containing a dot as a literal path, so `?map=tanaria.oathbound-map.json` was fetched relative to the page (`/tanaria.oathbound-map.json`), not from `public/maps/`. Static hosts answer a missing file with the app's `index.html` (HTTP **200** + HTML), so `res.json()` choked on the leading `<`.
- **Fix:** new pure `resolveMapUrl()` (`src/world/map-url.ts`) — a bare name (with or without a `.oathbound-map.json` / `.json` suffix typed in) resolves to `public/maps/<name>.oathbound-map.json`; only values containing a slash (explicit path / URL) are used verbatim. The loader also detects an HTML response and logs a **clear, actionable message** (which path it tried, where to put the file) instead of the JSON parse error.
- `tests/unit/map-url.test.ts` covers the resolution + the previously-broken filename case.

**Verified:** `typecheck` ✓ · `npm test` → 320/320 ✓ · `build` ✓ · headless against the real dev server: `?map=tanaria` and `?map=tanaria.oathbound-map.json` **both load**, and `?map=missing` boots the default world with a clear warning and **no** `Unexpected token '<'` error.

---

## Fix: "+ Add quest" silently did nothing with no NPCs (Map Builder) + full quest-system audit
**Goal:** the owner couldn't add a quest in the Quests & Dialog editor. Root cause: a quest needs a giver / turn-in NPC, so the button guarded against zero NPCs — but silently (only a fleeting status-bar line), so it looked broken.
- **Fix (Map Builder):** when no NPCs exist, the **"+ Add quest" button is now disabled** (greyed, with a tooltip) and the Quests pane shows a clear inline notice — *"⚠ Add an NPC first. Quests are given out and turned in by NPCs…"*. The moment an NPC is placed, the button enables and works.
- **Full audit (editor → export → game):** authored a 2-step questline map entirely through the editor UI (real "+ Add quest" clicks + the prerequisite checkbox), exported it, loaded it in the game, and played it through headlessly: dialog → accept → talk objective → turn-in → **gold + item reward** → the follow-up was **hidden before / offered after** its prerequisite → second turn-in → **persistence across reload**. All green, zero console errors. NPC-id backfill on import (`ensureNpcIds`) confirmed, so older maps load cleanly.

**Verified:** Map Builder `typecheck` + `build` ✓; game `npm test` → 314/314 ✓, `build` ✓; headless author-and-play of a custom questline map passes end-to-end.

---

## Questlines (prerequisite quests) + NPC quest markers (owner-requested follow-up)
**Goal:** let authored maps form true questlines — a quest that only appears once an earlier one is turned in — and signpost them with floating `!` / `?` markers over NPCs.
- **Follow-up quests.** `MapQuest.requires?: string[]` lists quest ids that must be **completed (turned in)** before this quest is offered. The dialog gates the offer on `QuestLog.canOffer` (not active/done + all prerequisites met), so Quest B stays hidden until Quest A is handed in. Multiple prerequisites are AND-ed, enabling straight chains and convergent lines.
- **NPC quest markers** (`src/render/custom-npcs.ts`). A billboarded badge floats over each NPC: gold **`!`** = a quest available to accept here, gold **`?`** = a quest ready to turn in, dim **`?`** = a quest you're on that turns in here but isn't done. `QuestLog.markerFor(npcId)` computes the state; the bootstrap refreshes all markers whenever quest state changes (accept / kill / talk / turn-in / load). Render-only — no sim coupling.
- Demo `sample` map gains a two-step questline: *A Word with the Elder* → *The Elder's Errand* (the follow-up is hidden until the first is turned in).
- New `QuestSetup.md` documents the full authoring → export → in-game workflow, questlines, markers, and current limits.

**Verified:** `typecheck` ✓ · `npm test` → 314/314 ✓ (quest tests now cover `prereqsMet` / `canOffer` / `markerFor`) · `build` ✓ · headless `?map=sample`: the `!` marker floats over the available-quest giver, the follow-up is **hidden before** and **offered after** its prerequisite is turned in, zero console errors. Editor: ticking a prerequisite sets `requires` and round-trips through export.

---

## Remove the onboarding tutorial; quests can reward items (owner-requested follow-up)
**Goal:** clear the way for an authored "get started" questline by removing the built-in tutorial, and let quests hand out gear/relics — not just gold + XP.
- **Removed the "Getting Started" tracker completely.** Deleted the `Onboarding` sim tracker (`src/sim/onboarding.ts`), the `GoalTracker` overlay (`src/render/goal-tracker.ts`) — which also carried the ongoing Goals/Endgame guidance — their styles, the unit test, and all bootstrap wiring + the `oathbound.onboarded` localStorage flag. Nothing replaces it on-screen (the owner's questline will). The **login / character-select flow is unaffected** — that's a separate system.
- **Item rewards on quests.** `MapQuest.reward` gained an optional `item`: either a **gear** spec (`slot` + `rarity` + `ilvl` + optional `primaryStat`) rolled on turn-in like any loot, or a named **relic** (`relicId`) handed out whole. Granting happens in the bootstrap turn-in path (`generateItem` / `makeRelic` → `addItem`); the turn-in button and toast show the payout, and a full bag is reported rather than silently eating the drop.
- Format additions (mirror of the builder): `QuestReward`, `QuestItemReward`, and the `ITEM_SLOTS` / `ITEM_RARITIES` / `ITEM_PRIMARY_STATS` / `RELIC_IDS` id sets.
- Demo `sample` map: *Cull the Bloomhusks* now also rewards an uncommon weapon, and *A Word with the Elder* rewards a pair of boots (matching its "for your feet" line).

**Verified:** `typecheck` ✓ · `npm test` → 311/311 ✓ (quest test now asserts the item-reward round-trip) · `build` ✓ · `test:e2e` → 18/18 ✓ (boot flow intact with the tracker gone) · headless `?map=sample`: no `.goal-tracker` in the DOM, and turning in the talk quest grants **+15 gold and a pair of boots** (bag +1) with zero console errors.

---

## NPC dialog & quests for custom maps (owner-requested follow-up)
**Goal:** make custom-map NPCs talk and hand out quests — accept at one NPC, complete at another — so authored maps can carry early story/quest content. Additive; the default procedural world is unchanged (it ships no NPCs/quests, so nothing new appears there).
- **Clickable / interactable NPCs:** the custom-map NPCs (render-only walkers) now resolve to a dialog on **left-click** (raycast pick) or the **F interact key** (nearest within ~3.6 m). `src/render/custom-npcs.ts` gained `pick()`/`nearest()`; no sim/ECS coupling — they stay ambient.
- **Dialog panel** (`src/render/dialog-panel.ts`): shows the NPC's name + title + lines, and any quest this NPC offers (**Accept**) or takes in (**Turn in (+gold, +XP)**), reading live state from the quest log. Closes on its ✕, Esc, or the interact key.
- **Quest log** (`src/game/quests.ts`, game layer — not the sim): tracks active quests + objective progress and completed quests. **Kill** objectives advance from the sim's `CombatEvent.Death` (matched by the enemy's template id); **talk** objectives advance when you talk to the target NPC. Rewards (gold + XP) are granted in the bootstrap on turn-in.
- **Quest tracker** (`src/render/quest-tracker.ts`): a small on-screen list of active quests with `n/count` kill progress or a "Talk to X" hint, refreshed whenever the log changes.
- **Persistence:** quest state is saved/loaded with the character (`SaveData.quests`, injected at autosave and restored on load) and survives a reload.
- Format additions (mirror of the builder): `MapNpc` gained `id` / `title` / `dialog[]`; new `MapQuest` (+ `QuestObjective`) and `OathboundMap.quests[]`. `Enemy` ECS component gained `template` (the spawn's template id) so kill credit can be attributed without leaking content into the sim.
- **Bug fix:** the dialog panel's buttons were unclickable — `#ui-root` is `pointer-events:none` and the panel never opted back in. Added `pointer-events:auto` so Accept / Turn in / ✕ work with the mouse.
- Demo `sample` map: the three NPCs now have titles + dialog and two showcase quests — *Cull the Bloomhusks* (accept at Mara → slay 3 → turn in at Sergeant Bram, +50g/+120xp) and *A Word with the Elder* (a talk-objective chain, accept at Bram → turn in at the Elder).

**Verified:** `typecheck` ✓ · `npm test` → 314/314 ✓ (new `tests/unit/quests.test.ts` covers kill/talk/persist) · `build` ✓ · headless `?map=sample`: click/F opens the dialog, **Accept** adds the quest to the tracker, the full talk-quest **Turn in** grants +15 gold, both maps boot with **zero console errors**; default boot (no `?map=`) unchanged.

---

## Map loader — per-asset height, bridges & ambient critters (owner-requested follow-up)
**Goal:** more range when building maps — raise/lower placed props, cross water with bridges, and bring the ambient wildlife into custom maps. Additive; the default procedural world is unchanged.
- **Per-asset Y offset:** `PlacedAsset.y` raises/lowers a placed prop above its terrain seating (e.g. a bridge over a lake), honoured by the custom-map renderer.
- **+24 presets** (mirror of the builder): 4 bridges (2 wooden, 2 stone), dock, rowboat, haystack, wood pile, cart, bench, table, statue, obelisk, tombstone, torch, brazier, scarecrow, hedge, berry bush, rock pile, ice spikes, lava rock, chest, banner pole — the library is now ~70 props. Bridges are walk-through (no collider); buildings keep their box footprints.
- **Ambient critters:** `src/render/custom-critters.ts` spawns each `map.critters` zone — wheeling birds, scurrying ground critters (rats/rabbits), drifting butterflies and glowing fireflies — wandering within its radius (render-only, like AmbientLife), updated from the bootstrap frame loop.
- Format additions (mirror): `PlacedAsset.y` and `critters[]` (`MapCritter`). The builder also gained a WASD/QE fly camera and image **heightmap import** (editor-only).
- Demo `sample` map expanded with raised bridges + a dock over the lake and four critter zones (birds / butterflies / fireflies / ground critters).

**Verified:** `typecheck` ✓ · `npm test` → 309/309 ✓ · `build` ✓ · `test:e2e` → 18/18 ✓ · headless `?map=sample` renders the raised bridges + glowing fireflies + a scurrying critter by the lake with **zero console errors**; default boot (no `?map=`) unchanged.

---

## Map loader — presets, building collision & friendly NPCs (owner-requested follow-up)
**Goal:** richer custom maps — a pre-made building/prop library, solid buildings, and friendly NPCs that walk patrol routes. Extends the map loader below; the default procedural world is unchanged.
- **Preset asset library** (`src/world/presets.ts`, a mirror of the builder's): ~45 data-driven props placed as `preset:<id>` and built through the shared custom-asset geometry, so they render identically to the editor. A full **village set** — small/blue/green/stone houses, cottage, two-story, townhouse, manor, inn/tavern, longhouse, barn, chapel (bell tower + spire), windmill, round hut, blacksmith, shop, storehouse, guard house, fountain — plus round/square/watch/wall towers, walls, gate, fence, palisade, well, market stall, tent, ruins, and extra trees/rocks/crystals/plants.
- **Building collision:** an `AssetDef.box` footprint becomes a **BoxCollider** (precise wall/house blocking for the player) via `customBoxColliders`, fed into the movement system; towers/wells keep a round collider. Decorative presets stay visual-only.
- **Friendly NPCs:** `src/render/custom-npcs.ts` renders each `map.npcs` entry as a low-poly figure with an overhead name plate that strolls its looped route (or idles), snapping to the terrain and facing its travel direction — render-only/ambient like the village walkers (no ECS/combat), updated from the bootstrap frame loop.
- Format additions (mirror): `AssetDef.box` + an `npcs[]` array on the map.
- Tests: the `custom-map` unit suite gained preset round-collider + box-footprint coverage → **309 unit**; the demo `sample` map now includes a hamlet of preset buildings + patrolling NPCs.

**Verified:** `typecheck` ✓ · `npm test` → 309/309 ✓ · `build` ✓ · `test:e2e` → 18/18 ✓ · headless `?map=sample` renders the preset hamlet (solid buildings) + walking named NPCs with **zero console errors**; default boot (no `?map=`) unchanged.

---

## Map loader — load custom maps from the Admin Tools Map Builder (owner-requested, additive)
**Goal:** let maps designed in the new web **Map Builder** (the separate `Oathbound-AdminTools` repo) load straight into the game. **Non-destructive:** with no `?map=`, `getActiveMap()` is null and the procedural world boots exactly as before (all 18 e2e unchanged).
- **Map format** (`src/world/map-format.ts`, byte-for-byte mirror of the builder's `src/format/map.ts`): a versioned JSON — base64 Int16-centimetre heightfield + per-cell biome grid, lakes/rivers/roads, placed assets (built-in props + custom primitive-built assets), enemy spawns/bosses/Oathstones, player spawn, optional town. Pure (no `three`/DOM).
- **Loader** — pure `src/world/custom-map.ts` (heightfield, colliders from boulders + custom assets that declare one, valid spawns/bosses, biome sampler, a minimap Scenery) + render `src/render/custom-map-view.ts` (biome-tinted terrain mesh, instanced props, lake discs, river/road ribbons) reusing the game's **exact** prop geometry (`src/render/asset-geometry.ts`) so authored maps read the same in-engine. Respects the sim/render split.
- **Boot:** `src/main.ts` reads `?map=<name>`, fetches `public/maps/<name>.oathbound-map.json` and sets the active map **before** `runApp()`; `bootstrap` branches the world build on it. On a town-less map the vendor relocates beside the player spawn and a `Home` Oathstone is auto-added if none was placed, so the sell loop / respawn / fast-travel all work. *(v1 note: including the town renders the standard Oathhold at the world origin — the marker's position/rotation isn't applied yet.)*
- A playable **demo** ships at `public/maps/sample.oathbound-map.json` → run with `?map=sample`.
- Tests: new `tests/unit/custom-map.ts` (height pack round-trip, collider/spawn/boss derivation, biome sampling, minimap scenery) → **308 unit**.

**Verified:** `typecheck` ✓ · `npm test` → 308/308 ✓ · `build` ✓ · `test:e2e` → 18/18 ✓ · headless boot of `?map=sample` builds the custom world (player spawn, the map's enemies in combat, draped road, props, lake, minimap) with **zero console errors**; default boot (no `?map=`) unchanged.

---

## 0.7.2-INDEV — ⚡ Performance pass (owner-requested: 20–30 → 60-70+ FPS, no content cut)
**Goal:** lift the framerate to a smooth 60-70+ without removing any world, enemies, or detail. A scene profile (via `renderer.info`) found the cost in three places — a huge fixed triangle load, a per-enemy draw-call explosion, and PBR fill cost — so the fixes target each. Headless software-GL numbers (no GPU) at the starter camp: **draw calls 214 → ~120**, **triangles 537k → 258k**, frame time **−40%**; the fill-rate wins below help real GPUs even more than the software rasteriser shows. Pure rendering — the sim, world data, and gameplay are untouched.
- **Terrain render tessellation decoupled from the heightfield.** The single world-spanning terrain mesh was drawn at the full gameplay sampling density (433² → ~373k triangles, never culled — ~70% of the whole frame). It now draws at ~half density (`TERRAIN_RENDER_RES`, ~93k triangles, a 4× cut) while still sampling heights from the full-res field at every vertex, so the landforms are pixel-identical at the low-poly art scale. Ground-snap/collision (which read the field, not the mesh) are unchanged.
- **Enemy models merged from ~10 draw calls to ~3.** Each enemy was 7–13 separate primitive meshes (torso/head/limbs/eyes…). They're now baked once, at creation, into one vertex-coloured body mesh (also the single hit-flash material) plus merged glow groups — so the glowing eyes/cores and any translucent parts keep their look, the body still flashes red on hit and tints on telegraph, and click-to-target still works. World bosses included.
- **Cheaper materials for the big surfaces.** Terrain, rocks, and all scenery (trees/boulders/grass/flowers/road) switched from `MeshStandardMaterial` (PBR) to matte `MeshLambertMaterial` — visually identical at roughness 1 but far cheaper per fragment, the main saving on integrated GPUs. Water keeps its Standard sheen.
- **Resolution-quality setting (the FPS lever).** A new **Settings → Graphics → Resolution quality** (Performance / Balanced / High / Ultra) caps the render pixel-ratio, applied live and persisted. Default **High (1.5×)** already saves ~45% of pixels vs native 2× on hi-DPI screens; **Performance** renders below native for the most FPS on weak hardware. Plus: far clip-plane pulled in to where fog is already opaque (stops rasterising invisible distance), and the HUD no longer re-parses the portrait SVG every frame.
- Tests: a `maxPixelRatio` clamp test → **296 unit**; full e2e green (enemy rendering, targeting, settings) → **17 e2e**.

**Verified:** `typecheck` ✓ · `npm test` → 296/296 ✓ · `build` ✓ · `test:e2e` → 17/17 ✓.

---

## 0.7.2-INDEV — "UI split" → bottom XP bar, Inventory⇄Character split, Character rework (owner-requested, before 0.8.x)
**Goal:** three targeted UI changes from the latest playtest, layered on the launch design system. No gameplay/sim change.
- **XP bar relocated to the bottom of the screen.** Removed the slim XP sliver from the player unit-frame; the bar is now a **full-width amber bar pinned to the very bottom**, below the hotbar — showing `current / next EXP` (left) and the **percent to next level** (right), with a `MAX LEVEL` state at the cap. The hotbar, micro-bar and version tag were nudged up to clear it.
- **Inventory (`B`) and Character (`C`) are now separate windows.** The old combined panel is split:
  - **Inventory** is a modern **grid bag** — a header with a **settings gear** + close, a **Filter** box, a grid of **rarity-bordered item cells** (with lock / `+N` reinforce / upgrade-`▲` badges), **left-click to equip**, **right-click for a context menu** (Equip · Reinforce · Lock · Salvage, keeping the Rare+ confirm), a **Salvage all Common** action, and a footer **wallet** (gold · whetstones · bag count). **All currencies now live here, not on the Character sheet.**
  - **Character** is a reworked, modern **sheet** — a class **identity strip** (portrait + level + combat state), an **equipment column** (slot icons, rarity-coloured item names, score, reinforce), an **Attributes** chip grid, and **Talents**.
- **Micro-bar** gains a **Character** button (👤); the Inventory button's hotkey hint is now `B`. The bag and sheet share one hover tooltip instance.
- Default keybind: **Inventory `I` → `B`** (Character stays `C`); both remain rebindable in Settings.
- Tests: the inventory e2e now drives the **grid + right-click context-menu** salvage-confirm; the talents e2e opens the **Character** panel (`C`); the rebind e2e expects the new `B` default → **295 unit / 17 e2e**. Version → `0.7.2-INDEV`.

**Verified:** `typecheck` ✓ · `npm test` → 295/295 ✓ · `build` ✓ · `test:e2e` → 17/17 ✓.

---

## 0.7.1-INDEV — "UI Pass" → HUD restyle (owner-requested, after the 0.7.0 playtest)
**Goal:** a focused HUD/UX pass from playtest feedback — a proper unit-frame look, an Esc menu, and mouse-friendly access. **Reconciled onto the parallel "Launch UI" overhaul (PR #36): this layers the new layout/features on top of #36's design system + game-icons rather than replacing them** (the hud.ts/styles.css merge conflicts were resolved that way). No gameplay change.
- **Player + target unit-frames** (top-centre, facing each other), rebuilt to a classic MMO look — using **#36's design tokens + SVG icons**: a gold-framed portrait (your **class icon**, a skull for the target), the name (Cinzel display), a level, and bars — your **HP in green + a gold resource bar** (with #36's heart/resource icons) + a slim XP sliver, the target's **HP in red**. Replaces the old bottom-left player panel + plain target strip.
- **Esc opens the menu.** Esc is now layered: **close the topmost open panel → else clear the target → else open the Settings menu** (it was previously only "clear target", and Settings had no obvious opener). Settings still opens with `O` too.
- **Micro-bar** (bottom-right): a compact row of icon buttons — **Inventory · Fast travel · Map · Settings · Fullscreen** — styled in the launch design, mirroring the hotkeys.
- **Removed the floating controls hint** that overlapped the cast bar (controls now live in **Settings → Controls**, rebindable).
- Internal: Esc handling moved out of the combat sim into the central bootstrap input layer (`consumeClearTarget` → `consumeEscape`).
- Tests: full suites green after the #36 reconciliation → **295 unit**; a new **UI-pass e2e** (controls hint gone, player + target unit-frames, layered Esc clears→menu, micro-bar opens the bag) → **17 e2e**. Version → `0.7.1-INDEV`.

**Verified:** `typecheck` ✓ · `npm test` → 295/295 ✓ · `build` ✓ · `test:e2e` → 17/17 ✓.

---

## 0.7.0-INDEV — "Feel & Finish" → UX, Accessibility & Content Polish *(✅ feature-complete — awaiting playtest)*
**Goal:** make the game *feel finished to use* — full menus, tooltips/comparison, an audio + VFX pass, onboarding polish, and the **accessibility commit list** ([docs/design/UX_AND_ACCESSIBILITY.md](./docs/design/UX_AND_ACCESSIBILITY.md)), all persisting and taking effect without restart. **Gameplay feature-freeze begins** (no new systems). Built in verified checkpoints.

### 🎨 Launch UI — full visual overhaul (owner-requested)
A complete, **release-ready UI** replacing the beta/dev styling — a cohesive dark-fantasy RPG interface aiming at AAA-MMO polish, with **real iconography throughout** (no more text-only menus). Pure presentation: the DOM structure + every test/selector hook is preserved, so there is no gameplay/sim change.
- **Design system** (`src/styles.css`, fully rewritten): an aged-gold accent system over layered obsidian panels, a serif **Cinzel/Georgia** display stack + Spectral/serif body, framed panels with inner-bevel + drop shadow + blur, glossy gradient vital bars, beveled hotbar slots with a "ready" glow, styled buttons/inputs/selects/sliders/scrollbars, and rarity-glow toasts — all honouring the existing accessibility toggles (UI scale, reduced-effects, high-contrast rarity, damage-number size).
- **Icons** (`src/render/ui/icons.ts`): **54 inline SVG icons sourced from game-icons.net (CC BY 3.0**, see [CREDITS.md](./CREDITS.md)), recoloured to `currentColor`. Wired across the UI: per-**ability** hotbar icons (keyword-mapped for all 3 classes), class-aware **resource bars** (Fury flame / Focus eye / Mana droplet) + an HP heart, **currencies** (coin/whetstone), **equipment-slot** icons (helm/chest/gauntlet/ring/…), action buttons (equip/reinforce/lock/salvage), panel headers (bag/shop/map), the class-select cards (sword/bow/staff), and toasts.
- **Screens** restyled & iconified: the **class-select** (ornate cards + large class crest), the **HUD** (vitals frame, ability hotbar, target frame, toasts, loot prompt, gold), the **inventory/character** panel (widened; slot icons, item rows, talents, stat chips), **vendor** + **fast-travel**, **settings/controls**, **tooltips**, and the **minimap**.
- **Offline-safe**: type uses the player's system serif stack (no external font/CDN dependency), so there are no network requests or console errors at boot.
- Verified: `typecheck` ✓ · `npm test` → **295/295** unit ✓ · `build` ✓ (~222 KB gzip JS / ~5 KB gzip CSS) · `test:e2e` → **16/16** ✓ (all existing selector/text hooks intact).

### ✅ Checkpoint 1 — Settings & accessibility core
- **A persisted Settings panel (`O`)** — device-local preferences (separate from the gameplay save) in `localStorage`, **applied live** to the DOM UI overlay (no restart) via CSS variables/classes (`src/game/settings.ts` + `src/render/settings-panel.ts`). Tolerant load (validates/merges/clamps unknown or old data → defaults), plus a **Reset to defaults**.
- **Accessibility options (first batch, all live):** **UI scale** (whole HUD/menus zoom together), **damage-number toggle + size**, **reduced effects** (motion & flashing — tones down crit pops + floating-number rise + UI transitions), and **high-contrast rarity**.
- **Colorblind-safe rarity (baseline, never color-only).** Every item now shows a **text tier tag** (`[C]/[U]/[R]/[E]/[L]/[★]`) **and a per-rarity border *shape*** (solid/dashed/dotted/double) in the inventory, plus the tag on loot toasts — so rarity reads without relying on color ([UX_AND_ACCESSIBILITY](./docs/design/UX_AND_ACCESSIBILITY.md) requirement). High-contrast mode thickens the borders.
- The framework audio volumes (CP3) and keybind remapping (CP4) will plug into next.
- Tests: settings merge/validate (defaults, clamping, enum/`NaN` rejection, JSON round-trip) + colorblind-safe tier tags → **276 unit tests**; a new **settings e2e** (open with `O`, toggle damage numbers off → applies live, change UI scale → live CSS var, **persists across reload**) → **14 e2e**. Build version bumped **`0.6.0-INDEV` → `0.7.0-INDEV`**.

**Verified:** `typecheck` ✓ · `npm test` → 276/276 ✓ · `build` ✓ (~176 KB gzip) · `test:e2e` → 14/14 ✓.

### ✅ Checkpoint 2 — item tooltips & comparison, character stats, destructive-action confirms
- **Hover tooltips with comparison** (the headline). Hovering any inventory/equipped item shows a full breakdown — name (rarity-coloured + tier tag), slot · ilvl, every stat line, the **relic effect**, salvage value — and, for a bagged item, a **"vs equipped"** block with per-attribute deltas (green/red) + the score change. The pure formatting/comparison core lives in `src/sim/loot/item-info.ts` (`itemStatLines` / `itemContributions` / `compareItems`); the DOM tooltip (`src/render/item-tooltip.ts`) sits on `<body>` so it isn't clipped or zoom-scaled.
- **Character stats, in-panel (the C view).** The inventory/character panel now shows a live **derived-stats** strip — primary, Max HP, Armor, Crit, Haste, Leech, Healing, and any typed resists — **each with a tooltip explaining what it does** ("Clarity: tooltips everywhere").
- **Confirmations before destructive actions.** Salvaging a **Rare-or-better** item is now a **one-click confirm** ("Salvage" → "Confirm?"), gated by a new **Confirm destructive actions** setting (default on). Commons/uncommons still salvage in one click.
- Added a `debugGiveItem` test hook (mirrors the existing debug hooks) to drive the inventory e2e deterministically.
- Tests: item-info formatting (percent vs flat, signed), affix labels, stat lines, contributions, and equip-vs-equipped deltas (incl. order + no-change) → **283 unit tests**; an **inventory e2e** (hover → tooltip with stats; Rare salvage asks to confirm before removing the item) → **15 e2e**.

**Verified:** `typecheck` ✓ · `npm test` → 283/283 ✓ · `build` ✓ (~178 KB gzip) · `test:e2e` → 15/15 ✓.

### ✅ Checkpoint 3 — audio controls + a light VFX pass *(kept dependency-free)*
- **Audio volume & mute** (no new dependency — extended the existing procedural WebAudio `Sfx`): all blips now route through a **master GainNode**, driven by two new persisted settings — **Volume** (slider) and **Mute audio** — applied live from the Settings panel's new **Audio** section. Muting skips the synth work entirely. Added a subtle **enemy-death** thud (deaths were previously silent).
- **Low-HP vignette** (VFX/"juice"): a red screen-edge glow that fades in below 35% HP and deepens toward death — a readability cue that **honours reduced-effects** (its intensity is capped, and the curve is a pure, unit-tested function). 
- *(Per owner direction, kept simple: no Howler/sampled-audio dependency this pass — that can come later without disturbing this volume/mute plumbing.)*
- Tests: master-volume clamping + mute validation, and the vignette opacity curve (off above threshold, ramps to a bounded peak, reduced-effects caps it lower) → **287 unit tests**; the Settings e2e now also mutes + sets the volume slider and confirms both **persist across reload** → **15 e2e**.

**Verified:** `typecheck` ✓ · `npm test` → 287/287 ✓ · `build` ✓ (~179 KB gzip) · `test:e2e` → 15/15 ✓.

### ✅ Checkpoint 4 — fully remappable controls + mouse options
- **Fully remappable keybinds** (the headline). A new `src/game/keybinds.ts` maps **23 actions** (movement, sprint, jump, the 10 ability slots, interact, the panels, pause) → `KeyboardEvent.code`, with conflict-free defaults, persisted to `localStorage`. The **InputController** now resolves keys through this map (rebuilt live on change) instead of a hardcoded switch; **Tab** (cycle target) and **Esc** (clear/close) stay fixed, and arrow keys remain an always-on movement fallback.
- **Controls UI in Settings.** A new **Controls** section lists every action with its current key; **click → "Press a key…" → press** rebinds it (capturing the key before the game sees it), automatically **unbinding any conflicting action**. Plus **mouse sensitivity** (slider) and **invert Y** — applied live to the camera look. A **Reset to defaults** now also restores the default bindings.
- Everything **persists and takes effect without restart** (the accessibility acceptance bar): rebinds + mouse options survive reload.
- HUD note: the cast bar, numeric cooldown timers, GCD/affordability dimming, and combat/Shaken state were already in place from earlier phases, so this checkpoint focused on the controls gap. (Buff/debuff *duration icons* + onboarding class-tutorial cards remain optional later polish — not blockers for the accessibility commit list.)
- Tests: keybind defaults/labels/merge/rebind-conflict resolution + mouse-sensitivity clamping/invert-Y validation → **293 unit tests**; a **Controls e2e** (rebind Inventory I→J → it opens the bag in-game and **persists across reload**) → **16 e2e**.

**Verified:** `typecheck` ✓ · `npm test` → 293/293 ✓ · `build` ✓ (~180 KB gzip) · `test:e2e` → 16/16 ✓.

> **0.7.0 "Feel & Finish" is feature-complete** (CP1 settings & accessibility · CP2 tooltips & comparison · CP3 audio + vignette · CP4 remappable controls). The accessibility commit list is in: UI scale, reduced effects, colorblind-safe rarity, damage-number options, confirmations, volume/mute, **remappable keybinds + mouse options** — all persisted, all live. Remaining for the version is **owner playtest** (feel/UX). Next: **0.8.x** optimization & balance pass.

---

## 0.6.0-INDEV — "The Chase" → Equipment Depth + Lv-30 Endgame *(✅ feature-complete — awaiting playtest)*
**Goal:** the beta's long tail — the Lv-30 gear chase: **Legendary** + **Relic** tiers, **3 solo world bosses**, and target-farming → the **Endgame Foundation Gate** ([docs/design/ENDGAME_FOUNDATION.md](./docs/design/ENDGAME_FOUNDATION.md)). Built in verified checkpoints.

### ✅ Checkpoint 1 — Legendary rarity
- **Legendary** (orange, **4 affixes**, ×1.45 budget — the aspirational random-drop tier above Epic): the apex of *rolled* gear (hand-designed **Relics** come in CP3). Distinct loot-beam/bag/vendor colour + toast.
- **Drops as a tail** on the highest-value sources: ~6% on **rare-named** kills and ~1.5% on **elites** (never from standards). **Bad-luck protection** now treats Legendary as rare+ (resets the pity counter; the pity boost raises the Legendary tail too).
- Salvages into the most whetstones and sells for the most gold; reinforces like any item.
- Loot toasts now colour by rarity (rare/epic/legendary) instead of one generic style.
- Tests: Legendary gen (4 affixes, out-budgets Epic), drop tail (rare-named yes / standards never), counts as rare+ for BLP, pity raises the Legendary tail → **204 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 204/204 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

### 🌍 World expansion (owner-requested map pass — between CP1 and CP2)
A presentation/scale pass on the world (no gameplay-systems change), done at the owner's request before CP2. **Deliberately non-destructive to the rest of 0.6.0:** all data shapes, function signatures, enemy families/levels/tiers and named spawns are unchanged, collision is byte-for-byte the same (still only the rock cylinders), and world bosses (CP2) drop into the spread-out zones exactly as before — just with far more room.
- **A big open world.** The greybox grew from a 100 m square into a **680 m** open world (`src/world/layout.ts` centralises `WORLD_SIZE`/`WORLD_RES` + the hub/zone-threshold knobs). The **Greenmarch starter ring stays right outside town** (the first mob is still within melee of spawn — onboarding + the boot e2e depend on it); the **five higher regions are spread far out** in their directions (frontier zones begin at `ZONE_THRESHOLD = 120`), each now a distinct, multi-camp area. `regionAt` keeps the same directional layout at the new scale; spawn coords + Oathstones moved to match (families/levels/tiers preserved → the 1→30 balance + coverage suites still hold).
- **Biomes.** A pure, deterministic **biome field** (`src/world/biomes.ts`) shapes terrain elevation per region — the **Riven Peaks rise into snow-capped mountains** (east), the **Sunken Fen sinks** into a bog (south), Emberreach/Gravereach are raised, Thornwood rolls. The heightfield (sim) and the terrain mesh (render) read the same field, so they agree; the spawn stays flat and a small field (the unit tests' 100 m) is unchanged. Terrain is now **tinted per biome** (snow/rock, scorched red, murky fen, ashen ruins, forest green) with smooth borders.
- **Environmental variety** (was: rocks only). A pure scenery generator (`src/world/scenery.ts`) + an instanced renderer (`src/render/scenery-view.ts`) add **trees** (broadleaf / pine / dead-snag, biome-placed — Thornwood is thick forest, the Peaks are pine), **boulders, pebbles, bushes, grass tufts, Fen reeds, wildflowers**, plus **rivers** (a draped, translucent waterway winding through the heartland) and **roads** fanning from the hub out to each frontier Oathstone. All of it is **purely visual** (instanced, no colliders) and kept clear of camps/waypoints/the hub. Fog + camera far-plane widened for open-world vistas.
- **Follow-up polish** (owner feedback): (1) **organic biome borders** — the biome field is now domain-warped (radius-scaled, so the spawn/heartland stay tame) so zone edges wiggle naturally instead of forming axis-aligned rectangles; (2) **rivers/roads now actually render** — the draped ribbons were built with downward (back-face-culled) normals and sampled too coarsely; fixed the winding (up-facing), densified the terrain-hugging resample, lifted them off the ground, and made them double-sided; (3) **fixed a pre-existing strafe-inversion bug** — A/D were reversed relative to the chase camera (Three's `lookAt` makes screen-right = world −x; movement used +x), so strafing now matches the camera, with a new `movement.test.ts` pinning W/S/A/D to the camera.
- Tests: biome field (flat near hub, mountains east / bog south, directional dominance, bounded factors) + scenery generation (determinism, every layer populated, tree-variant mix, clearings respected, one road per target) + camera-relative WASD (no strafe inversion) → **220 unit tests**; regions retargeted to the new scale; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 220/220 ✓ · `build` ✓ (~169 KB gzip) · `test:e2e` → 11/11 ✓.

### 🧍 Player model + class weapons (owner-requested)
The placeholder capsule is replaced by a **procedural low-poly humanoid** (built from primitives — no asset files) with **class-distinct weapons so other players can read your class at a glance**: the **Warrior** carries a **sword + round shield** (+ a crested helm and shoulder pads), the **Hunter** a **longbow + nocked arrow** (+ a hood), the **Priest** a **glowing staff** (+ a hood and a holy halo). These are **purely cosmetic class identity** — equipped armour/weapons intentionally don't show on the model, leaving a clean seam for a future "show equipped gear" feature to slot in.
- **Procedural animation**: a speed-driven **walk cycle** (swinging legs/arms, body bob) + subtle idle breathing, and a one-shot **sword-swing / bow-draw / staff-cast** motion (the Priest's orb flaring on cast) played when an ability fires. All render-side.
- **Wiring**: a new **additive** sim event `AbilityUsed` — combat emits it the moment a player ability commits (past the target/resource guards), carrying class + targeting + cast time; the renderer subscribes to trigger the matching motion. No gameplay/balance/save change — the only sim touch is the new event.
- **Restyle** (owner feedback): reworked into a **chunkier, blockier, bigger and simpler** figure (a big cube head with simple eyes, thick solid torso/limbs) — dropped the crest, shoulder pads, halo, belt and visor for clean solid blocks, keeping the class weapons as the identity. Animation framework unchanged.
- **Weapon angle + cursor polish** (owner feedback): the **sword and staff now rest at a ~45° forward angle** (no longer dead-vertical through the arm/body), and the **mouse cursor hides while right-click-dragging** the camera (restored on release) so it no longer slides across the screen while you look around.
- Tests: combat emits `AbilityUsed` on a successful cast (and not when the ability whiffs with no target) → **222 unit tests**; e2e green (11). The per-test e2e timeout was raised 30 s → 60 s: the now-large open world renders slowly in the headless software-GL container (each heavy interaction test passes in ~20 s alone but contends under parallel load); real-hardware FPS is unaffected.

**Verified:** `typecheck` ✓ · `npm test` → 222/222 ✓ · `build` ✓ (~172 KB gzip) · `test:e2e` → 11/11 ✓.

### 👹 Enemy models + nameplates (owner-requested)
Every enemy family now has its **own unique low-poly model** (procedural primitives, no asset files) instead of the shared capsule — keyed by family + role so the three shared families split correctly (Sporeling/Sporemother, Bramblekin/Warchief, Ashen Reaver/Ember Warlord). ~21 distinct looks across 7 body archetypes — plant (Bloomhusks/Bramblekin), humanoid (Reavers/Drudges/Forsworn knights), floating (Wisps/Wraiths/Revenants/Cinderborn), spider (Weavers), mushroom (Sporelings/Sporemother), beast (Magmaw/Frostfang/Fenstalker) and crystalline/bone construct (Rimebound/Bonewrought) — each themed to its zone (magma cracks, frost ice, undead bone, blight glow…).
- **Name + level nameplate** above each enemy, in addition to the HP bar: a clean billboarded label (baked to a canvas texture) with the **name coloured by tier** (standard pale · elite orange · rare gold) and the level below, outlined for readability on any background.
- Models **flash on hit / tint during telegraphs** (all body materials, preserving caster/ghost glow), **floating creatures hover**, and the click-to-target raycast hits any part of the model.
- **Perf**: models + nameplates are created lazily for enemies near the camera and freed when they move far away (the open world holds ~80 spawns but only a camp or two is ever close); off-screen models are frustum-culled.
- The three CP2 **world bosses** also get unique, oversized models (a fiery Emberhorn beast, a frost Rimewyrm, the crowned Maelgrith), rendered at boss scale with a crimson nameplate.

**Verified (post-merge with CP2):** `typecheck` ✓ · `npm test` → 238/238 ✓ · `build` ✓ (~177 KB gzip) · `test:e2e` → 12/12 ✓.

### 🐦 Living world — enemy wander + ambient wildlife (owner-requested)
- **Idle enemies now wander.** Out of combat, standard enemies amble to random points within ~4.5 m of their spawn, pause, and repeat (at ~35 % move speed, facing where they walk), so camps feel alive instead of frozen. They stay well within leash range (no drifting between camps); aggro / social / leash are unchanged, and **world bosses loom in place** (no wander). The AI sim-radius widened (60→95 m) to match the enemy view distance so all visible enemies wander smoothly.
- **Ambient wildlife** (`src/render/ambient-life.ts`, render-only — no sim entities): **birds wheel overhead** (a flock that lazily follows you, flapping pale silhouettes), **critters** (rats/rabbits) scurry on the ground nearby in short dart-and-pause bursts, and **butterflies** flit close by. A small fixed pool follows the player around the open world (relocated off-screen), so there's always life nearby without spawning thousands — purely decorative (no collision, not targetable, not saved).
- Tests: idle enemies wander but stay near home; bosses don't wander → **240 unit tests**; e2e green (12).

**Verified:** `typecheck` ✓ · `npm test` → 240/240 ✓ · `build` ✓ (~179 KB gzip) · `test:e2e` → 12/12 ✓.

### ✅ Checkpoint 2 — three solo world bosses
- **Three hand-authored open-world bosses**, one deep in each of the three highest frontiers — **Emberhorn, the Cinder Tyrant** (Emberreach, fire, ~Lv 20), **The Rimewyrm** (Riven Peaks, frost, ~Lv 25), and **Maelgrith, the Hollow Crown** (Gravereach, blight/undead, the **Lv-30 capstone fight**). New `boss` enemy tier + a `Boss` component (`src/sim/content/bosses.ts`); they reuse enemy-ai for locomotion/basic swings and add a thin escalation layer.
- **Multi-phase escalation.** A new **boss-ai** system (`src/sim/systems/boss-ai.ts`) derives the boss's phase from its HP (Emberhorn/Rimewyrm 3 phases at 66 %/33 %; Maelgrith **4 phases** at 75/50/25 %) and announces each shift in the HUD. Later phases throw the heavy attack faster; the existing <30 %-HP enrage gives a desperation finish.
- **Telegraphed heavy attack** (reuses the **`GroundAoe`** primitive, now generalised with a `hitsPlayer` flag): on a per-phase cadence the boss drops a **danger-red zone at your feet that fills as it winds up** (~1.3–1.5 s) — stand in it when it lands and you eat a punishing hit (~27–30 % of a level-geared health bar); **step out and it whiffs.** The readable "move or die" beat that makes a solo boss a fight, not a tank-and-spank.
- **Big HP, solo-beatable.** Tuned against the real stat-derivation + damage formula so every class clears each boss as a genuine **multi-minute** fight (no HP wall, never trivial) and survives its basics; a heavy hurts hard but won't one-shot from full. Bosses are **lone** (no pack rally), leash to a wide arena, and **respawn on a 5-minute cooldown** for repeat farming.
- **Legendary-leaning loot.** A new `boss` drop tier **always drops Rare-or-better** (Epic-leaning, ~15 % Legendary) plus big XP/gold — the best *rolled*-gear source in the game (hand-designed **Relics** still come in CP3). Bosses render larger and deep-crimson; the rare Magmaw formerly named "Emberhorn" was renamed **Scorchmaw** so the boss owns the name.
- Tests: boss spawn shape (tier/HP/well-formed phases), Legendary-leaning loot (always rare+, real Legendary tail), a **solo-balance sim** for all three classes × all three bosses (sane time-to-kill, heavies punish but don't one-shot), phase-event escalation, and the heavy-attack mechanic (lands on a stander, whiffs on a dodger) → **238 unit tests**; a new in-browser **world-boss smoke e2e** (boss spawns huge, the fight runs error-free) → **12 e2e**. Build version bumped **`0.5.0-INDEV` → `0.6.0-INDEV`**.

**Verified:** `typecheck` ✓ · `npm test` → 238/238 ✓ · `build` ✓ (~173 KB gzip) · `test:e2e` → 12/12 ✓.

### ✅ Checkpoint 3 — Relics (hand-designed uniques + effect-hook plumbing)
- **A new apex tier — `relic`** (radiant teal, above Legendary, ×1.55 budget): hand-designed **uniques** with strong fixed stats **and a build-enabling effect**, defined as bespoke data (`src/sim/loot/relics.ts`), not random rolls. Four for the beta, one pool per world boss:
  - **Ashbrand, the Tyrant's Horn** (Emberhorn) — *Execute:* +50 % damage to targets below 35 % HP.
  - **Heart of the Rimewyrm** (the Rimewyrm) — *Boss-slayer:* +20 % damage to world bosses, −15 % damage taken from them.
  - **Crown of the Hollow King** (Maelgrith) — *Reaper:* each kill heals 8 % max HP and cuts all cooldowns by 1.5 s.
  - **Sael's Bloodroot Sigil** (Maelgrith) — *Bloodroot:* critical hits leech 25 % of damage as health.
- **Effect-hook plumbing (the reusable part).** Equipped relics aggregate into a plain-number **`RelicMods`** bundle (recomputed in `recomputeDerived`, like derived stats), and a *small, shared* set of hooks reads it — so the sim never hard-codes any specific relic:
  - `src/sim/combat/apply.ts`: attacker-side **execute** + **boss-slayer** multipliers and **crit-leech**, defender-side **boss damage-reduction** — sitting right beside the existing status multipliers.
  - `src/sim/rewards.ts`: on-kill **heal + cooldown-shave** (Reaper).
  Adding a future relic is "add a def (+ at most one `RelicMods` field & hook read)."
- **Drops & economy.** Relics are the **rarest** drops — an ~8 % tail on a world-boss kill (replacing that kill's normal roll), pulled from that boss's pool. They drop **auto-locked** (no accidental salvage), count as rare+ for **bad-luck protection**, and slot into salvage/vendor/loot-beam/HUD-toast/inventory exactly like any rarity (apex values). Pickup announces the effect; the inventory shows it on hover. **Save-compatible** (a new optional `Item.relic` field; effects re-derive on load).
- **Scope note (faithful to the plan):** relics are class-agnostic **combat-modifier** uniques (the clean foundation the effect-hooks were built for); per-ability relic effects (e.g. "Holy Nova chains") are a natural next extension of the same registry, not in this checkpoint.
- Tests: relic instantiation (rarity/effect/locked), the mods-aggregation bundle (incl. stacking), all four effect hooks driven through the **real** damage + kill code (execute ratio, boss-slayer in/out, crit-leech, reaper heal+CDR), boss drop logic (only from the killed boss's pool; a `rewardKill` integration loop), and **save round-trip** of an equipped relic → **253 unit tests**; e2e green (12).

**Verified:** `typecheck` ✓ · `npm test` → 253/253 ✓ · `build` ✓ (~174 KB gzip) · `test:e2e` → 12/12 ✓.

### ✅ Checkpoint 4 — the Lv-30 endgame loop + target-farming guidance (Endgame Foundation Gate)
- **The Lv-30 chase, made legible.** At the cap (XP already stops mattering) the **Goal Tracker pivots to "Endgame"**: it shows **Relic collection progress (N/4)** and points you at the **next relic to hunt** — naming the boss, its zone + direction, and the relic(s) it drops — then rotates to gear goals ("Reinforce toward the cap", "bosses respawn ~5 min"). No new combat systems: it directs the player through the systems CP1–CP3 already built.
- **A target-farming guide as data** (`src/sim/content/endgame.ts`): composes the bosses + relic pools + loot identities into an ordered **target board** with pure helpers (`relicProgress`, `nextRelicTarget`, `uncollectedRelics`) the UI and tests share.
- **Relic collection tracking** — a new `RelicCollection` component records every relic you've ever obtained (persists even if one is later salvaged); a picked-up relic is marked discovered (`pickUpNearest`), it's **saved** (a new `relics` field, reconciled from owned relics on load so old saves are correct), and it drives the chase's N/4 progress.
- **"Locate" the bosses** — the full **map now plots the three world bosses** as distinct crimson diamonds (with names), so the endgame targets are findable, not hidden (a Gate requirement: *locate → attempt → beat*).
- **Endgame Foundation Gate — automatable scope validated by tests:** every class **beats every world boss solo** with a realistic endgame loadout (full Legendary + that boss's Relic) in a sane time window; the full-Legendary power sits a **bounded** margin above the uncommon baseline (the soft power ceiling stays re-tunable); **target farming yields wanted upgrades within a focused session** (bad-luck protection bounds the dry streak to ≤ ~40 elite kills, and a session accumulates several rare+ candidates); world-boss loot floors at rare+. The **subjective "stays engaging across sessions"** check remains the owner's playtest.
- Tests: guidance data integrity (one target/boss, full non-overlapping relic coverage, locations match `regionAt`, progress/next-target helpers), relic discovery + save persistence, the every-class-beats-every-boss gate (+ bounded power ratio), and the target-farming/BLP guarantees → **270 unit tests**; a new **Lv-30 endgame e2e** (the tracker pivots to the relic chase; the boss-marked map renders error-free) → **13 e2e**.

**Verified:** `typecheck` ✓ · `npm test` → 270/270 ✓ · `build` ✓ (~175 KB gzip) · `test:e2e` → 13/13 ✓.

> **0.6.0 "The Chase" is feature-complete** (CP1 Legendary · world/biome/player-model pass · CP2 world bosses · CP3 Relics · CP4 endgame loop). The automatable scope of the **Endgame Foundation Gate** passes; the subjective retention/feel check is the owner's playtest. Next: **0.7.x** UX/accessibility polish.

---

## 0.5.0-INDEV — "Road to Thirty" → Complete Lv 1–30 Progression *(✅ merged — awaiting playtest)*
**Goal:** the final two regions and the rest of the kit so a character can run **1 → 30** end-to-end across all six zones (→ Level 1–30 Content Gate). Large phase, built in verified checkpoints (CP1–CP3, landed via PRs #16/#17/#19). All of `0.0.1`–`0.5.0` is now merged into `claude/game-design-docs-70dim2`.

> **Housekeeping (state sync):** the build's displayed version was bumped **`0.4.0-INDEV` → `0.5.0-INDEV`** (it had never been bumped during the 0.5.0 work) across `package.json`, `index.html`, the perf overlay, and the e2e check. Full health check on the merged HEAD: typecheck ✓ · 200/200 unit ✓ · build ✓ · 11/11 e2e ✓ · no conflict markers / code smells.

### ✅ Checkpoint 1 — Riven Peaks + Gravereach zones + the undead holy-weakness lever
- **The Riven Peaks (Lv 21–25)** to the **east** — frozen mountains introducing the **frost** damage school: **Rimebound** ice-construct bruisers (tanky, fire-weak), fast **Frostfang** packs, and **Revenant** casters (holy-weak). A **frozen-battlefield elite camp** (an elite *Frost Revenant Lord* + a Rimebound guard) and the roaming rare **Hoarfang the White**.
- **Gravereach (Lv 26–30)** to the **north** — the Hollow Crown, the journey's end: **Wraith** blight-casters, **Bonewrought** bone-construct packs, and **Forsworn Knight** pack-leaders — **all undead and holy-weak**. An **inner-court elite camp** (a *Forsworn Knight-Captain* + bone constructs) and the rare **Gravewarden Sael**.
- **Undead holy-weakness lever**: the Riven Revenants and every Gravereach family carry a **holy vulnerability** (×1.2–1.25), so the **Priest's** holy kit bites hardest in the endgame zones (a bonus, never a gate for other classes).
- **Frost resist** completes the typed-defence set: a new **+Frost Resist** armour affix rolls on gear, feeds `deriveStats → Defense.resist.frost`, and mitigates frost hits (matters but never fully negates) — the natural complement to the frost zone, mirroring how fire/blight resist arrived with theirs.
- **Regions + travel**: `regionAt` now lays out **east = Riven Peaks, north = Gravereach** around the hub; each gets an **Oathstone** (Frostgate Keep, Reclaimed Gatehouse) wired into respawn + fast travel, and the Goal Tracker now guides Lv 21→26→30 and tells you which resist to pack (frost for Riven; "undead are holy-weak" for Gravereach).
- Six new data-driven enemy families reuse the existing archetypes (bruiser / caster / pack-leader); no new systems — pure content + the frost-resist affix.
- Tests: Riven/Gravereach region bands + labels (and no Thornwood leak); new families' damage schools (frost) + the undead holy-weakness; holy damage amplified vs a holy-weak target; frost resist derives/equips/mitigates; high-ilvl armour rolls the frost affix → **169 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 169/169 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 2 — the Lv-30 capstone (upgrade-style; owner-chosen)
- **Each class gets an automatic Lv-30 capstone that *empowers an existing ability*** — no new hotbar button (the hotbar stays a clean 10 slots). At level 30 the class's signature spender becomes its mastered form: **Warrior** *Whirl → "Oathbreaker's Wrath"* (×1.8 damage + wider cleave), **Hunter** *Piercing Arrow → "Rapid Fusillade"* (×1.9), **Priest** *Searing Light → "Dawnbreak"* (×1.9). A real level-30 power/identity spike without UX bloat.
- Data-driven: a `Capstone` on each `ClassDef` + pure `empowerAbility` / `empowerKit` (`src/sim/classes.ts`). Below Lv 30 they're a **no-op (same references)**; at 30 only the target ability is replaced. **Combat** (damage) and the **HUD** (name) both consume the empowered kit, and dinging **30 toasts the capstone unlock**.
- Docs: `CLASS_DESIGN.md` gets an as-built note (the capstone is an upgrade, not an 11th button; the planned third choice node folded into it).
- Tests: capstone targets a real kit ability; below-30 no-op (reference identity); at-30 rename + stronger base/coeff/radius; non-target abilities untouched; the empowered ability deals **more damage through the real formula**; Hunter/Priest spenders empowered → **175 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 175/175 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 3 — full 1→30 validation (the automatable Level 1–30 Content Gate)
- **Spawn table extracted to pure content** (`src/sim/content/spawns.ts`, `WORLD_SPAWNS`): the world's enemy placements are now testable data (no Three.js), with a few standards added to fill level-band gaps (Lv 4/5/10/14/15/20/25/30).
- **Automated gate suites** (no new gameplay — verification + light content tuning):
  - **Spawn coverage**: `WORLD_SPAWNS` spans Lv 1–30, every 5-level band has grindable standards (no XP gaps), every leveling region is populated, and nothing spawns in the safe hub.
  - **Progression 1→30**: each class reaches the level cap (30) on the real XP curve with its full 10-slot kit unlocked and its Lv-30 capstone active.
  - **Combat balance 1→30** (18 class×zone sims through the real stat-derivation + damage formula): every class, at each zone's level with level-appropriate gear, can **kill that zone's tankiest standard with no HP wall** (< 60 casts) and **is not one-shot** (< 80% HP from a single hit). Catches genuine scaling blockers (e.g. armor nullifying damage, casters one-shotting).
- Result: **the 1→30 journey is automatically verified completable + balanced for all three classes** — no blockers surfaced; the content the parallel sessions built holds up.
- Tests: spawn coverage, progression, and combat-balance suites → **200 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 200/200 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

**0.5.0 is now feature-complete** (all 3 checkpoints). The **automatable** scope of the Level 1–30 Content Gate passes; the **subjective 1→30 playthrough feel** awaits owner playtest. After that, the natural next phase is **0.6.0** (equipment depth + the Lv-30 endgame: Legendary/Relic tiers, world bosses).

---

## 0.4.0-INDEV — "Fen & Ember" → Expanded Brackets (Lv 11–20) *(feature-complete — awaiting playtest)*
**Goal:** mid-game depth — Lv 11–20 across **Sunken Fen** + **Emberreach**: deeper kits (interrupt, ground-AoE, choice nodes), a live **resistance** system, new archetypes, elite camps, **Epic** rarity, Reinforcement, and bad-luck protection. Large phase, built in verified checkpoints.

### ✅ Checkpoint 1 — Lv 11–20 kit pt.1 (interrupt + ground-AoE)
- **Interrupt** (Lv 12, off-GCD) for all three classes — *Pommel Strike* / *Scatter Shot* / *Silence*: a new `interrupt` targeting that **cancels a winding-up enemy's telegraph** and applies a **Silence** status; the enemy AI refuses to begin a new wind-up while silenced (the Wisp's blight bolt is now counterable).
- **Ground-AoE tool** (Lv 16) for all three classes — *Earthsplitter* / *Rain of Arrows* / *Consecration*: a new `groundAoE` targeting that drops a `GroundAoe` zone (on the target, or ahead of you) which **ticks damage** in radius for its lifetime, then expires. New pure `ground-aoe` system + a tinted, pulsing ground-disc view.
- **Hotbar expands to 10 slots** (keys 1–9, 0) — input + HUD — to seat the growing 11–20 kit (slots 9 & 0 fill in checkpoint 2 with the choice nodes).
- Tests: interrupt (cancels wind-up + silences + damages; unlock-gated), Silence on the enemy AI (no new telegraph), ground-AoE (ticks then despawns; placed on the target) → **134 unit tests**; e2e green (10).

- Verified: `typecheck` ✓ · `npm test` → 134/134 ✓ · `build` ✓ · `test:e2e` → 10/10 ✓.

### ✅ Checkpoint 2 — Lv 11–20 kit pt.2 (choice nodes / talents)
- **Choice nodes** (Lv 14 & Lv 18) for all three classes — a **pick-one-of-two** talent per hotbar slot, producing distinct play: Warrior *Rallying Cry vs Bloodthirst* / *Unbreakable vs Ravager*; Hunter *Aimed Shot vs Explosive Trap* / *Barrage vs Camouflage*; Priest *Penance vs Holy Fire* / *Divine Aegis vs Divine Star*. These fill hotbar slots 9 & 0.
- **Dynamic kit**: `ClassDef.choiceNodes` + `resolveKit(cls, choices)` assemble the ordered kit (8 base + one per node = 10, fixed length). Combat, HUD, and cooldown sizing read the resolved kit; the pick lives on `PlayerClass.choices` and **persists in the save**.
- **Talents UI**: a *Talents* section in the bag/character panel (I/C) — pick A or B per unlocked node, **out of combat**; locked nodes show their unlock level. Swapping resets that slot's cooldown.
- Tests: `resolveKit` ordering + swap, distinct-play (default node A buffs vs option-1 deals damage), unlock gating, save round-trip → **140 unit tests**; a talents-swap e2e (level up → pick the other option → hotbar slot updates) → **11 e2e**. New debug hooks (`debugSetLevel`, `debugTeleport`) for testing.

**Verified:** `typecheck` ✓ · `npm test` → 140/140 ✓ · `build` ✓ (~162 KB gzip) · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 3 — resistance system live + support/pack-leader archetypes
- **Resistance live**: typed mitigation (the `damage.ts` formula already had it) now actually flows from gear — two new defensive affixes (**+Fire Resist**, **+Blight Resist**) roll on armour, feed `deriveStats` → `Defense.resist`, and reduce incoming typed hits (e.g. a Wisp's blight bolt). Tuned to *matter but never fully negate* (and never gate content). Resist is scored for upgrade deltas.
- **Support archetype** — the **Sporemother**: hangs back and **heals the most-wounded nearby ally** on a cadence instead of attacking (kill-the-healer play). Tinted teal-green.
- **Pack-leader archetype** — the **Bramble Warchief**: a bruiser that **rallies nearby allies** with an `Empowered` buff (+25% outgoing damage) while it fights. Tinted banner-red. New `Status.Empowered` read by the shared damage applier.
- A preview pair (Sporemother tending the Sporeling swarm + a Warchief rallying the Bramblekin) is dropped into Thornwood now; proper Fen/Ember camps follow in CP4.
- Tests: resist derives from gear + equipping sets `Defense.resist` + blight resist mitigates; support heals a wounded ally; pack-leader empowers allies; an Empowered attacker hits harder → **146 unit tests**; e2e green (11).

- Verified: `typecheck` ✓ · `npm test` → 146/146 ✓ · `build` ✓ · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 4 — Sunken Fen + Emberreach zones + elite camps
- **The Sunken Fen (Lv 11–15)** to the **south** — a blight bog: **Drudge** bruisers, **Fenstalker** ambushers (high aggro), and **Mireling** casters, all dealing **blight** (so the new blight resist matters). A **crypt-approach elite camp** (an elite *Crypt Drudge* backed by a Sporemother healer) and the rare **Henge-Keeper** deep in the bog.
- **The Emberreach (Lv 16–20)** to the **west** — scorched highlands: **Magmaw** heavy beasts, **Ashen Reaver** skirmishers, and **Cinderborn** casters (big fire telegraphs → interrupt/ground-AoE them), all dealing **fire**. A fire-cult **warcamp elite camp** (an **Ember Warlord** pack-leader + an elite *Cult Pyremaster* caster) and the roaming rare **Emberhorn**.
- **Regions + travel**: `regionAt` now lays the world out directionally around the hub (NE woods · south bog · west scorch); each new zone gets an **Oathstone** (Fenhollow Camp, Windbreak Outpost) wired into respawn + fast travel, a minimap tint, and a zone-discovery prompt. The Goal Tracker now points you to the next zone + the resist to pack.
- Six new data-driven enemy families reuse the existing archetypes (incl. CP3 support/pack-leader); no new systems — pure content.
- Tests: Fen/Ember region bands + labels, the new families' damage schools (blight/fire) + the Warlord's pack-leader archetype → **150 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 150/150 ✓ · `build` ✓ (~162 KB gzip) · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 5 — Epic rarity + Reinforcement + bad-luck protection
- **Epic rarity** (purple, **3 affixes**, ×1.32 budget — the "strong build piece" tier): rolls on the **elite** drop table (a ~7% tail) and the **rare-named** table (~15% tail); never from standards. Loot beams, the bag, and the vendor panel show the new purple; colourblind-safe tier text/labels unchanged. Epic salvages into more whetstones and sells for more gold.
- **Reinforcement** (`src/sim/reinforce.ts`) — the optional gold + whetstone **upgrade sink** (ADR-010): spend currency to add **+1..+5 effective item levels** to a piece you own, strengthening its **base stats** (primary + armor) and rescoring it. Rising per-step cost, hard cap at +5 (stays below the next rarity's natural power). A **⚒ Reinforce** button on every bag **and equipped** item shows the next step + cost; reinforcing equipped gear recomputes derived stats live. Items carry a `reinforced` step count that **persists in the save**.
- **Bad-luck protection v1** (`LootLuck` component + `pityMultiplier`): a **pity counter** rises on every kill that doesn't drop rare-or-better and **boosts the rare+ weight** (+8%/kill, capped +200%); it **resets to 0** the moment a rare+ finally drops. Makes target-farming elites/named feel fair without hidden total-drop inflation. Persists in the save.
- Tests: Epic gen (3 affixes, out-budgets Rare) + epic drop tails (elite/rare yes, standard never); pity multiplier ramp + cap; **`rewardKill` BLP integration** (pity climbs on unlucky kills, resets on a rare+ drop); Reinforcement cost ramp, currency spend, stat/score boost, +5 cap, affordability gate, **equipped-armor recompute**, and reinforced+pity save round-trip → **161 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 161/161 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

**0.4.0 is now feature-complete** (all 5 checkpoints done). Awaiting owner playtest of the full Lv 11–20 experience (zones, mechanics, Epic/Reinforcement chase) before closing the bracket and moving to **0.5.0** (Lv 21–30 / the complete 1–30 journey).

---

## 0.3.0-INDEV — "First Ten Levels" → Level 1–10 Gate *(feature-complete — awaiting gate playtest)*
**Goal:** a polished first bracket for all three classes (the **breadth** band). Large phase, built in verified checkpoints.

### ✅ Checkpoint 1 — ability unlocks + complete Lv 1–10 kits
- **Ability unlock system**: each ability has an `unlockLevel`; the combat system refuses locked abilities, and the hotbar shows locked slots as `Lv N` (greyed). Level up to learn the kit.
- **Complete Lv 1–10 kits** for all three classes (6 abilities each, hotbar keys 1–6):
  - **Warrior** + **Charge** (Lv 7, off-GCD gap-closer: leap to target, build Fury, root it) + **Second Wind** (Lv 9, self-heal scaling with **missing HP**).
  - **Hunter** + **Hunter's Mark** (Lv 5, applies a **vulnerability** debuff — the target takes +12% damage).
  - **Priest** kit assigned unlock levels (Smite/Searing 1 · Holy Nova 3 · Mend 5 · Aegis 7 · Atonement 9).
- New mechanics: `charge` targeting (gap-closer), missing-HP healing rider, and a `Marked` vulnerability handled in the shared damage applier.
- Tests: unlock gating (locked → no fire; unlocked → fires), Charge (closes distance + roots), Second Wind (heals), Hunter's Mark (marked targets take more) → **104 unit tests**; e2e green (8).

### ✅ Checkpoint 2 — Thornwood Vale + enemy tiers + Rare loot
- **Data-driven enemies** (`src/sim/content/enemies.ts`): a template table (shared level curve + per-template overrides) and a generic `spawnEnemy` with **tier multipliers**. `createBloomhusk/Reaver/Wisp` are now thin wrappers.
- **Thornwood Vale (zone 2)** families, placed out to the north-east (Lv 6–8): **Weaver** (fast melee swarm), **Bramblekin** (slow, heavy-armour bruiser), **Sporeling** (fragile fungal swarm).
- **Enemy tiers**: **elite** (×5 HP, ×1.5 dmg, ×5 XP, longer respawn) with an **enrage below 30% HP**, and a **rare-named** (×8 HP, ×12 XP, unique name) — both visually larger/tinted. A Greenmarch elite anchor (*Bloomhusk Matriarch*) and a Thornwood rare (*Old Thornback*).
- **Rare** rarity (blue, 2 affixes, ×1.20 budget) + **tier-aware drop tables** (standards lean common/uncommon; elites add Rare; rare-named mostly Rare). Loot beams + inventory show the new colour.
- Tests: data-driven spawn + tier scaling, Rare item gen, tier loot weights → **108 unit tests**.

### ✅ Checkpoint 3 — Oathstones, fast-travel + vendors
- **Oathstones** (`Oathstone`/`Respawn` components + `waypoint` system): waypoint shrines that **attune on proximity** and **bind your respawn** to the last one visited (death returns you there, not the world spawn — no XP loss). Activated stones + the bound point **persist in the save**. A hub stone at spawn auto-attunes; one waystation per region (Greenmarch, Thornwood Vale).
- **Fast travel** (`src/sim/travel.ts`, panel on **T**): hop between **attuned** Oathstones for a **small gold toll**, **out-of-combat only** — the discovered-waypoint network. Travelling rebinds your respawn to the destination.
- **Vendors** (`src/sim/vendor.ts`, panel on **F** by a stall): **sell** unwanted gear for gold (value scales with ilvl + rarity), with a **Sell all Common** button; locks are respected. A *Quartermaster* sits at the hub. Gold sink (toll) + source (sales) per the economy design.
- **Centralized interact**: the loot system no longer reads input; **F** is routed in one place — close an open vendor panel → pick up nearby loot → else open a vendor. Loot pickup is now `pickUpNearest` (pure, testable).
- **World markers**: Oathstone obelisks (dormant grey → bright cyan + pulse once attuned) and vendor posts, scanned from the world each frame.
- Tests: Oathstone attune/respawn-binding/save round-trip, vendor value/sell/lock/sell-commons/range, fast-travel toll/combat-gate/gold-gate/dormant/here → **123 unit tests**; an Oathstone-attune + fast-travel-panel e2e (9 e2e).

### ✅ Checkpoint 4 — onboarding + HUD/map v1
- **Onboarding / Goal Tracker** (`src/sim/onboarding.ts`, pure like Telemetry): a "teach the loop" checklist — **move → select a target → defeat an enemy → loot (F) → equip (I) → recover** — driven by sim events + player state. Completion persists (localStorage) so returning players skip it.
- **Goal Tracker HUD** (`src/render/goal-tracker.ts`): the dismissible "what now?" panel once onboarding is done — **level + XP to next**, **current zone + level range**, and a few **soft goals** (next bracket/zone, gear upgrade, fast-travel/rare hunt).
- **Regions** (`src/sim/content/regions.ts`, pure): `regionAt`/`regionLabel` for the canonical bands — **Oathhold** (hub) · **The Greenmarch** (1–5) · **Thornwood Vale** (6–10). Crossing a boundary shows a zone-discovery prompt.
- **Minimap + Map v1** (`src/render/minimap.ts`): an always-on, player-centred canvas minimap (region tint, Oathstones bright/dim by attune state, vendor, live enemies, a facing player-arrow) with a zone label; **M** toggles a large world-anchored map with named Oathstones. (Fast travel stays on **T** for v1.)
- Tests: regions point-lookup + labels, onboarding step completion from state/events + skip → **129 unit tests**; a Goal-Tracker/minimap/map-toggle e2e (10 e2e).

**0.3.0 is now feature-complete** — the automatable scope of the **Level 1–10 Gate** is in. The remaining sign-off (each class *feels* solo-viable 1→10; readable/soloable elite + rare; onboarding genuinely ≤2 min) is **owner playtest**.

**Verified:** `typecheck` ✓ · `npm test` → 129/129 ✓ · `build` ✓ (~161 KB gzip) · `test:e2e` → 10/10 ✓.

---

## 0.2.1-INDEV — "The Priest" → Three-Class Gate
**Goal:** the third class — a **Priest** who fights with holy power and survives by weaving heals, shields, and Atonement — completing the three operational classes. Targets the [Three-Class Gate](./docs/production/RELEASE_GATES.md#4-three-class-gate).

**Added**
- **Priest** (holy/SPR/Mana) in the class registry. Early kit: **Smite** (holy projectile filler), **Searing Light** (cast-time nuke), **Holy Nova** (PBAoE + self-heal), **Mend** (self-heal), **Aegis** (absorb shield), and **Atonement** (toggle: a share of spell damage heals the caster). Class-select now offers all three.
- **Healing system** (`src/sim/combat/heal.ts`): same shape as damage (base + coeff·SPR + **+Healing** affix), can crit; green floating numbers.
- **Shields** (`Shield` component): an absorb pool that soaks damage before HP (Aegis), decaying over its duration; shown on the HP bar.
- **Cast-time mechanic** (`CastState`): Searing Light channels a bar (HUD cast bar), resolves on completion, and **cancels if you move**.
- **Caster enemy** — the Greenmarch **Wisp**: stands and casts a telegraphed **blight** bolt that **bypasses armor** (typed `Enemy.attackType`), countered by LoS/burst. The camp is now Bloomhusks + Reavers + a Wisp.
- **Three-Class balance pass**: a combat-sim gate test runs all three classes vs a same-level standard and asserts each lands in the **3–6s TTK band** with the inter-class spread within tolerance; Priest holy damage (armor-ignoring) and Atonement sustain are tuned so it is **not** a weak healer.
- Tests: Priest mechanics (Smite/Mend/Aegis-soak/Atonement-leech/cast resolve+cancel), the **Three-Class Gate TTK** sim, class registry → **100 unit tests**; a "play as the Priest" e2e (8 e2e).

**Verified (automated):** `typecheck` ✓ · `npm test` → 100/100 ✓ · `build` ✓ (~154 KB gzip) · `test:e2e` → 8/8 ✓ (all three classes deal damage; save/reload). Warrior + Hunter + all prior systems remain green.

**Three-Class Gate (automatable parts) ✓:** all three solo a same-level standard; each TTK in band; inter-class spread within tolerance; Priest deals real holy damage (not a weak healer); Warrior is a bruiser (not a slow tank); Hunter uses no pet. The **subjective** parts (each class *feels* solo-viable end-to-end; elite soloable with correct play) remain owner-playtest — the camp now spans all three enemy archetypes to exercise it.

**Tuning note:** balance numbers are `v1` targets; precise inter-class parity is telemetry-tuned over many seeded matchups (per [TEST_STRATEGY](./docs/qa/TEST_STRATEGY.md)). The unit gate guards the band + gross imbalance.

**Not included (by design):** zones beyond Greenmarch, other families, elites/rares, interrupts (L12 kit), full kits past the early game, Reinforcement, consumables.

**How to test**
```bash
npm install && npm run dev   # pick Warrior / Hunter / Priest
# Priest: 1 Smite · 2 Searing Light (cast) · 3 Holy Nova · 4 Mend · 5 Aegis · 6 Atonement
```

**Next phase →** `0.3.0` "First Ten Levels" → **Level 1–10 Gate**: full Lv 1–10 ability unlocks for all classes, **Thornwood Vale** (zone 2) + its families, the first **elite** and **rare-named**, the full equipment slot set up to **Rare**, vendors/Oathstones/fast-travel, and onboarding. (This begins the **breadth** band — appropriate now that the Three-Class Gate is met.)

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

# Changelog

Development proceeds **one phase at a time** (see [docs/production/VERSION_ROADMAP.md](./docs/production/VERSION_ROADMAP.md)).
Each entry is an **independently testable build**. After each phase, work pauses for testing before the next begins.

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

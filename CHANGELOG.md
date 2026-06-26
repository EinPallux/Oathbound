# Changelog

Development proceeds **one phase at a time** (see [docs/production/VERSION_ROADMAP.md](./docs/production/VERSION_ROADMAP.md)).
Each entry is an **independently testable build**. After each phase, work pauses for testing before the next begins.

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

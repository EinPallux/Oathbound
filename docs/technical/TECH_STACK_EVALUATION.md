# Tech Stack Evaluation

Recommended stack and the reasoning behind each choice. **Nothing is installed yet.** For every major choice we state: why it fits, what complexity it adds, alternatives considered, multiplayer-friendliness, and whether it's needed before 1.0-BETA. Hard decisions are also captured as [Decision Records](../decisions/DECISION_RECORDS.md).

> Guiding rule: **pick the simplest thing that stays maintainable across the whole roadmap.** Don't choose tech because it's popular. Hordes.io's own author validated *starting* on Three.js before any custom-engine work — see [HORDES_IO_ANALYSIS](../research/HORDES_IO_ANALYSIS.md#6-technical-lessons-relevant-to-a-modern-threejs-project).

## Summary table
| Concern | Choice | Alt considered | Needed for beta? |
|---|---|---|---|
| Language | **TypeScript** | JavaScript | Yes |
| Build/dev | **Vite** | Webpack, esbuild-only, Parcel | Yes |
| 3D renderer | **Three.js (raw)** | React Three Fiber, Babylon.js, PlayCanvas, custom WebGL | Yes |
| UI | **DOM/HTML + CSS overlay** | Canvas/WebGL UI, R3F+drei HTML | Yes |
| UI reactivity | **Tiny custom signal/store** | Redux, Zustand, MobX, lit | Yes (minimal) |
| Architecture | **Lightweight ECS-lite + fixed-timestep sim** | Heavy ECS lib, pure OOP, plain composition | Yes |
| Save | **IndexedDB (idb) + JSON export** | localStorage only, OPFS | Yes |
| Content data | **Typed TS data modules + zod validation at boundaries** | JSON+schema, CMS, sqlite-wasm | Yes |
| Physics/collision | **Custom kinematic controller (no engine)** | Rapier, cannon-es, ammo | No engine for beta |
| Navigation | **Steering + ground raycasts (+ optional grid)** | recast/navmesh, full A* everywhere | Cheap version only |
| Audio | **Howler.js behind an AudioService** | raw Web Audio, Tone.js | Yes (thin) |
| Workers | **Optional, behind interfaces** | mandatory worker sim | Not required for beta |
| Tests | **Vitest (unit) + Playwright (browser/perf)** | Jest, Cypress | Yes |
| Deploy | **Vercel static (Vite output)** | Netlify, GH Pages, Cloudflare | Yes |

## Per-choice rationale

### TypeScript — *yes*
- **Fit:** a content-and-systems-heavy game benefits enormously from typed item/ability/enemy/save schemas; refactors across the long roadmap stay safe.
- **Complexity:** build step + types discipline (already implied by Vite).
- **Multiplayer:** typed message/state contracts ease a future client/server split.

### Vite — *yes*
- **Fit:** instant dev server/HMR, first-class TS, trivial static build for Vercel, easy code-splitting for per-zone assets.
- **Complexity:** low; standard.
- **Alt:** Webpack (heavier), esbuild alone (less batteries-included).

### Three.js, raw (not R3F) — *yes* · [ADR-001](../decisions/DECISION_RECORDS.md#adr-001-raw-threejs-vs-react-three-fiber)
- **Fit:** a game needs an explicit, owned **game loop** and direct control over the scene graph, instancing, pooling, and update order. Raw Three.js gives that with minimal abstraction and the best perf headroom.
- **Complexity:** we write our own loop/lifecycle (acceptable — see [ARCHITECTURE_PLAN](./ARCHITECTURE_PLAN.md)).
- **Alt — R3F:** great DX for React UIs, but it ties the render loop to React's reconciler and adds overhead/foot-guns for a high-entity action game; rejected for the core scene (we may still use plain React/DOM-free patterns for UI — see UI below).
- **Alt — Babylon/PlayCanvas:** fuller engines, heavier, less idiomatic for a hand-tuned tiny client; rejected.
- **Alt — custom WebGL:** premature; Hordes.io only did this *years in* at massive scale. Rejected for beta.
- **Multiplayer:** rendering is decoupled from simulation, so the renderer is unaffected by a future networked sim.

### UI: DOM/HTML + CSS overlay — *yes* · [ADR-002](../decisions/DECISION_RECORDS.md#adr-002-ui-technology)
- **Fit:** crisp text, tooltips, inventory grids, accessibility (focus, scaling, screen-reader hooks), and fast iteration are all dramatically easier in DOM than in canvas-drawn UI. The 3D canvas sits beneath an HTML overlay.
- **Complexity:** must sync UI with game state (solved by the small store below) and manage pointer-event passthrough.
- **Alt — canvas/WebGL UI:** maximal control & one render path, but reinvents text/layout/accessibility; rejected.
- **Reactivity:** a **tiny custom signal/store** (subscribe/notify) — not Redux/MobX. Keeps bundle small and the data-flow obvious. (We may render UI with vanilla TS or a featherweight lib; no heavy framework required.)

### Architecture: ECS-lite + fixed-timestep — *yes* · [ADR-006](../decisions/DECISION_RECORDS.md#adr-006-ecs-vs-simpler-architecture)
- **Fit:** entities (player, enemies, projectiles, loot) with composable data components and systems (movement, combat, AI, loot) scale cleanly and keep **simulation logic out of rendering**.
- **Complexity:** we adopt a *pragmatic* ECS-lite (ids + plain-data components + system functions), **not** a heavy ECS framework (avoid premature enterprise architecture).
- **Alt:** pure OOP entity classes (fine early, gets tangled with cross-cutting systems); heavy ECS libs (overkill). Detail in [ARCHITECTURE_PLAN](./ARCHITECTURE_PLAN.md).

### Save: IndexedDB via `idb` + JSON export — *yes* · [ADR-005](../decisions/DECISION_RECORDS.md#adr-005-save-storage)
- **Fit:** character + inventory + world flags exceed comfortable localStorage size/perf; IndexedDB handles structured, versioned data and async writes without jank.
- **Complexity:** async API (wrapped by `idb`), migration code.
- **Alt:** localStorage (use only for small settings); OPFS (overkill now). Detail in [SAVE_SYSTEM_PLAN](./SAVE_SYSTEM_PLAN.md).

### Content data strategy — *yes*
- **Typed TS modules** for content (items/abilities/enemies/zones) give editor autocomplete + compile-time checks; **zod** validates external/untrusted boundaries (imported saves, future server payloads). Detail in [CONTENT_DATA_STRATEGY](./CONTENT_DATA_STRATEGY.md).

### Physics/collision: custom kinematic, no engine — *yes* · [ADR-008](../decisions/DECISION_RECORDS.md#adr-008-collision--navigation)
- **Fit:** we need character-vs-terrain + simple static colliders + range/LoS raycasts — not rigid-body dynamics. A capsule-vs-heightfield + box/cylinder volume controller is cheap and predictable.
- **Complexity:** we own the controller math.
- **Alt — Rapier (wasm):** excellent, but adds payload, a wasm boundary, and determinism/complexity we don't need for beta; **re-evaluate** if real physics interactions are added later.
- **Multiplayer:** a simple, deterministic-ish controller is easier to make server-authoritative later.

### Navigation: cheap steering — *yes*
- Enemies use steering + ground raycasts + local avoidance; optional per-zone grid for chokepoints. **No recast/navmesh** for beta (cost/scope). Pathfinding cost is a tracked [risk](../production/RISK_REGISTER.md).

### Audio: Howler.js behind a service — *yes*
- **Fit:** Howler handles browser audio quirks, pooling, and spatial-ish playback with little code; wrapped by an `AudioService` so it can be swapped for raw Web Audio later.
- **Alt:** raw Web Audio (more code), Tone.js (music-focused, heavier).

### Web Workers — *optional, not required for beta*
- Architecture keeps heavy/parallelizable work (procedural gen, pathfinding bursts) behind interfaces so it *can* move to a worker if profiling demands — but we don't mandate workers for beta. (Note: WebGL stays on the main thread.)

### Testing: Vitest + Playwright — *yes*
- **Vitest** for pure logic (damage math, item-gen, XP curve, save migration) — fast, Vite-native. **Playwright** for browser smoke, input, zone-transition, and perf checks (uses the pre-installed Chromium). Detail in [TEST_STRATEGY](../qa/TEST_STRATEGY.md).

### Deploy: Vercel static — *yes*
- **Fit:** Vite build → static assets → Vercel CDN. No serverless/backend/DB for beta. Detail in [VERCEL_DEPLOYMENT_PLAN](./VERCEL_DEPLOYMENT_PLAN.md).

## Dependency philosophy
Keep the dependency list **short and legible**. Core runtime deps target: `three`, `idb`, `howler`, `zod` (+ dev: `vite`, `typescript`, `vitest`, `@playwright/test`). Every added dependency must justify its bundle cost against the [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md). Avoid large frameworks and avoid premature multiplayer/networking libraries entirely for the beta.

## What we deliberately do NOT adopt for beta
React/Redux/MobX as core; a full physics engine; a navmesh library; a networking stack; an asset CMS; a state-sync/ECS megaframework. All are reconsidered (if ever) at the [post-beta horizon](../production/POST_BETA_MMO_HORIZON.md).

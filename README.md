# Oathbound

A planned **3D browser-based, solo-friendly fantasy MMORPG** built with TypeScript + Three.js, deployable to Vercel with no account, no backend, and no database required for its first public milestone (**1.0-BETA**).

> **Status: early scaffold (`0.0.2-INDEV`).** The full game blueprint lives in [`/docs`](./docs/README.md). Implementation is proceeding **one phase at a time** (see [`CHANGELOG.md`](./CHANGELOG.md) and the [Version Roadmap](./docs/production/VERSION_ROADMAP.md)); each phase is an independently testable build.

## What is Oathbound?

You take up a broken **Oath** to protect the region of **Aldermere**. Choose one of three classes — **Warrior**, **Hunter**, or **Priest** — explore a compact open world, grind monsters, grow stronger, find increasingly exciting equipment, develop a build, reach **level 30**, and keep hunting for valuable gear.

It is intentionally a **chill, solo-first** experience that *feels* like a small but genuine MMORPG world, while honestly remaining a **local single-player** game for the 1.0-BETA milestone. Real multiplayer is a clearly-scoped post-beta horizon, not a hidden simulation.

## Start here

👉 **[docs/README.md](./docs/README.md)** — the documentation index and reading order.

## Development

```bash
npm install        # install dependencies
npm run dev        # start the dev server (http://localhost:5173)
npm test           # unit tests (Vitest)
npm run test:e2e   # browser smoke test (Playwright)
npm run build      # typecheck + production build (outputs dist/)
```

**Current build (`0.0.2-INDEV`):** opens to a lit 3D scene of 144 instanced spinning
cubes (one draw call) driven by an ECS-lite world on a fixed-timestep loop, with a live
performance overlay (FPS, frame time, draw calls, entities, sim steps). This validates
the rendering + loop + ECS foundation; movement and gameplay arrive in later phases.

## Guardrails (read before any coding session)

- Do **not** copy Hordes.io content, assets, names, lore, classes (beyond common archetypes), maps, balancing, or code. It is a *design reference only*.
- Do **not** implement raids, dungeons, accounts, networking, or any deferred MMO system before the level 1–30 solo loop is polished. See [Deferred Features](./docs/production/DEFERRED_FEATURES.md).
- All player power and progression must remain **fully solo-viable**.
- Keep it **deployable to Vercel** as a static build; no server, account, or database before the post-beta MMO horizon.

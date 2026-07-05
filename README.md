# Oathbound

A **3D browser-based, solo-friendly fantasy MMORPG** built with TypeScript + Three.js. Play solo offline, or host a small **authoritative server** and play online with friends on a Linux VPS.

> **Status: `0.8.0-ONLINE.7`.** The full 1–30 solo game is playable, and the online track (accounts, an authoritative Node server, SQLite persistence, chat, VPS deploy) is built through **M7 "Ops & Hardening"** — see [`CHANGELOG.md`](./CHANGELOG.md) and the live status in [`AGENTS.md`](./AGENTS.md). Development proceeds **one phase at a time**; each phase is an independently testable build. The full blueprint lives in [`/docs`](./docs/README.md).

## What is Oathbound?

You take up a broken **Oath** to protect the region of **Aldermere**. Choose one of three classes — **Warrior**, **Hunter**, or **Priest** — explore a compact open world, grind monsters, grow stronger, find increasingly exciting equipment, develop a build, reach **level 30**, fight world bosses, and keep hunting for valuable gear.

It stays a **chill, solo-first** experience: all power and progression are fully solo-viable. The online mode adds shared PvE (threat, shared XP, instanced loot, boss HP scaling that respects solo balance) without turning it into a grind-with-others.

## Two ways to play

- **Solo / offline** — a static build (works on Vercel or any static host). Saves live in the browser (IndexedDB). No account, no server.
- **Online with friends** — an authoritative Node server (WebSocket, isomorphic sim) with SQLite-backed accounts and characters, self-hosted on a small Linux VPS. See the [VPS Hosting Guide](./docs/technical/VPS_HOSTING_GUIDE.md) and the ops kit in [`deploy/`](./deploy/README.md).

The gameplay simulation (`src/sim`, `src/core`, `src/world`, `src/net`) is **isomorphic** — the exact same code runs in the browser and on the server; only rendering (`src/render`, three.js/DOM) and the Node server (`server/`) are environment-specific.

## Start here

👉 **[docs/README.md](./docs/README.md)** — the documentation index and reading order.
👉 **[AGENTS.md](./AGENTS.md)** — current build status, workflow, repo map, and conventions (read this before contributing).

## Development

```bash
npm install            # install dependencies
npm run dev            # solo dev server (http://localhost:5173)
npm test               # unit tests (Vitest)
npm run test:e2e       # browser smoke tests (Playwright)
npm run build          # typecheck + production client build (→ dist/)

# Online server
npm run server:dev     # run the authoritative server locally (port 8080)
npm run typecheck:server
npm run server:test    # persistence + auth regression
npm run server:build   # bundle the server (→ dist-server/)
npm run server:loadtest # headless bot soak against a running server
```

To play online locally: run `npm run server:dev`, then open the client with `?server=ws://127.0.0.1:8080/ws`.

## Conventions (non-negotiable)

- Keep gameplay logic (`src/sim`, `src/core`, `src/world`, `src/net`) free of `three`/DOM **and** Node-only APIs — it must run in both the browser and Node. Rendering only reads sim state; server-only code lives in `server/`.
- All player power and progression must remain **fully solo-viable** (see [Solo Balance Rules](./docs/design/SOLO_BALANCE_RULES.md)).
- Do **not** copy Hordes.io content, assets, names, lore, maps, balancing, or code — it is a *design reference only*.

## License / credits

See [`CREDITS.md`](./CREDITS.md).

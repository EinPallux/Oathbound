# Vercel Deployment Plan

> **⚠️ Applies to the SOLO/offline build only (superseded for online by ADR-013).** The static Vercel path here still works for the solo game. Online play is **not** static/serverless — it runs an authoritative Node server + SQLite on a Linux VPS (Caddy serves the client and proxies the WebSocket). See [VPS_HOSTING_GUIDE](./VPS_HOSTING_GUIDE.md) and the [`deploy/`](../../deploy/README.md) kit.

Oathbound ships as a **static single-page app** built by Vite and served from Vercel's CDN. **No backend, serverless functions, database, or accounts** for 1.0-BETA (per the brief and [DEFERRED_FEATURES](../production/DEFERRED_FEATURES.md)).

## Build & output
- `vite build` → static `dist/` (HTML, JS chunks, CSS, hashed assets).
- **Framework preset:** "Vite" (or "Other" with `outputDirectory: dist`). No server runtime needed.
- **Code-splitting:** per-zone asset/content chunks load on demand ([RENDERING_AND_PERFORMANCE](./RENDERING_AND_PERFORMANCE.md)); the initial bundle stays within the [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md).

## Project config (planned `vercel.json` essentials)
- Static output; SPA fallback (rewrite unknown routes → `/index.html`) if we use client routing.
- **Caching headers:** long-lived immutable caching for hashed assets (`/assets/*`), short cache for `index.html`.
- **Security headers:** sensible defaults (e.g., `X-Content-Type-Options: nosniff`, a permissive-but-safe `Content-Security-Policy` allowing self + needed asset origins, `Referrer-Policy`). No third-party trackers.
- Ensure correct MIME for `.wasm`/`.glb`/audio if used; enable compression (Vercel handles gzip/br).

## Environments
- **Production:** the `main`/release branch → production domain.
- **Preview deploys:** every branch/PR gets a Vercel preview URL — used for the browser-compat and playtest passes ([PLAYTEST_PLAN](../qa/PLAYTEST_PLAN.md)).
- Current development branch: `claude/game-design-docs-70dim2` (docs only; no deploy yet).

## CI before deploy (planned)
On push/PR: typecheck → `vitest` unit suite → `vite build` → `@playwright/test` smoke + perf check on the preview/build. A red gate blocks promotion to production. See [TEST_STRATEGY](../qa/TEST_STRATEGY.md).

## Performance & delivery
- Assets served from CDN with compression; initial download budget and total-asset budget enforced ([PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md)).
- A lightweight **loading screen** covers initial bundle + first-zone asset fetch; subsequent zones stream on demand.
- Optional: a tiny **service worker** to cache static assets for fast repeat loads and offline-capable play (evaluated; not required for beta — the game is local anyway).

## Privacy & telemetry
- **No backend telemetry.** Any playtest metrics stay **on-device** and are **export-only** ([PLAYTEST_PLAN](../qa/PLAYTEST_PLAN.md#local-telemetry-no-backend)). No accounts, no PII, no analytics SDKs in public builds.

## What is explicitly NOT deployed for beta
Serverless API routes, edge functions, a database, auth providers, websockets/realtime, or any multiplayer infrastructure. These belong to the [POST_BETA_MMO_HORIZON](../production/POST_BETA_MMO_HORIZON.md) and would change the hosting model (a static CDN app cannot host an authoritative game server).

## Rollback & reliability
- Vercel keeps immutable deployments → instant rollback to a previous good build if a release regresses.
- Because saves are **local** (IndexedDB), a bad deploy can't corrupt player data server-side; but a save-schema change must still pass migration tests before release ([SAVE_SYSTEM_PLAN](./SAVE_SYSTEM_PLAN.md)) so a rollback never strands a migrated save. Schema changes are forward-only and gated.

## Acceptance hooks
Deployment is gated by the [Technical Beta Gate](../production/RELEASE_GATES.md#8-technical-beta-gate): a clean production build deploys to Vercel, loads in Chromium + Firefox, meets initial-load budgets, and has working error handling.

# Source Log

Every external source consulted during the planning task, with a confidence label. This separates **confirmed information** (directly stated by a cited source) from **assumptions / inferences** the design makes on top of it.

## Confidence labels
- `[CONFIRMED]` — stated directly by the cited source.
- `[INFERRED]` — a reasonable conclusion drawn from one or more sources, not stated verbatim.
- `[ASSUMED]` — a design assumption with no external source; recorded so it can be revisited. Tracked in [../production/ASSUMPTIONS.md](../production/ASSUMPTIONS.md).

## Sources consulted

| # | Source | URL | Used for | Notes |
|---|--------|-----|----------|-------|
| S1 | MMOHuts — Hordes.io | https://mmohuts.com/game/hordes-io/ | Classes, factions, PvE/PvP loop | Class roles, faction names |
| S2 | MMOs.com — Hordes.io review | https://mmos.com/review/hordes-io | Overview, group-oriented PvP/PvM | Confirms group orientation |
| S3 | Hordes.io official site | https://hordes.io/ | Product framing | Free, no download |
| S4 | Hordes.io technical page | https://hordes.io/technical | System requirements framing | Browser/WebGL requirements |
| S5 | Web Game Dev — Interview with Dek (Hordes) | https://www.webgamedev.com/interviews/dek-hordes | Engine history, networking, tooling | Fetch returned HTTP 403; facts below taken from search summaries citing this interview, labeled `[INFERRED]` until re-verified |
| S6 | Hacker News — "Show HN: Hordes – a MMORPG in JavaScript" | https://news.ycombinator.com/item?id=20810627 | Origin, solo-dev context | Community discussion |
| S7 | Hordes.io Wiki (Miraheze) | https://hordesio.miraheze.org/wiki/Main_Page | Class/world structure reference | Community wiki — corroborating, not authoritative |
| S8 | Adventure Land — official | https://adventure.land/ | Code-driven browser MMO, WebGL+Canvas fallback | Comparable game |
| S9 | Adventure Land on Steam | https://store.steampowered.com/app/777150/ | Distribution model | Comparable game |
| S10 | MMORPG.com — Browser games list | https://www.mmorpg.com/games-list/show/browser | Landscape of browser MMOs | Comparable set |
| S11 | MMORPG.GG — Best browser MMOs 2025 | https://mmorpg.gg/best-browser-mmos/ | Landscape | Comparable set |
| S12 | MMOBomb — Best free browser MMORPGs | https://www.mmobomb.com/browsergames/mmorpg | Landscape | Comparable set |
| S13 | utsubo.com — 100 Three.js performance tips | https://www.utsubo.com/blog/threejs-best-practices-100-tips | Perf budgets & techniques | Draw-call/instancing guidance |
| S14 | three.js docs — InstancedMesh | https://threejs.org/docs/pages/InstancedMesh.html | Instancing | One draw call for many instances |
| S15 | three.js forum — InstancedMesh2 (LOD/culling/BVH) | https://discourse.threejs.org/t/three-ez-instancedmesh2-...69344 | Instancing + LOD + culling | Optional library reference |
| S16 | Three.js Roadmap — "Draw Calls: The Silent Killer" | https://threejsroadmap.com/blog/draw-calls-the-silent-killer | Draw-call budgeting | <100 draw-call guidance |
| S17 | VR Me Up — InstancedMesh performance devlog | https://vrmeup.com/devlog/devlog_10_threejs_instancedmesh_performance_optimizations.html | Instancing + per-instance culling | Practical numbers |

## Key confirmed facts (with provenance)

- `[CONFIRMED S1,S2]` Hordes.io is a **3D browser MMORPG** with **group-oriented open-world PvP and PvM**; free; no download.
- `[CONFIRMED S1]` Classes are **Warrior, Mage, Archer/Ranger, and Shaman**; players also pick a **faction (Bloodlust or Vanguard)** that gates friend/foe in open-world PvP.
- `[CONFIRMED S1,S2]` PvE loop = **level up, fight monsters, rare bosses, and world bosses with exceptionally rare loot**.
- `[INFERRED S5,S6]` Hordes.io is built by a **solo developer ("Dek") since ~2016**.
- `[INFERRED S5]` The project **started on Three.js**, then later switched to a **heavily modified low-level WebGL library (OGL)** for performance during a 2018/2019 rewrite. Dek reportedly said Three.js is what he'd recommend to start a browser game quickly and that "Hordes would never have happened without it."
- `[INFERRED S5]` Networking evolved from **JSON over Socket.io** to a **custom serialization format over uWebSockets**, with the **server validating movement plausibility** (server authority).
- `[INFERRED S5]` Dek built **custom tooling**, including a **multiplayer-capable JavaScript map editor**.
- `[CONFIRMED S8,S9]` Adventure Land is a **code-driven browser MMORPG** that runs on **WebGL with an HTML5 Canvas fallback**.
- `[CONFIRMED S13–S17]` For Three.js games, the dominant performance levers are **reducing draw calls (target well under ~100–300), InstancedMesh for repeated geometry (many instances → one draw call), object pooling, LOD, and frustum culling.**

## Verification debt

- **S5 (Dek interview)** could not be fetched directly (HTTP 403 from the automated fetcher). The engine-history and networking facts attributed to it are corroborated by multiple search summaries but should be **re-verified by a human reading the article** before being quoted as authoritative. They do not change any Oathbound decision: we are not copying Hordes.io, and our independent choice to start on Three.js stands on its own merits (see [../technical/TECH_STACK_EVALUATION.md](../technical/TECH_STACK_EVALUATION.md)).

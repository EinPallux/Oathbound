# Rendering & Performance (Technical)

How the Three.js renderer is structured and the techniques that keep Oathbound at 60 FPS on mid-range desktops. The **numeric budgets** live in [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md); this doc is the technical *how*. Grounded in Three.js performance guidance ([SOURCE_LOG](../research/SOURCE_LOG.md) S13–S17).

## Renderer structure
- One `WebGLRenderer`, one main `Scene` per active zone, a chase-camera rig ([COMBAT_DESIGN](../design/COMBAT_DESIGN.md#2-camera--movement)).
- **Render loop is separate from sim** (fixed-timestep sim + interpolated render — [ARCHITECTURE_PLAN](./ARCHITECTURE_PLAN.md#fixed-timestep-simulation-decoupled-rendering)).
- Renderer consumes sim **read-state + events** to create/update/recycle visuals via `RenderRef` components; it owns no gameplay truth.

## The big levers (in priority order)
1. **Draw-call reduction** — the dominant cost. Target well under budget; merge static geometry, share materials, atlas textures. `[S13,S16]`
2. **InstancedMesh for repeats** — identical enemies, trees, rocks, grass, projectiles render as **one draw call per type**. `[S14]`
3. **Object pooling** — never allocate per-spawn; reuse enemy/projectile/particle/damage-number instances to avoid GC hitches. `[S13]`
4. **Frustum + distance culling** — Three.js frustum-culls per object; we add **distance culling** and per-instance visibility for instanced crowds. `[S15,S17]`
5. **LOD** — swap to simpler meshes/imposters at distance; lower AI tick for far entities.

## Scene & world rendering
- **Terrain:** chunked heightfield meshes per zone; vertex colors + a few tiling materials (no per-object textures). Only near chunks at full detail; far chunks at LOD.
- **Props (trees/rocks/ruins):** authored as a small **modular kit**, placed via instancing with per-instance transform + slight color variation. Prop-density budget per zone.
- **Zone segmentation:** each zone is its own scene; border crossing fades to the neighbor (≤2s), unloads the far zone, keeps adjacent warm if memory allows ([WORLD_AND_ZONES](../design/WORLD_AND_ZONES.md#streaming--segmentation-decision), [ADR-004](../decisions/DECISION_RECORDS.md#adr-004-world-segmentation--streaming)).

## Characters & enemies
- Low-poly rigged meshes; **skeletal animation** kept cheap (few bones, shared clips). Crowds of identical enemies use instancing where animation allows, or pooled skinned meshes with capped active count.
- **Active-AI cap** (≤40 near player); distant enemies throttle/disable AI and animation ([ENEMY_DESIGN](../design/ENEMY_DESIGN.md#performance-constraints-enemies)).

## Lighting & shadows
- **One directional "sun"** + hemisphere/ambient for fill. Mostly **baked/vertex** lighting and **emissive (unlit) fakes** for lava/blight/magic instead of many dynamic point lights.
- **Single cascaded directional shadow** with a limited caster set and tunable resolution; shadows are a **graphics toggle** (off in reduced-effects mode).

## Materials & textures
- Prefer **flat/toon-ish materials with vertex colors**; small palette/gradient atlases over many unique textures.
- Texture resolution capped (mostly 256–512, ≤1024); shared materials to enable batching; sRGB + correct color management.

## Particles & VFX
- A single pooled particle system with hard caps; effects respect the **effect-intensity / reduced-effects** settings ([UX_AND_ACCESSIBILITY](../design/UX_AND_ACCESSIBILITY.md)).
- Damage numbers, hit flashes, loot beams are pooled DOM-or-sprite elements with budgets.

## Post-processing
- Minimal by default (maybe a light bloom for emissive). All post is toggleable and **off in reduced-effects mode** to protect low-end/integrated GPUs.

## Spatial structure
- A **uniform grid** spatial index for neighbor queries (aggro, AoE hits, social aggro, nearest-target acquisition) — avoids O(n²) scans and supports culling.

## Quality settings (player-facing → budget impact)
| Setting | Options | Affects |
|---|---|---|
| Shadows | Off / Low / High | shadow casters, map resolution |
| Draw distance | Near / Med / Far | chunk + prop + enemy cull range |
| Effects | Reduced / Normal / High | particle caps, post-processing, hit-stop |
| Resolution scale | 0.75× / 1× / (cap) | fragment cost on weak GPUs |
| Nameplate density | Low / Med / High | DOM/overlay cost |

Defaults auto-pick based on a quick startup capability probe; everything is overridable.

## Profiling & guardrails (continuous, not last-week)
- An in-build **perf overlay** (FPS, frame ms, draw calls, active entities, particles, memory) — a planned devtool ([TEST_STRATEGY](../qa/TEST_STRATEGY.md)).
- **Playwright perf smoke** runs each milestone: load a benchmark scene with N enemies, assert median FPS/frame-time and draw-call ceilings ([PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md)).
- Performance validation is scheduled **throughout** the [VERSION_ROADMAP](../production/VERSION_ROADMAP.md) (Core Movement Gate establishes the baseline before any content scales).

## Browser targets
Chromium-based + Firefox on mid-range desktop incl. **integrated graphics**. WebGL2 baseline. A capability probe + reduced-effects mode covers weaker machines; no mobile-first work for beta.

## Memory discipline
- Dispose geometries/materials/textures on zone unload; pools have ceilings; watch for leaks via repeated zone-transition tests ([TEST_STRATEGY](../qa/TEST_STRATEGY.md#long-session--leak-tests)).
- Asset streaming is **on-demand per zone**; shared kits stay resident.

## Cross-references
Budgets & pass/fail numbers: [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md). Risk items (Three.js perf, pathfinding cost, visual variety): [RISK_REGISTER](../production/RISK_REGISTER.md).

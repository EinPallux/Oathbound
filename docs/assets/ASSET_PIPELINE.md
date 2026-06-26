# Asset Pipeline

How assets are produced, stored, optimized, and loaded — in service of the [ART_DIRECTION_PLAN](./ART_DIRECTION_PLAN.md) and within the [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md). **Procedural-first**; external assets only under a clear license ([THIRD_PARTY_ASSET_POLICY](./THIRD_PARTY_ASSET_POLICY.md)). **No assets are downloaded during the planning task.**

## Production ladder (cheapest → richer; climb only as needed)
1. **Three.js primitive geometry** — boxes/cylinders/spheres/cones for greyboxing and many props.
2. **Procedural terrain** — heightfield chunks with vertex-color biome tinting (no terrain textures).
3. **Procedural environment props** — scattered rocks/trees/ruins generated from a few base meshes + instancing.
4. **Low-poly modular kit** — a small hand-authored set (building parts, gear pieces, enemy parts) reused/recolored across zones.
5. **Simple stylized materials** — flat/toon shaders, vertex colors, small gradient atlases.
6. **Generated particle effects** — pooled systems for combat/zone VFX.
7. **Procedural character animation** — idle sway, lean, hit-reactions; supplement a tiny authored clip set.
8. **Simple rigged models (later)** — characters/enemies with few bones, shared clips.
9. **Safely-licensed external assets (optional)** — CC0/public-domain/clear commercial only, logged in the registry.

We climb the ladder **only when a step is needed for the current roadmap band** — greybox first, polish later ([VERSION_ROADMAP](../production/VERSION_ROADMAP.md)).

## Formats & conventions
| Asset | Format | Notes |
|---|---|---|
| Models | **glTF/GLB** | compact, Three.js-native; Draco/meshopt compression if needed |
| Textures | PNG/WebP, **atlased**, ≤1024 (mostly 256–512) | sRGB; prefer vertex color over textures |
| Audio | **OGG/WebM** (+ MP3 fallback) | short SFX; streamed/looped ambience via Howler |
| Data | TS/JSON | content is data, not assets ([CONTENT_DATA_STRATEGY](../technical/CONTENT_DATA_STRATEGY.md)) |
| Icons | SVG/atlas | UI; original or CC0 |

**Naming:** `kebab-case`, namespaced by domain (`enemy/bloomhusk-thrasher.glb`, `vfx/holy-nova.png`, `sfx/bow-loose-01.ogg`). **Stable ids** link assets to content registries.

## Storage in the repo
```
/public/assets
  /models   (glb)        /textures (atlas png/webp)
  /audio    (ogg)        /icons    (svg/atlas)
/docs/assets/THIRD_PARTY_ASSETS.md   ← license registry (every external asset)
```
Original procedural assets are generated at runtime/build and need no files; authored/external assets live under `/public/assets` and **must** have a registry entry if externally sourced.

## Optimization steps (build-time)
- Mesh: low-poly authoring + LOD variants for distant props/enemies; Draco/meshopt for any heavier GLB.
- Texture: atlasing, compression (WebP), power-of-two where useful, mipmaps.
- Instancing-friendly export: shared geometry/material so the renderer can batch ([RENDERING_AND_PERFORMANCE](../technical/RENDERING_AND_PERFORMANCE.md)).
- Audio: trim/normalize; small bitrates for SFX; lazy-load ambience.
- Budget check: per-zone payload ≤ ~3 MB; total initial ≤ ~5 MB ([PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md)).

## Loading strategy
- **On-demand per zone** — load a zone's kit/textures/audio when entering; dispose on unload (leak tests in [TEST_STRATEGY](../qa/TEST_STRATEGY.md)).
- Shared core assets (UI, common VFX, player models) stay resident.
- An `AssetService` ([ARCHITECTURE_PLAN](../technical/ARCHITECTURE_PLAN.md#cross-cutting-services-interfaces-swap-able)) wraps loaders, caching, and disposal so call sites don't manage GPU lifetimes directly.

## Tooling (planned, not built now)
- A simple **prop-scatter / zone-dressing** step driven by zone data.
- A **texture-atlas packer** step.
- A **palette/recolor** utility so one kit yields many zone variants cheaply.
- A **glTF validator** + budget reporter in CI.

## Asset–content separation
Assets are *referenced by id* from content data; swapping a model/texture is a registry change, not a code change. This keeps the [content data strategy](../technical/CONTENT_DATA_STRATEGY.md) and the art pipeline cleanly decoupled.

## Licensing gate (hard rule)
Any externally-sourced asset **must** be CC0/public-domain/clearly-licensed-for-commercial-use, logged in [THIRD_PARTY_ASSETS.md](./THIRD_PARTY_ASSETS.md) **before** it enters the repo. No assets of unclear ownership; **never** rip/extract/trace/recreate proprietary Hordes.io assets ([THIRD_PARTY_ASSET_POLICY](./THIRD_PARTY_ASSET_POLICY.md)). This is reviewed whenever an asset is added (R20 — [RISK_REGISTER](../production/RISK_REGISTER.md)).

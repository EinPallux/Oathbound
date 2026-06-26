# Art Direction Plan

There are currently **no game assets**. This plan defines a **coherent, lightweight, achievable** visual direction that a tiny (AI-assisted) team can produce, primarily **procedurally / with primitives**, while looking intentional. We do **not** visually copy Hordes.io.

## Visual target (one line)
> **Stylized low-poly fantasy** with flat/toon shading, vertex-color-driven palettes, soft gradient skies, and expressive lighting — readable first, pretty second.

## Pillars of the look
- **Stylized** — flat-shaded / lightly toon; no realistic PBR.
- **Readable** — silhouettes and color communicate threat, rarity, and interactables instantly (combat clarity > spectacle).
- **Lightweight** — tiny asset footprint; vertex colors and small atlases over many textures; fits the [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md).
- **Consistent** — shared material language and palette system across all zones.
- **Achievable** — buildable from primitives + a small modular kit + procedural terrain; attractive **without** realistic graphics.

## Why low-poly + vertex color (decision)
- Cheap to author, render, and download; one shared material can batch thousands of objects.
- Ages gracefully (RuneScape/Hordes.io longevity — [COMPARABLE_GAMES](../research/COMPARABLE_GAMES.md)).
- Lets us lean on **instancing** (one draw call for many props/enemies) — see [RENDERING_AND_PERFORMANCE](../technical/RENDERING_AND_PERFORMANCE.md). Recorded in [ADR-009](../decisions/DECISION_RECORDS.md#adr-009-procedural-vs-sourced-assets).

## Color & readability language
- **Per-zone palette** gives each region identity (see table). Palettes are data ([CONTENT_DATA_STRATEGY](../technical/CONTENT_DATA_STRATEGY.md)) so re-coloring a shared kit makes a "new" zone cheaply.
- **Rarity colors** (white→gold) are reinforced by **shape/label**, never color-alone (colorblind safety — [UX_AND_ACCESSIBILITY](../design/UX_AND_ACCESSIBILITY.md)).
- **Threat language:** elite/rare enemies get distinct silhouettes, scale, and emissive accents; telegraphs use bright ground decals that read over the palette.
- **Interactables** (Oathstones, loot, vendors) use consistent emissive cues.

## Per-zone visual identity (cheap distinctiveness)
| Zone | Palette | Signature cheap effects |
|---|---|---|
| Oathhold (hub) | warm stone/timber, lantern gold | cozy lighting, banners |
| Greenmarch (1–5) | bright greens, soft blue sky | instanced grass/trees, gentle fog |
| Thornwood Vale (6–10) | deep greens, shadow, amber shafts | god-ray fakes, dense instanced trees + LOD |
| Sunken Fen (11–15) | murky teal/brown, mist | fog density, stylized water shader, gas decals |
| Emberreach (16–20) | ash grey + ember orange | **emissive (unlit) lava**, pooled ash particles |
| Riven Peaks (21–25) | white/ice-blue | snow particles (capped), blizzard via fog toggle |
| Gravereach (26–30) | desaturated dark + blight cyan/violet | emissive blight accents, recolored ruin kit |

Detail per zone: [WORLD_AND_ZONES](../design/WORLD_AND_ZONES.md).

## Characters
- **Low-poly humanoid** base per class, distinguished by silhouette, palette, and gear shapes (Warrior bulky, Hunter lean/cloaked, Priest robed).
- **Few bones**, shared animation clips; **procedural touches** (lean, hit-reactions, idle sway) reduce the authored-animation burden (mitigates R6 — [RISK_REGISTER](../production/RISK_REGISTER.md)).
- Equipment is shown via a **modular gear layer** (swappable meshes/colors per slot) rather than unique full models per item.

## Enemies
- Built from the **modular kit** + family palettes/silhouettes; tiers signaled by scale + emissive accents. Identical enemies render via **instancing/pooling** ([ENEMY_DESIGN](../design/ENEMY_DESIGN.md#performance-constraints-enemies)).

## VFX & "juice" (within budgets)
- Pooled particles for impacts, holy/fire/frost/blight effects, loot beams, level-up.
- Emissive + light bloom (single, toggleable) instead of many dynamic lights.
- All effects respect **effect-intensity / reduced-effects** ([UX_AND_ACCESSIBILITY](../design/UX_AND_ACCESSIBILITY.md)) and never obscure telegraphs.

## UI art
- Clean DOM/HTML UI ([ADR-002](../decisions/DECISION_RECORDS.md#adr-002-ui-technology)) with a simple icon set (original or CC0), high-contrast text, scalable. Rarity = color **+** border shape **+** label.

## Audio direction (brief, paired here)
- Stylized fantasy: punchy hit SFX, class-flavored ability sounds (heavy clangs / bow twangs / choral tones), ambient per-zone beds, light music stings on level-up/boss. Delivered via Howler behind an `AudioService` ([TECH_STACK_EVALUATION](../technical/TECH_STACK_EVALUATION.md)). Prefer CC0/clearly-licensed or original audio ([THIRD_PARTY_ASSET_POLICY](./THIRD_PARTY_ASSET_POLICY.md)).

## Production approach
Procedural-first, then a small modular kit, then optional simple rigged models, then optional safely-licensed external assets — detailed in [ASSET_PIPELINE](./ASSET_PIPELINE.md). **No assets are downloaded during planning.**

## Non-goals
Realistic graphics; high-poly models; large unique-texture sets; per-item full models; expensive post-processing; anything that copies Hordes.io's visual identity, icons, or models.

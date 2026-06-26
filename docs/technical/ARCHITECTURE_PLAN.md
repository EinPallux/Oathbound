# Architecture Plan

How the code is organized so that **combat and progression logic are not welded to rendering**, the game loop is explicit, and a future server could own simulation without a rewrite — while **avoiding premature enterprise architecture**. Stack rationale: [TECH_STACK_EVALUATION](./TECH_STACK_EVALUATION.md).

## Architectural separation (the required boundaries)
The brief mandates clear seams between these concerns; we realize them as modules with **one-directional dependencies** (UI/Render depend on Sim via read-models & events; Sim never imports Render):

```
            ┌─────────────── Platform/IO ───────────────┐
            │  Input  Audio  Storage(IndexedDB)  Assets  │
            └───────────────┬───────────────────────────┘
                            │ (interfaces)
   ┌───────── Simulation (no Three.js, no DOM) ─────────┐
   │  GameWorld(ECS-lite): entities + components         │
   │  Systems: Movement · Collision · AI · Combat ·      │
   │           Abilities · Loot · Progression · Spawning │
   │  Content: data-driven items/abilities/enemies/zones │
   │  Persistence: save/load/migrate (pure data)         │
   └───────────────┬───────────────────────┬────────────┘
        emits events │            exposes read-state │
   ┌─────────────────▼──────┐      ┌─────────────────▼─────────┐
   │ Renderer (Three.js)    │      │ UI (DOM/HTML overlay)     │
   │ scene, camera, meshes, │      │ HUD, menus, tooltips,     │
   │ instancing, pooling,   │      │ settings, goal tracker    │
   │ VFX, particles         │      │ (tiny signal store)       │
   └────────────────────────┘      └───────────────────────────┘
```

**Key rule:** the **Simulation layer has zero imports from `three` or the DOM.** This is what makes it unit-testable today and server-portable later ([FUTURE_MULTIPLAYER_BOUNDARIES](./FUTURE_MULTIPLAYER_BOUNDARIES.md)). The Renderer reads simulation state and event streams to spawn/update visuals; it never owns gameplay truth.

## ECS-lite model · [ADR-006](../decisions/DECISION_RECORDS.md#adr-006-ecs-vs-simpler-architecture)
Pragmatic, not a framework:
- **Entity** = a numeric id.
- **Components** = plain data, stored in typed arrays/maps keyed by entity id (e.g., `Transform`, `Velocity`, `Health`, `Resource`, `CombatStats`, `AbilityState`, `AIState`, `Faction`, `LootOwner`, `RenderRef`, `Collider`).
- **Systems** = pure-ish functions `(world, dt) => void` that iterate the entities having the components they care about.
- A thin `GameWorld` owns component stores, entity creation/destruction, an **event queue**, and the system run-order.

Why not heavy ECS: we want the data-oriented benefits (cache-friendly iteration, composability, easy save serialization) without a dependency or its ceremony. Why not pure OOP: cross-cutting systems (combat touching health/resource/AI/loot) get tangled in inheritance.

## Fixed-timestep simulation, decoupled rendering
```
loop(now):
  accumulator += clamp(now - last, 0, MAX_FRAME)   // avoid spiral of death
  while accumulator >= DT:                          // DT = 1/30s sim tick (v1)
      stepSimulation(DT)                            // deterministic-ish update
      accumulator -= DT
  render(interpolation = accumulator / DT)          // render interpolates between sim states
  requestAnimationFrame(loop)
```
- **Sim runs at a fixed tick** (target 30 Hz `v1`) for stable combat math and easier future server reconciliation; **rendering runs at display rate** (target 60 FPS) with interpolation. See [RENDERING_AND_PERFORMANCE](./RENDERING_AND_PERFORMANCE.md).
- Input is sampled per frame and fed to the sim as intents (also the right shape for future networked input).

## System run-order (per sim tick)
1. **Input→Intent** (movement vector, ability requests, target requests)
2. **AI** (enemy state machines produce intents; throttled by distance)
3. **Movement** (integrate velocity)
4. **Collision** (resolve vs terrain/colliders; ground snap)
5. **Targeting** (acquire/validate soft/locked targets, range/LoS)
6. **Abilities** (GCD/cooldowns/cast/channel resolution → combat events)
7. **Combat** (apply damage/heal/shield/CC via the [canonical formula](../design/COMBAT_DESIGN.md#5-damage-calculation-canonical-formula))
8. **Status/Buffs** (tick DoTs/HoTs/durations)
9. **Death/Respawn** (state transitions)
10. **Loot/Drops** (roll tables, spawn loot entities)
11. **Progression** (XP/level-ups, unlocks)
12. **Spawning/Leashing** (camp spawns, respawns, resets)
13. **Event flush** (publish to Renderer/UI/Audio/Telemetry subscribers)

## Module / directory layout (planned — created during implementation)
```
/src
  /core        loop, time, ecs (world, components, systems registry), events, rng (seedable)
  /sim
    /systems   movement, collision, targeting, ai, abilities, combat, status, loot, progression, spawning
    /combat    formulas, damage types, stats
    /content   loaders + typed registries
  /content     DATA: abilities/, enemies/, items/, zones/, loot-tables/, classes/  (data-driven)
  /render      renderer, camera-rig, scene-manager, instancing, pooling, vfx, particles, lod
  /ui          hud/, menus/, tooltips/, store (signals), goal-tracker
  /platform    input, audio (Howler service), storage (idb), assets (loaders), settings
  /persistence save-schema, serializer, migrations, export-import
  /game        bootstrap, game-states (menu/char-select/playing/paused), wiring
  /devtools    spawn/level/teleport/loot-sim panels, perf overlay, ai-debug  (planned)
/tests         unit (vitest), e2e/perf (playwright)
/public        static assets, /assets registry-tracked content
```

## Cross-cutting services (interfaces, swap-able)
- `Clock`, `RNG` (seedable for tests & deterministic loot sims), `EventBus`, `Telemetry` (local-only), `AudioService`, `StorageService`, `AssetService`, `SettingsService`. All injected, all mockable → testable sim.

## State / data flow for UI
- UI subscribes to a **read-model** derived from sim state + the event stream (e.g., "playerHP changed", "item looted", "level up").
- UI never mutates sim directly; it sends **intents/commands** (e.g., "equip item X", "use ability 3", "respec") that the sim validates. This command/event shape is intentionally the same one a networked client would use.

## Performance-aware patterns (baked in, not bolted on)
- **Object pooling** for enemies, projectiles, loot, damage numbers, particles.
- **InstancedMesh** for crowds/props; shared materials; texture atlases.
- **Distance-based AI throttling / disabling**; spatial partition (uniform grid) for neighbor queries (aggro, AoE, social).
- See [RENDERING_AND_PERFORMANCE](./RENDERING_AND_PERFORMANCE.md) and [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md).

## Error handling & resilience
- Save writes are transactional + checksummed; load failures fall back to a backup slot ([SAVE_SYSTEM_PLAN](./SAVE_SYSTEM_PLAN.md)).
- A global error boundary surfaces a recoverable error screen rather than a blank canvas; telemetry logs locally.

## What we explicitly avoid
- No gameplay logic inside Three.js objects or React/DOM components.
- No heavy ECS/networking/physics frameworks for beta.
- No deep inheritance hierarchies; favor composition + data.
- No premature abstraction "for multiplayer" beyond the clean sim/render seam and command/event shapes described here.

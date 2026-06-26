# Test Strategy

How Oathbound is validated, top to bottom. Testability is a *design constraint*: the simulation layer has **no Three.js/DOM imports** ([ARCHITECTURE_PLAN](../technical/ARCHITECTURE_PLAN.md)), so gameplay logic is unit-testable in isolation. Tools: **Vitest** (unit), **Playwright** (browser/perf, using the pre-installed Chromium). These tests **gate releases** ([RELEASE_GATES](../production/RELEASE_GATES.md)).

## Test pyramid
```
        ▲  few   E2E / browser playthrough smoke (Playwright)
       ▲▲▲       Integration (systems together; save round-trips; zone transitions)
      ▲▲▲▲▲      Unit (combat math, item-gen, XP, migrations, RNG)  ← the broad base
```

## Unit tests (Vitest) — the base
| Suite | Asserts |
|---|---|
| **Combat calculation** | the [canonical damage formula](../design/COMBAT_DESIGN.md#5-damage-calculation-canonical-formula): mitigation DR curves, crit, variance bounds, weakness mods, healing/shield math |
| **Item generation** | budgets within tolerance of `itemBudget(ilvl,slot)`; rarity→affix-count rules; affix tiers gated by ilvl; smart-loot bias; **Relic** definitions valid |
| **XP curve** | `xpToNext`/cumulative match the table; con multipliers; tier multipliers; level-up thresholds |
| **Loot tables** | weights normalize; type pools resolve; bad-luck protection counter raises odds then resets |
| **Save & migration** | every `vN→vN+1` migration; load real fixtures from each historical version; checksum validation; zod schema parse |
| **RNG** | seedable determinism (same seed → same rolls) for reproducible sims |
| **Progression/unlocks** | abilities unlock at the right level; choice-node application/respec |

## Integration tests
- **Systems-together:** run the sim headless for N ticks and assert invariants (no NaNs, HP never negative, leashing resets, resource never exceeds max).
- **Save round-trip:** create character → play actions → save → reload → state identical; export → import → lossless.
- **Zone transitions:** load/unload zones repeatedly; assert disposal (no leaked geometries/materials/textures).
- **Content integrity:** the [CONTENT_DATA_STRATEGY](../technical/CONTENT_DATA_STRATEGY.md#content-integrity-ci-friendly) validator (all ids resolve, budgets in range, zones meet density).

## Browser / E2E (Playwright)
- **Boot & render:** page loads, canvas renders, no console errors.
- **Input smoke:** WASD movement, camera, targeting, ability cast, loot, equip via simulated input.
- **Mini-playthrough:** scripted "reach Lv 3 in the greybox/Greenmarch" run as a regression guard for the core loop.
- **Cross-browser:** Chromium + Firefox (capability probe + reduced-effects mode path).

## Performance tests (Playwright + perf overlay hooks)
Run each milestone against the [PERFORMANCE_BUDGETS](./PERFORMANCE_BUDGETS.md) on the reference machine/CI proxy:
- Benchmark scene with **N active enemies** → assert **median FPS / frame-time** and **draw-call** ceilings.
- **Long-session / leak tests:** run 30–60 min (or accelerated), assert memory plateaus (no unbounded growth) across repeated combat + zone transitions.
- Record results as the version's perf evidence.

## Combat simulation tests (balance, no humans)
A headless harness fights **class × enemy × level** matchups thousands of times (seeded) and reports **TTK, HP-remaining, deaths, downtime** vs [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md). Flags any class outside the **±20% TTK band** or any required content failing the solo guarantee — *before* human playtests. Feeds the [Three-Class](../production/RELEASE_GATES.md#4-three-class-gate)/[Core Loop](../production/RELEASE_GATES.md#3-core-loop-gate) gates.

## Economy / loot simulation
Simulate long farming sessions to verify drop cadence, rarity distribution, gold flow, and Reinforcement material balance against targets — tuning data, not just pass/fail ([ITEMS_AND_EQUIPMENT](../design/ITEMS_AND_EQUIPMENT.md)).

## Edge cases explicitly covered
Browser refresh mid-combat/mid-save; `beforeunload` flush; corrupted save → backup recovery; quota-exceeded; changed/removed item or ability defs in an old save; rapid zone-spam; death during zone transition; offline asset failures.

## Planned development tools (planned now, built during implementation — not in this task)
Spawn controls · level/XP setters · equipment generators · damage logging · AI-state visualization · performance overlay · save-state snapshots · zone teleport · loot-table simulation · automated combat simulations. These live in `/src/devtools` and are excluded from production builds.

## CI pipeline (planned)
On push/PR: **typecheck → Vitest → content-integrity validator → `vite build` → Playwright smoke + perf** on the preview build. Red = blocked promotion ([VERCEL_DEPLOYMENT_PLAN](../technical/VERCEL_DEPLOYMENT_PLAN.md)). Save-migration suite is **required** on any schema change.

## Coverage philosophy
Chase **meaningful** coverage (all combat/item/XP/save logic + invariants), not a vanity %. The riskiest code (damage math, item-gen, migrations) gets the deepest tests because regressions there are player-visible or save-destroying ([RISK_REGISTER](../production/RISK_REGISTER.md) R16/R17).

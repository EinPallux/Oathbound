# Phase Dependencies

What must exist before each band of the [VERSION_ROADMAP](./VERSION_ROADMAP.md) can start, and the gates that block forward motion ([RELEASE_GATES](./RELEASE_GATES.md)). The spine is **linear and deliberate**: prove the loop is fun before adding breadth.

## Dependency graph (bands)
```
0.0.x Foundations
  └─► [Core Movement Gate]
0.1.x First Grinding Loop (1 class, 1 family)
  └─► [Combat Gate] + [Core Loop Gate]   ◄── highest-leverage checkpoint
0.2.x Three Classes
  └─► [Three-Class Gate]
0.3.x Lv 1–10 (2 zones)
  └─► [Level 1–10 Gate]
0.4.x Lv 11–20 (2 zones)        (no hard gate; interim acceptance)
0.5.x Lv 1–30 complete (6 zones)
  └─► [Level 1–30 Content Gate]
0.6.x Equipment depth + Lv-30 farming
  └─► [Endgame Foundation Gate]
0.7.x UX & accessibility polish  (feature freeze begins)
0.8.x Optimization, saves, tests, balance
  └─► [Technical Beta Gate]
0.9.x Beta candidates
  └─► [Content Beta Gate]
1.0-BETA
  └─► [1.0-BETA Gate]
```

## Hard prerequisites per band
| Band | Cannot start until… |
|---|---|
| 0.1.x | scaffold + game loop + movement/camera/collision pass **Core Movement Gate**; combat skeleton (0.0.4) hits a dummy via the canonical formula |
| 0.2.x | the **one-class/one-family loop is rated fun** and passes **Combat + Core Loop** gates (do not widen on an unfun loop) |
| 0.3.x | all three classes pass the **Three-Class Gate** (solo-viable, balanced band, no pet, Priest deals damage, Warrior isn't slow) |
| 0.4.x | Lv 1–10 passes the **Level 1–10 Gate** (no blocker, onboarding teaches all verbs) |
| 0.5.x | Lv 11–20 zones meet the anti-empty checklist and resist/choice systems work |
| 0.6.x | **full 1→30** passes the **Level 1–30 Content Gate** for every class |
| 0.7.x | endgame chase passes the **Endgame Foundation Gate** |
| 0.8.x | UX/accessibility complete; **feature freeze** in effect |
| 0.9.x | **Technical Beta Gate** passed (budgets, saves, browsers, deploy) |
| 1.0-BETA | **Content Beta Gate** passed (playtest KPIs, zero criticals) |

## The "do not proceed" rule (anti-scope-creep enforcement)
Per the brief, **raids/dungeons and any deferred MMO system stay unscheduled** until *all* of these are true (they map to gates above):
1. all three classes solo-viable & balanced · 2. complete Lv 1–30 path exists · 3. world has sufficient grinding content · 4. equipment progression functional · 5. Lv-30 open-world farming functional · 6. core combat polished · 7. enemy AI stable · 8. local saves reliable · 9. performance budgets met · 10. the core-loop playtest gate passed.

If any are false, the answer to "should we build X group system?" is **no** — record the request and move on.

## Parallelizable work (within a band, off the critical path)
- **Art/asset kit production** ([ASSET_PIPELINE](../assets/ASSET_PIPELINE.md)) can run ahead of the band that consumes it, *if* it doesn't pull focus from the current gate.
- **Audio** assets, **devtools**, and **test fixtures** can be built alongside their band.
- **Documentation updates** travel with every version (each version's deliverables include doc updates).

## Re-entrancy / regression rule
Passing a later gate does **not** exempt earlier ones: every release runs the regression suite ([TEST_STRATEGY](../qa/TEST_STRATEGY.md)) so, e.g., adding Emberreach (0.4.x) must not break the Core Loop or Three-Class guarantees. Earlier gates are **continuous invariants**, not one-time checkpoints.

# Performance Budgets

The **canonical numeric performance targets** for the browser build. Other docs link here rather than restating numbers. Validated continuously (not as a final-week task) via the perf overlay + Playwright perf tests ([TEST_STRATEGY](./TEST_STRATEGY.md)); enforced by the [Technical Beta Gate](../production/RELEASE_GATES.md#8-technical-beta-gate). All values `v1 targets`, refined once the renderer exists. Techniques to hit them: [RENDERING_AND_PERFORMANCE](../technical/RENDERING_AND_PERFORMANCE.md).

## Reference hardware
- **Mid-range desktop** (target): ~2019+ quad-core CPU, **integrated or entry dGPU**, 8–16 GB RAM, Chromium/Firefox, 1080p.
- **Low-end floor** (must remain playable in reduced-effects mode): older integrated graphics.

## Frame & timing
| Metric | Target | Min acceptable |
|---|---|---|
| Frame rate | **60 FPS** | **45 FPS** sustained; never < **30** in normal play |
| Frame budget | 16.6 ms | — |
| Sim cost / tick (30 Hz) | ≤ ~6 ms | — |
| Render cost / frame | ≤ ~8 ms | — |
| Input → on-screen feedback | ≤ **100 ms** | — |

## Scene complexity
| Metric | Typical budget | Hard cap |
|---|---|---|
| Draw calls | ≤ **150** | ~**300** |
| Active (fully-simulated) AI near player | ≤ **40** | 50 |
| Visible enemies (incl. instanced/throttled) | ≤ ~150 | — |
| Live particles | ≤ **2,000** (pooled) | — |
| Dynamic lights | 1 directional sun + ambient/hemisphere; ≤ **2** extra dynamic | emissive "fakes" preferred over point lights |
| Shadow-casting objects | limited set; single cascaded directional | toggleable (off in reduced-effects) |
| Texture resolution | mostly 256–512; ≤ **1024**; atlased | — |
| Geometry | low-poly; LOD at distance | — |

## Memory & loading
| Metric | Target |
|---|---|
| Tab memory (steady state) | ≤ **~600 MB**; no unbounded growth over a session |
| Initial JS (app code, gzip) | ≤ **~500 KB** (excluding `three` ~160 KB gzip) |
| Total initial download | ≤ **~5 MB** |
| Per-zone asset payload (on-demand) | ≤ **~3 MB** |
| Zone transition duration | ≤ **2 s** (short fade) |
| Autosave duration | ≤ **100 ms** typical |

## Quality settings → budget impact
Players can trade fidelity for frames; defaults auto-pick via a startup capability probe ([RENDERING_AND_PERFORMANCE](../technical/RENDERING_AND_PERFORMANCE.md#quality-settings-player-facing--budget-impact)):
| Setting | Range | Primary lever |
|---|---|---|
| Shadows | Off / Low / High | shadow casters + map res |
| Draw distance | Near / Med / Far | chunk/prop/enemy cull range |
| Effects | Reduced / Normal / High | particle cap + post-processing + hit-stop |
| Resolution scale | 0.75× / 1× | fragment cost |
| Nameplate density | Low / Med / High | overlay/DOM cost |

**Reduced-effects mode** (also an accessibility feature — [UX_AND_ACCESSIBILITY](../design/UX_AND_ACCESSIBILITY.md)) must keep the **low-end floor ≥30 FPS**.

## Browser support matrix
| Browser | Support |
|---|---|
| Chromium (Chrome/Edge/Brave) | primary |
| Firefox | required |
| Integrated graphics | must run (reduced-effects) |
| Mobile | **out of scope** for beta (desktop-first) |

## How budgets are enforced
- **Continuous:** perf overlay during dev (FPS, frame ms, draw calls, active entities, particles, memory).
- **Automated:** Playwright perf scene with N enemies asserts median FPS/frame-time + draw-call ceiling each milestone; long-session leak test asserts memory plateau.
- **Gated:** the Core Movement Gate sets the baseline *before* content scales; the Technical Beta Gate requires all budgets met.
- **Risk-linked:** R4 (Three.js perf) and R5 (pathfinding cost) in the [RISK_REGISTER](../production/RISK_REGISTER.md) are reviewed against these numbers every band.

## Budget change control
If a budget can't be met after honest optimization, **reduce content/effects** (fewer active AI, lower particle cap, smaller draw distance) rather than shipping below the **min-acceptable frame rate**. A budget is only revised with recorded justification + a new perf capture.

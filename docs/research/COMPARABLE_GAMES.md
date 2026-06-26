# Comparable Games — Lessons for Oathbound

A scan of lightweight browser/indie RPGs beyond Hordes.io, focused on what each teaches us about **solo-friendly grinding, browser performance, and small-team scope**. We borrow *patterns*, never content. Sources in [SOURCE_LOG](./SOURCE_LOG.md).

## Quick comparison

| Game | Tech / platform | Combat | Solo-friendliness | Key takeaway for Oathbound |
|---|---|---|---|---|
| **Hordes.io** | Browser, WebGL (Three.js → custom) `[INFERRED S5]` | Tab-target + hotbar | Group-leaning | Primary reference — see [HORDES_IO_ANALYSIS](./HORDES_IO_ANALYSIS.md). |
| **Adventure Land** | Browser, WebGL **+ Canvas fallback** `[CONFIRMED S8,S9]` | Code/automation-driven | Strongly solo | A graphics fallback path keeps low-end users playing; consider a "reduced effects" mode (we do — see [UX_AND_ACCESSIBILITY](../design/UX_AND_ACCESSIBILITY.md)). |
| **Realm of the Mad God** | Browser (historically Flash → modern client) | Action / bullet-hell | Solo-capable, group-bonus | Permadeath + loot-soak shows how *risk* drives grind excitement; we use gentler stakes but keep "rare drop anticipation." |
| **Flyff Universe** | Browser (Unity WebGL) `[CONFIRMED S10–S12]` | Tab-target MMORPG | Mixed | Proof that a full tab-target MMORPG runs acceptably as a browser build today; validates our platform bet. |
| **Diablo II / III, Path of Exile** (desktop ARPGs) | Native | Action | Solo-strong | The gold standard for **loot chase + affixes + rarity tiers**; we adopt a simplified affix model. See [ITEMS_AND_EQUIPMENT](../design/ITEMS_AND_EQUIPMENT.md). |
| **RuneScape / OSRS** | Browser/Java/native | Tick-based | Solo-strong | Long-horizon goals and readable, low-fidelity art retain players for years; depth ≠ graphical fidelity. |

## Cross-cutting lessons

### Solo-friendliness
- ARPGs (Diablo-like) prove a **loot-driven solo grind** is one of the most durable retention loops in games. Oathbound leans on this rather than social systems.
- Group bonuses, where they exist, should be **modest and optional** — never a tax on soloing. Encoded in [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md).

### Browser performance
- Successful browser 3D games keep **draw calls and asset sizes low** and offer **quality toggles / fallbacks** (Adventure Land's Canvas mode). `[CONFIRMED S8,S13]` We commit to a reduced-effects mode and explicit [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md).
- Unity-WebGL MMOs (Flyff Universe) ship large but playable; a hand-rolled Three.js client can be **dramatically lighter** if we stay disciplined on assets.

### Scope discipline for tiny teams
- Every comparable success **started narrow and deepened over time** rather than launching broad. This is the backbone of our [VERSION_ROADMAP](../production/VERSION_ROADMAP.md): one class + one enemy family fun *first*.
- Readable, stylized, low-fidelity art (RuneScape, Hordes.io) outlives expensive realism for small teams and is far cheaper to produce. See [ART_DIRECTION_PLAN](../assets/ART_DIRECTION_PLAN.md).

### Progression structure
- Games that keep players for the long term pair **fast, legible short-term goals** (next level, next drop) with **slow long-term goals** (build completion, best-in-slot chase). Oathbound's level-30 cap + open-ended gear chase mirrors this. See [ENDGAME_FOUNDATION](../design/ENDGAME_FOUNDATION.md).

## What we deliberately reject from the genre

- **Pay-to-win / cash-shop power**, energy timers, and FOMO mechanics — out of scope and against the "chill" pillar.
- **Permadeath** (RotMG) — too punishing for a relaxing solo grind; we use gentle death penalties (see [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md#death-and-recovery)).
- **Mandatory grouping / trading economies** — deferred to the post-beta MMO horizon.
- **Infinite procedural worlds** — we want a compact, authored, content-dense world. See [WORLD_AND_ZONES](../design/WORLD_AND_ZONES.md).

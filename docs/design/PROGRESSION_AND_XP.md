# Progression & XP

Canonical owner of: the XP curve, level-difference (con) system, per-bracket pacing, ability/milestone unlock levels, and the **power-growth model** (how much power comes from levels vs. gear). All values are `v1 tuning targets` validated against the **time-per-level** KPI in [PLAYTEST_PLAN](../qa/PLAYTEST_PLAN.md).

## Design intent
- **Level cap: 30.** Reaching it should feel **earned but not grindy** — a smooth ramp with **no sudden XP walls**.
- **Target time to cap: ~12–18h** (design center ≈14h). Faster for an optimized route; slower for explorers/farmers.
- Difficulty should rise through **mechanics, builds, and gear**, not merely slower XP (Pillar 2).

## XP curve (canonical)
Formula (v1): `xpToNext(L) = round_to_10( 50 * L^1.70 )` for L = 1..29.

| Lvl | XP to next | Cumulative | Same-lvl XP/kill | ~Kills this level |
|---:|---:|---:|---:|---:|
| 1 | 50 | 50 | 12 | 4 |
| 2 | 160 | 210 | 16 | 10 |
| 3 | 320 | 530 | 21 | 15 |
| 4 | 530 | 1,060 | 25 | 21 |
| 5 | 770 | 1,830 | 29 | 27 |
| 6 | 1,050 | 2,880 | 33 | 32 |
| 7 | 1,370 | 4,250 | 37 | 37 |
| 8 | 1,710 | 5,960 | 42 | 41 |
| 9 | 2,090 | 8,050 | 46 | 45 |
| 10 | 2,510 | 10,560 | 50 | 50 |
| 11 | 2,950 | 13,510 | 54 | 55 |
| 12 | 3,420 | 16,930 | 58 | 59 |
| 13 | 3,910 | 20,840 | 63 | 62 |
| 14 | 4,440 | 25,280 | 67 | 66 |
| 15 | 4,990 | 30,270 | 71 | 70 |
| 16 | 5,570 | 35,840 | 75 | 74 |
| 17 | 6,180 | 42,020 | 79 | 78 |
| 18 | 6,810 | 48,830 | 84 | 81 |
| 19 | 7,460 | 56,290 | 88 | 85 |
| 20 | 8,140 | 64,430 | 92 | 88 |
| 21 | 8,850 | 73,280 | 96 | 92 |
| 22 | 9,570 | 82,850 | 100 | 96 |
| 23 | 10,330 | 93,180 | 105 | 98 |
| 24 | 11,100 | 104,280 | 109 | 102 |
| 25 | 11,900 | 116,180 | 113 | 105 |
| 26 | 12,720 | 128,900 | 117 | 109 |
| 27 | 13,560 | 142,460 | 121 | 112 |
| 28 | 14,430 | 156,890 | 126 | 115 |
| 29 | 15,310 | 172,200 | 130 | 118 |
| **30** | — | **172,200 total** | — | — |

- **Same-lvl XP/kill** = `round(8 + 4.2*L)` — the XP a same-level *standard* enemy grants. Elites/rares grant multiples (see below).
- **~1,950 same-level kills** to cap. The rest of the 12–18h is exploration, travel, recovery, gear comparison, deaths, and elite/rare/world-boss fights (which grant far more XP per kill, reducing required standard kills).

### Why the curve maps to 12–18h
Pure same-level combat ≈ 1,950 kills × ~8–14s effective per encounter ≈ **4.3–7.6h**. Real playthroughs add exploration, backtracking, inventory/build management, deaths, and farming detours, landing a typical first character at **~12–18h**. The KPI to watch is **median minutes-per-level per bracket**; if a bracket drifts outside target, adjust `xpToNext` coefficient or enemy XP — never insert filler quests.

## Per-bracket pacing targets
| Bracket | Theme | Target time | Design focus |
|---|---|---|---|
| **1–5** | Onboarding & class identity | ~1.0h | First kill ≤2 min; learn move/target/ability/loot/equip; unlock filler+spender+AoE. |
| **6–10** | First complete combat loop | ~1.5h | Defensive + mobility + sustain online; first real gear upgrades; first elite. |
| **11–15** | Build choices begin | ~2.0h | Interrupt + first choice node; second zone; rare spawns introduced. |
| **16–20** | Stronger enemy mechanics | ~2.5h | Telegraphed elites, caster packs; ground AoE farm tool; resist-typed damage matters. |
| **21–25** | Advanced zones & gear farming | ~3.5h | Epic-tier drops; elite camps; second choice node; harder con curve. |
| **26–30** | Final region & endgame prep | ~3.5h | Capstone; first world-boss attempts at 30; Legendary chase begins. |

## Level-difference (con) system
`Δ = enemyLevel − playerLevel`. Color communicates risk *and* sets XP/anti-farm. (Difficulty colors also drive nameplate color — see [UX_AND_ACCESSIBILITY](./UX_AND_ACCESSIBILITY.md).)

| Color | Δ range | XP multiplier | Notes |
|---|---|---|---|
| **Gray** | Δ ≤ −6 | **0×** (or 5% floor) | Trivial — **anti-farm**: no meaningful XP, reduced drops. |
| **Green** | −5..−2 | 0.5×–0.8× | Easy; fine for clearing/loot, weak XP. |
| **White** | −1..+1 | **1.0×** | The standard grind target. |
| **Yellow** | +2..+3 | 1.15×–1.25× | Tougher, better XP — rewards pushing up. |
| **Orange** | +4..+5 | 1.3× (capped) | Risky; viable with good play/gear. |
| **Red** | Δ ≥ +6 | 1.3× (capped) + danger | High risk; can one-shot; not required. |

- **Anti-exploit:** gray rule prevents farming low-level mobs; **diminishing XP** on rapidly repeated kills of the same spawn point within a short window (soft, to discourage degenerate single-spot farming without punishing normal play); rested-style bonuses are **not** used (no login pressure — chill pillar).
- Drop quality also scales mildly with con (higher-con enemies have slightly better rarity odds), reinforcing "push up for rewards."

## Enemy XP by tier (multipliers on same-level base)
| Tier | XP multiplier | Frequency |
|---|---|---|
| Standard | 1× | common |
| Elite | 4–6× | camps/minibosses |
| Rare-named | 8–15× | uncommon spawns |
| World boss | 30–60× | endgame, repeatable |
Defined per family in [ENEMY_DESIGN](./ENEMY_DESIGN.md).

## Power-growth model (where player power comes from)
A legible split so designers and tests can reason about balance. Approximate share of total combat power at a given level, fully geared for that level:

| Source | Share | Notes |
|---|---:|---|
| Character level (base stats, HP, ability access) | ~35% | guaranteed floor; gates zones |
| Equipment base stats (weapon + armor) | ~30% | the main chase |
| Abilities & build choices | ~20% | skill & build expression |
| Secondary stats / affixes | ~10% | optimization layer |
| Temporary consumables | ~5% | situational top-up |

Implications:
- **Level provides a reliable floor** so a new drop can't trivialize a zone and an unlucky player isn't hard-stuck.
- **Gear is the largest *variable*** lever → it's the retention chase (Pillar 5) without invalidating leveling.
- A **same-level white enemy must be beatable in level-appropriate *common* gear** — gear accelerates, never gates, required progression. See [SOLO_BALANCE_RULES](./SOLO_BALANCE_RULES.md).

## Milestone & feature unlock levels
| Level | Milestone |
|---|---|
| 1 | Class chosen; filler + spender; first zone (Greenmarch). |
| 3 | AoE; salvage unlocked. |
| 5 | Defensive tool; first Oathstone waypoint network; vendor basics. |
| 6 | Zone 2 (Thornwood Vale) opens. |
| 7 | Mobility tool. |
| 9 | Self-sustain tool; first elite recommended. |
| 11 | Zone 3 (Sunken Fen); first build choice approaching. |
| 12 | Interrupt; gear upgrading (Whetstone) unlocked. |
| 15 | Choice node A; rare-monster tracking hint system. |
| 16 | Zone 4 (Emberreach); resistances matter. |
| 18 | Ground AoE farm tool. |
| 21 | Zone 5 (Riven Peaks). |
| 22 | Choice node B; boss/burst tool. |
| 26 | Zone 6 (Gravereach); defensive ultimate. |
| 30 | Capstone; choice node C; **endgame chase unlocked** (world bosses, Legendary farming). See [ENDGAME_FOUNDATION](./ENDGAME_FOUNDATION.md). |

## Death & recovery (summary; canonical in SOLO_BALANCE_RULES)
No XP loss on death; respawn at last Oathstone with a brief "Shaken" debuff. Recovery to full out of combat ≤8s. Full rules: [SOLO_BALANCE_RULES](./SOLO_BALANCE_RULES.md#death-and-recovery).

## Tuning hooks (for the implementation session)
Expose as data/config (see [CONTENT_DATA_STRATEGY](../technical/CONTENT_DATA_STRATEGY.md)):
- `xpCurveCoeff` (50), `xpCurveExp` (1.70), `xpPerKill(base, slope)`, con multiplier table, tier multipliers, power-share weights.
- All must be hot-tunable without code changes so the [PLAYTEST_PLAN](../qa/PLAYTEST_PLAN.md) can iterate quickly.

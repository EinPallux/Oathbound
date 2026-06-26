# Playtest Plan & Local Telemetry

How we validate **feel and balance** with humans, and how we measure it **without a backend**. Complements the automated [TEST_STRATEGY](./TEST_STRATEGY.md): sims catch numeric problems; playtests catch *fun* problems. Feeds the [Core Loop](../production/RELEASE_GATES.md#3-core-loop-gate), [Three-Class](../production/RELEASE_GATES.md#4-three-class-gate), and [Content Beta](../production/RELEASE_GATES.md#9-content-beta-gate) gates.

## Playtest types
| Type | When | Goal |
|---|---|---|
| **Core-loop session** | 0.1.x | Is a 20-min grind genuinely enjoyable? (highest-leverage) |
| **Class solo run** | 0.2.x | Each class solos the slice; identity reads; no role-dependency |
| **New-player run** | 0.3.x+ | Onboarding teaches all verbs; no confusion; first kill ≤2 min |
| **Experienced-player run** | 0.3.x+ | Optimized route pacing; depth rewards mastery |
| **Full 1→30 playthrough** | 0.5.x | No blocker; per-bracket pacing in target; death audit |
| **Endgame retention** | 0.6.x | Does the level-30 chase keep pulling across sessions? |
| **Accessibility pass** | 0.7.x | Every option works, persists, applies live |
| **Beta candidate** | 0.9.x | Final pacing/balance/bug burn-down |

## What each playtest records
- **Quantitative (telemetry below):** time-per-level, kills/deaths, drop cadence, ability usage, downtime, zone dwell, rares seen.
- **Qualitative (survey):** fun rating per session; clarity of goals; "what now?" confidence after a break; class-feel; loot excitement; frustration points; where they'd stop playing.

## Local telemetry (no backend)
Because the beta has **no server**, metrics stay **on the player's device** and are **export-only** (privacy-first per the brief and [VERCEL_DEPLOYMENT_PLAN](../technical/VERCEL_DEPLOYMENT_PLAN.md#privacy--telemetry)).

**Measured counters:**
time per level · enemies defeated per level · deaths per level · damage taken per encounter · healing used · ability usage frequency · loot rarity frequency · equipment replacement frequency · gold earned/spent · time spent per zone · rare enemies encountered · inventory interruptions · average combat duration · class-specific downtime.

**Telemetry rules (must):**
- Remain on the user's device; never auto-transmitted.
- **Transparent** (player can view their own data) and **optional/declinable** if exposed in public builds.
- **Export** for voluntary playtest reports (JSON download).
- **No sensitive personal information**; no account, no identifiers beyond a local session id.

## KPIs and their pass bands
| KPI | Target band | Source of truth |
|---|---|---|
| Median minutes per level (per bracket) | within bracket targets | [PROGRESSION_AND_XP](../design/PROGRESSION_AND_XP.md#per-bracket-pacing-targets) |
| Deaths per level (attentive play) | low; no spike bracket | [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md) |
| Inter-class TTK spread | within **±20%** | [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md#inter-class-balance-band) |
| HP remaining after normal fight | ≥ **70%** | [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md#combat-targets) |
| Downtime between fights | ≤ **8 s** | [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md#recovery) |
| Noticeable upgrade cadence | every ~**20–40 min** while farming | [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md#drop-rate--farming-expectations-solo) |
| Session fun rating | ≥ agreed threshold | survey |
| Return-after-break orientation | resume in < **1 min** | [Goal Tracker](../design/CORE_GAMEPLAY_LOOP.md#the-goal-tracker-lightweight-hud-element) |

If a KPI is out of band, tune **data** (curves, drop rates, coefficients) — never add busywork quests (Pillar 3).

## Playtest → tuning loop
1. Run the session; export telemetry + survey.
2. Compare KPIs to bands; identify the worst offender.
3. Adjust the owning data values ([CONTENT_DATA_STRATEGY](../technical/CONTENT_DATA_STRATEGY.md) makes these hot-tunable).
4. Re-run combat/economy sims to confirm no regression.
5. Re-playtest the affected band. Repeat until gates pass.

## Cadence
Light playtests **every band that touches gameplay**; heavier structured rounds at 0.1.x (core loop), 0.2.x (classes), 0.5.x (full journey), 0.6.x (endgame), and 0.9.x (beta candidates). Earlier gates remain invariants and are spot-checked in later rounds ([PHASE_DEPENDENCIES](../production/PHASE_DEPENDENCIES.md#re-entrancy--regression-rule)).

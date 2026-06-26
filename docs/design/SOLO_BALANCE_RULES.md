# Solo-Friendly Balance Rules

Explicit, **measurable** balancing rules — not just "it's solo-friendly." These are testable targets enforced by the [PLAYTEST_PLAN](../qa/PLAYTEST_PLAN.md) telemetry and the [Three-Class](../production/RELEASE_GATES.md#4-three-class-gate)/[Core Loop](../production/RELEASE_GATES.md#3-core-loop-gate) gates. All values `v1 tuning targets`. The overriding rule: **solo play must never feel like a less-efficient substitute for grouping.**

## Combat targets (player at level, in level-appropriate *common* gear unless noted)
| Metric | Target | Rationale |
|---|---|---|
| **TTK — standard same-level** | **3–6 s** | fast grind flow |
| **TTK — elite same-level** | **20–45 s** | a real but solo fight |
| **TTK — rare-named** | **30–75 s** | event-feel |
| **TTK — world boss (solo)** | **2–5 min** | climactic, repeatable |
| **HP remaining after 1 standard fight** | **≥ 70%** | low downtime |
| **HP remaining after a 3-pull** | **≥ 35%** (with cooldowns) | packs are tense, survivable |
| **Max comfortable pull** | **3 standards**; 4–5 = dangerous | readable risk |
| **Class-specific downtime between fights** | **≤ 8 s** to combat-ready | chill pacing |
| **Consumable dependence (normal grind)** | **0 potions** needed for same-level normals | potions are insurance, not fuel |
| **Death frequency (normal grind, attentive play)** | **< 1 per ~45 min** | gentle |
| **Gear-check severity (required path)** | none — common gear clears required content | gear accelerates, never gates |
| **Level-difference penalty** | per con table | predictable |

## Recovery
- **Out of combat:** HP and resource regen ramp so a full top-off takes **≤ 8 s** (faster with food/Priest). In town: instant.
- **In combat:** slow/no passive regen → fights are decided by kit, not waiting.
- No forced sit-and-eat downtime; no mana-class "drink every pull" misery (Priest sustains via Atonement + regen).

## Death and recovery
- **No XP loss.** Respawn at the last activated **Oathstone** (or zone entrance).
- **Penalty:** a short **"Shaken"** debuff (~30 s minor stat reduction) + the run-back. **No item durability/repair** in beta.
- **Corpse/respawn inconvenience:** minimal — run-back distance is bounded by Oathstone density (≈ ≤60 s to return to most spots).
- If playtests show death carries *no* stakes, evaluate a tiny gold cost — but never XP loss or gear loss (chill pillar).

## Drop-rate & farming expectations (solo)
| Metric | Target |
|---|---|
| Uncommon+ from a standard kill | ~8–12% |
| Rare+ from an elite | ~25–35% (con-adjusted) |
| Epic+ from a named rare | meaningful tail + **bad-luck protection** |
| A **noticeable upgrade** while actively farming a relevant zone | **roughly every 20–40 min** |
| Targeted slot upgrade via known source | reachable in a **focused session**, aided by BLP |
| Inventory interruption frequency | rare — generous stacks, salvage-all, auto-gold |
| Farming-session length before "dry" feeling | tuned so the [reward cadence](./CORE_GAMEPLAY_LOOP.md#reward-cadence-target-rhythm) holds |

Drop sources & tables: [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md). If telemetry shows dry spells beyond cadence targets, tune drop rates — not busywork.

## Per-class solo guarantees (each must hold for Warrior, Hunter, Priest)
Every class must independently be able to:
- Level 1→30 alone; defeat normal enemies of its level; recover quickly between fights.
- Earn useful equipment alone; explore every leveling zone alone; complete all required progression alone.
- Develop a viable solo build; handle a reasonable multi-enemy situation (3-pull); escape/recover via class tools.
- Participate in the **entire base progression loop without a party**.

**Never** balance a class assuming another provides healing, tanking, CC, or damage. Class identity stays strong; traditional MMO roles must **not** become solo restrictions. Specific kit checks live in [CLASS_DESIGN](./CLASS_DESIGN.md).

## Inter-class balance band
- Solo TTK vs a same-level standard should stay within **±20%** across classes at equal gear/level.
- Each class clears a same-level elite with *correct* play; none trivializes or is hard-walled.
- Watch the known failure modes (Warrior too slow, Hunter trivializes via kiting, Priest weak-damage healer) as tracked [risks](../production/RISK_REGISTER.md).

## Future-multiplayer fairness (recorded now, not built)
When multiplayer eventually arrives ([POST_BETA_MMO_HORIZON](../production/POST_BETA_MMO_HORIZON.md)):
- Grouping may add **safety and social fun** and a **modest** efficiency bump — but must **not** multiply XP/loot so much that soloing feels punished.
- Normal level progression stays **fully viable alone**; regular open-world gear stays **farmable alone**.
- Group-only best-in-slot **raid** gear may exist later, but group content must **not invalidate open-world progression**.

## How these become tests
Each numeric target maps to a telemetry counter or an automated combat simulation (see [TEST_STRATEGY](../qa/TEST_STRATEGY.md#combat-simulation-tests)). The [Core Loop Gate](../production/RELEASE_GATES.md#3-core-loop-gate) blocks progress if TTK, downtime, or death-rate fall outside these bands.

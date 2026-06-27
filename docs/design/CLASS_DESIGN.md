# Class Design

Three classes ship in 1.0-BETA: **Warrior, Hunter, Priest**. Each must level 1→30 alone, handle packs, sustain between fights, and have a clear identity, strengths, and weaknesses. No class is balanced around a second player (Pillar 1). Combat rules they build on: [COMBAT_DESIGN](./COMBAT_DESIGN.md). All numbers are `v1 tuning targets` validated by the [Three-Class Gate](../production/RELEASE_GATES.md#4-three-class-gate).

> **Notation.** Cost = resource spent. CD = individual cooldown (separate from the 1.0s GCD). Coeff = damage/heal coefficient on the primary stat in the [canonical formula](./COMBAT_DESIGN.md#5-damage-calculation-canonical-formula). Type = Instant / Cast / Channel / Passive / Off-GCD.

## Ability unlock cadence (all classes)
Abilities and passives unlock to match progression pacing in [PROGRESSION_AND_XP](./PROGRESSION_AND_XP.md): a steady drip with **build-defining choices beginning at Lv 11–15**.

| Level | What unlocks |
|---|---|
| 1 | Basic (resource-builder) attack + first spender |
| 3 | AoE / pack answer |
| 5 | Defensive or key debuff |
| 7 | Mobility / gap-closer / escape (off-GCD) |
| 9 | Self-sustain tool |
| 12 | Interrupt |
| 15 | Buff / control + **first build choice node** |
| 18 | Ground AoE farm tool |
| 22 | Boss/burst tool + **second build choice node** |
| 26 | Defensive ultimate |
| 30 | Capstone + **third build choice node** |

**Build choice nodes** (Lv 15/22/30) are small either/or talent picks (no sprawling tree) that bias a class toward, e.g., sustained vs. burst, single-target vs. AoE, offense vs. defense. Respec is free in town (chill pillar). This is the "build development" lever without a giant talent system.

> **As-built note (0.4.0–0.5.0).** The implementation lands a compact kit: **8 base abilities + 2 choice nodes = 10 hotbar slots** (keys 1–9, 0), with choice nodes at **Lv 14 & 18**. The **Lv-30 capstone is implemented as an *upgrade*, not an 11th button** — at level 30 it automatically empowers the class's signature spender (Warrior **Whirl → "Oathbreaker's Wrath"**, Hunter **Piercing Arrow → "Rapid Fusillade"**, Priest **Searing Light → "Dawnbreak"**): more damage, and for the Warrior a wider cleave. This keeps the hotbar at 10 slots while still delivering a level-30 power/identity spike. (A third choice node was folded into this; see `src/sim/classes.ts` `Capstone`/`empowerAbility`.)

---

## Warrior
**Fantasy:** an unbreakable frontline brawler who wins by closing distance, weathering blows, and cleaving through packs. **Difficulty:** low-to-moderate (forgiving). **Core resource:** **Fury** (0–100; builds from dealing and taking hits; decays slowly out of combat). **Primary stat:** STR. **Armor:** heavy. **Off-hand axis:** *Shield* (defense/sustain) vs *Two-Hander* (damage/cleave).

> Explicitly **not** a low-damage group tank. The Warrior is a durable bruiser with strong close-range and cleave damage and reliable self-sustain.

### Abilities
| Lvl | Ability | Type | Cost | CD | Effect (v1) |
|---|---|---|---|---|---|
| 1 | **Cleaving Strike** | Instant | — | GCD | Basic melee; **+12 Fury**; minor frontal splash (Coeff 0.7). The filler. |
| 1 | **Sunder** | Instant | 30 Fury | — | Heavy single hit (Coeff 1.6) + **Armor Break** debuff (−X armor, 8s). |
| 3 | **Whirl** | Instant | 35 Fury | 6s | AoE around self (Coeff 0.9 to all in radius). Pack answer. |
| 5 | **Bulwark** | Off-GCD | — | 18s | 50% damage reduction + block for 4s. Survival button. |
| 7 | **Charge** | Off-GCD | — | 12s | Dash to target; brief **root/slow**; generates Fury. Gap-closer. |
| 9 | **Second Wind** | Instant | 40 Fury | 14s | Self-heal scaling with **missing HP** (more healing when low). Core sustain. |
| 12 | **Skullcrack** | Instant | 20 Fury | 12s | **Interrupt** + 1.5s stun. |
| 15 | **Rallying Cry** | Off-GCD | — | 45s | +max HP & +damage for 10s. *Choice node A:* offense (more dmg) vs defense (more HP/DR). |
| 18 | **Earthshatter** | Instant | 45 Fury | 14s | Ground-slam AoE (Coeff 1.1) + slow. Farm/pack tool. |
| 22 | **Reckless Flurry** | Channel | 50 Fury | 18s | Rapid multi-hit burst (Coeff 0.5 ×5). *Choice node B:* lifesteal vs raw damage. |
| 26 | **Unbreakable** | Off-GCD | — | 120s | 3s near-immunity (90% DR) — survive a lethal moment. Defensive ultimate. |
| 30 | **Oathbreaker's Wrath** | Instant | 100 Fury | 60s | Massive cleave nuke (Coeff 2.4) + 8s enrage (+attack speed). *Choice node C:* AoE-leaning vs single-target-leaning. |

### Passives (auto-unlock)
- *Battle Hardened* (L2): regenerate small Fury while in combat.
- *Bloodthirst* (L9): Sunder heals for a % of damage dealt (synergy with leech gear).
- *Momentum* (L16): killing an enemy refunds 15 Fury and refreshes Whirl partially.

### Solo toolkit check
Survival (Bulwark, Unbreakable, Second Wind) · pack answer (Whirl, Earthshatter, Oathbreaker's Wrath) · mobility/control (Charge, Skullcrack). ✔ All present.

### Rotations
- **Early (Lv 1–6):** Cleaving Strike to build → Sunder; Whirl on 2+ enemies; Bulwark when low.
- **Lv 30 single-target:** Charge in → Sunder (armor break) → Cleaving Strike filler → Reckless Flurry on cooldown → Oathbreaker's Wrath at 100 Fury; Second Wind/Bulwark reactively.
- **Lv 30 packs:** Charge → Whirl → Earthshatter → Oathbreaker's Wrath; Rallying Cry before a big pull.

### Gear priorities
STR > VIT > Crit/Haste; Leech is high-value for sustain; Armor for survivability builds. Shield builds stack Armor/VIT; two-hander builds stack STR/Crit. See [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md).

### Strengths / weaknesses / balance risks
- **Strengths:** durability, mistake-forgiveness, strong cleave, simple to play.
- **Weaknesses:** must close distance (vulnerable to kiting casters mid-charge-CD); weakest ranged option; relies on uptime.
- **Balance risk:** becoming *too slow/low-damage* (the classic tank trap). **Mitigation:** Fury-fueled cleave + Reckless Flurry keep DPS competitive; monitor TTK vs Hunter/Priest in the [PLAYTEST_PLAN](../qa/PLAYTEST_PLAN.md).

### Asset requirements
VFX: weapon swing trails, armor-break shimmer, whirl arc, earth-slam decal, enrage aura. Anim: melee swings, charge lunge, block stance, channel flurry. Audio: heavy impacts, shield clang, roar for Rallying Cry/Unbreakable.

---

## Hunter
**Fantasy:** a mobile ranged marksman who controls space with traps, kites packs, and bursts priority targets. **Difficulty:** moderate (positioning-driven). **Core resource:** **Focus** (0–100; regenerates ~10/s; builder + spenders). **Primary stat:** DEX. **Armor:** medium. **Off-hand axis:** *Quiver* (utility/traps) vs *Longbow focus* (raw single-target).

> Explicitly **not** dependent on a complex pet AI. See [the pet question](#hunter-and-the-pet-question).

### Abilities
| Lvl | Ability | Type | Cost | CD | Effect (v1) |
|---|---|---|---|---|---|
| 1 | **Quick Shot** | Instant | — | GCD | Basic ranged; **+15 Focus** (over generation window). Filler. |
| 1 | **Piercing Arrow** | Instant | 35 Focus | — | Strong shot that pierces enemies in a line (Coeff 1.5). |
| 3 | **Volley** | Instant | 40 Focus | 6s | Cone of arrows (Coeff 0.8 each target). Pack answer. |
| 5 | **Hunter's Mark** | Instant | 15 Focus | 10s | Mark target: takes +12% damage; your hits on it refund Focus. |
| 7 | **Disengage** | Off-GCD | — | 10s | Backflip leap + 30% move speed 2s. Core kiting/escape. |
| 9 | **Snare Trap** | Instant | 20 Focus | 12s | Place a trap; first enemy is **rooted** 3s then slowed. Control/sustain-by-distance. |
| 12 | **Concussive Shot** | Instant | 20 Focus | 12s | **Interrupt** + 50% slow 3s. |
| 15 | **Serpent Venom** | Instant | 25 Focus | 8s | Stacking **DoT** (ramps). *Choice node A:* DoT-spread vs hard-hitting single DoT. |
| 18 | **Rain of Arrows** | Ground-target | 45 Focus | 16s | AoE DoT zone. Premier farm/pack tool. |
| 22 | **Aimed Shot** | Cast (1.4s) | 45 Focus | 10s | Big single-target crit (Coeff 2.2). *Choice node B:* burst vs reduced cast time. Boss tool. |
| 26 | **Camouflage** | Off-GCD | — | 90s | Drop aggro 4s + next shot guaranteed crit. Escape/reset. |
| 30 | **Rapid Fusillade** | Channel | 60 Focus | 60s | 4s of rapid auto-critting shots (Coeff 0.6 ×N). *Choice node C:* single-target vs cleaving fusillade. |

### Passives
- *Steady Focus* (L2): Focus regen rises slightly while not moving.
- *Predator* (L16): +crit vs slowed/rooted/marked targets (synergy with own toolkit).
- *Fleetfoot* (L20): Disengage cooldown reduced after a kill.

### Solo toolkit check
Survival via distance (Disengage, Snare Trap, Camouflage) · pack answer (Volley, Rain of Arrows, Fusillade) · mobility/control (Disengage, Concussive, Snare). ✔

### Rotations
- **Early:** Hunter's Mark → Piercing Arrow → Quick Shot filler; Volley for 2+; Disengage to kite.
- **Lv 30 single-target:** Mark → Aimed Shot → Serpent Venom → Piercing Arrow → Quick Shot filler; Rapid Fusillade as burst window; Disengage to maintain range.
- **Lv 30 packs:** Snare Trap on chokepoint → Rain of Arrows → Volley; kite with Disengage; Concussive on dangerous casters.

### Gear priorities
DEX > Crit > Haste/VIT; Move Speed valuable for kiting; CDR for trap/Disengage uptime. See [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md).

### Strengths / weaknesses / balance risks
- **Strengths:** strong single-target, excellent kiting, best at avoiding damage entirely.
- **Weaknesses:** squishier; punished when cornered or out of Focus; trap/escape on cooldown = exposed.
- **Balance risk:** *trivializing enemies via infinite kiting.* **Mitigations:** enemy **leashing** (drag-kiting resets enemies, [COMBAT_DESIGN](./COMBAT_DESIGN.md#9-aggro-leashing-reset-pve)); some enemies have ranged attacks/gap-closers/anti-kite; Focus economy forces stand-and-deliver windows. Track Hunter TTK/death-rate vs others.

### Hunter and the pet question
**Decision: no permanent combat pet in 1.0-BETA.** A persistent pet adds AI, navigation, animation, balancing, and threat complexity that competes with polishing the core loop, and risks the "Hunter is actually a pet-management class" failure. **Alternatives considered:** (a) permanent pet — rejected for scope; (b) a short *temporary* summon ability (e.g., a hawk for a few seconds) — viable later but still adds AI; deferred; (c) trap/utility-centric kit with **no pet** — **chosen**. A **Beastmaster specialization** is recorded as an optional **post-beta** addition in [POST_BETA_MMO_HORIZON](../production/POST_BETA_MMO_HORIZON.md). See [ADR-013-style note in DECISION_RECORDS](../decisions/DECISION_RECORDS.md#design-decision-records).

### Asset requirements
VFX: arrow projectiles (pooled), trap decals, venom tick, rain-of-arrows zone, mark icon. Anim: draw/loose, backflip, channel. Audio: bow draws/looses, trap snap, crit thwack.

---

## Priest
**Fantasy:** a radiant caster who *fights with holy power* and survives by weaving heals and shields — strong and self-sufficient alone. **Difficulty:** moderate (resource & risk management). **Core resource:** **Mana** (regenerates; managed). **Primary stat:** SPR (drives both damage and healing). **Armor:** light. **Off-hand axis:** *Tome* (healing/sustain) vs *Reliquary* (offense).

> Explicitly **not** a group-only healer. The Priest has real offensive output and self-heals through dealing damage. It must be enjoyable for a player who never groups.

### Abilities
| Lvl | Ability | Type | Cost | CD | Effect (v1) |
|---|---|---|---|---|---|
| 1 | **Smite** | Instant | 8 Mana | GCD | Holy bolt (Coeff 1.0). Low-cost filler/main damage. |
| 1 | **Searing Light** | Cast (1.2s) | 20 Mana | — | Strong holy nuke (Coeff 1.7) or short DoT. |
| 3 | **Holy Nova** | Instant | 25 Mana | 6s | PBAoE burst (Coeff 0.8) + small self-heal per enemy hit. Pack answer. |
| 5 | **Mend** | Instant | 20 Mana | — | Direct self-heal (Coeff 1.4 healing). |
| 7 | **Aegis** | Off-GCD | 25 Mana | 14s | Absorb shield on self (scales SPR). Survival button. |
| 9 | **Atonement** | Toggle/Buff | — | — | While active, **30% of your spell damage heals you**. Core solo sustain. *(Mana regen slightly reduced while on.)* |
| 12 | **Silence** | Instant | 15 Mana | 16s | **Interrupt** + 2s silence vs casters. |
| 15 | **Chastise** | Instant | 20 Mana | 18s | Damage + **stun** 2s (or root — *choice node A*). Control. |
| 18 | **Consecrate** | Ground-target | 35 Mana | 14s | Holy zone DoT (Coeff 0.6/tick). Farm/pack tool; heals you via Atonement. |
| 22 | **Divine Word** | Cast (1.5s) | 40 Mana | 12s | Context tool: big nuke (Coeff 2.1) or big heal. *Choice node B:* offense vs flex. Boss tool. |
| 26 | **Guardian Spirit** | Off-GCD | 40 Mana | 120s | Cheat-death: prevents lethal damage once + heal over 4s. Defensive ultimate. |
| 30 | **Dawnbreak** | Cast (1.8s) | 80 Mana | 60s | Large holy AoE nuke (Coeff 2.0 to all in radius) + self-empower. *Choice node C:* burst vs sustain aura. |

### Passives
- *Inner Light* (L2): passive mana regen; higher out of combat.
- *Zeal* (L16): crits restore mana (sustains offense).
- *Faithful* (L20): healing received/self-heals +%; improves Atonement throughput.

### Solo toolkit check
Survival (Mend, Aegis, Atonement, Guardian Spirit) · pack answer (Holy Nova, Consecrate, Dawnbreak) · control/interrupt (Silence, Chastise). ✔

### Rotations
- **Early:** Searing Light → Smite filler; Holy Nova for 2+; Mend/Aegis when pressured; keep Atonement on once unlocked.
- **Lv 30 single-target:** Atonement on → Divine Word → Searing Light → Smite filler → Consecrate under target; Aegis/Mend reactively; Guardian Spirit for emergencies.
- **Lv 30 packs:** Consecrate → Holy Nova → Dawnbreak; Atonement keeps you topped; Chastise/Silence dangerous enemies.

### Gear priorities
SPR > Crit/Haste > VIT; +Healing affixes boost both Atonement sustain and emergency heals; CDR for defensive uptime. See [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md).

### Strengths / weaknesses / balance risks
- **Strengths:** strongest sustain, flexible, safe; great vs attrition and bosses.
- **Weaknesses:** lowest armor; mana-starved if greedy; cast-times punish bad positioning; lower raw burst than Hunter.
- **Balance risk:** *defaulting to a weak-damage group healer.* **Mitigation:** Atonement makes offense *be* the sustain; +Healing scales damage-sustain not just emergency heals; ensure solo TTK is competitive in playtests. Secondary risk: Atonement making the Priest unkillable — cap Atonement %, mana cost of staying offensive.

### Asset requirements
VFX: holy bolt/searing beam, nova ring, consecration ground, shield bubble, guardian-spirit wings, dawnbreak burst. Anim: cast gestures, channel, shield raise. Audio: choral/holy tones, heal chimes, nova whoosh.

---

## Cross-class balance guardrails
- All three must clear a **same-level pack of 3** with cooldowns, and a **same-level elite** with correct play (see [SOLO_BALANCE_RULES](./SOLO_BALANCE_RULES.md)).
- Solo TTK spread between classes vs a same-level normal should stay within **±20%** at equal gear (Three-Class Gate).
- No class may require another class's role to complete any required progression.
- Numbers here are **starting points**; the balancing model (stat budgets, coefficients) lives in [PROGRESSION_AND_XP](./PROGRESSION_AND_XP.md) and [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md), tuned via [telemetry](../qa/PLAYTEST_PLAN.md).

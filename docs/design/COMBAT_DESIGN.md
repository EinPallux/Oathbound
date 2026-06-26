# Combat Design

The combat model is the single most important system to get right before content scales (per the project brief and Pillar 2). This document specifies the targeting model, camera, controls, ability execution, damage math, status systems, enemy behavior, and combat-state transitions. Numbers tagged `v1 tuning target` are starting values validated by the [Combat Gate](../production/RELEASE_GATES.md#2-combat-gate).

## 1. Targeting model — decision

**Chosen: Soft Tab-Target Hybrid.** See [ADR-003](../decisions/DECISION_RECORDS.md#adr-003-combat-targeting-model) for the full decision record.

Options evaluated: traditional tab-target · soft targeting · cursor/reticle selection · full action combat · tab/action hybrid.

| Criterion | Why hybrid wins |
|---|---|
| Browser performance | No per-frame hitbox physics; target is an entity id + range/LoS checks. Cheap. |
| Solo grinding | Auto-acquire keeps the grind fast and low-friction; no fiddly clicking each mob. |
| Readability | A clearly highlighted current target + nameplate; obvious who you're hitting. |
| Three distinct classes | Melee (Warrior) and ranged (Hunter/Priest) all map cleanly to "current target + cones for AoE." |
| Future multiplayer | Server can validate "entity X hit entity Y" by id — far easier than reconciling free-aim hitboxes. |
| Low asset cost | No precise per-bone colliders required. |
| Indie scope | Simplest model that still feels active. |

**How it behaves:**
- **Lock:** `Tab` cycles to the nearest valid hostile in the camera-forward cone; left-click on an enemy locks it. Locked target persists until dead, out of range/LoS for N seconds, or cleared (`Esc`).
- **Soft fallback:** if no locked target, single-target abilities auto-acquire the **nearest valid hostile within range inside a forward cone** (≈100° `v1`). This makes the grind flow without manual targeting.
- **AoE/cone/ground abilities** ignore lock and hit by **shape** (radius around self, cone in facing, or a small ground-target reticle).
- **Assist clarity:** the current target shows a reticle ring + nameplate (name, level, HP, con color). Off-target enemies show minimal nameplates within range.

## 2. Camera & movement
- **Camera:** third-person chase cam, slightly over-the-shoulder. Scroll to zoom (clamped). Hold **RMB** to mouselook (character faces camera forward); LMB free-look without turning the character. Collision: camera springs inward to avoid clipping terrain/props.
- **Movement:** **WASD** direct control. `Space` = jump (low, mostly traversal/feel; not a combat dodge). `Shift` = walk/sprint toggle (sprint only out of combat `v1`). Character turns to movement or camera-forward depending on mouselook.
- **No click-to-move** for the action feel; clicking selects/attacks.

## 3. Controls map (default, remappable — see [UX_AND_ACCESSIBILITY](./UX_AND_ACCESSIBILITY.md))
| Input | Action |
|---|---|
| W A S D | Move |
| Mouse | Camera (RMB mouselook) |
| Scroll | Zoom |
| 1 2 3 4 5 6 | Hotbar abilities |
| Q E R | Hotbar abilities (mobility/utility/ultimate by convention) |
| Tab / LMB | Target nearest / select |
| Esc | Clear target / open menu |
| F | Interact / loot |
| I, C, M, K | Inventory, Character, Map, Skills |
| Space | Jump |
| P | Pause (local game) |

## 4. Ability execution
- **Global Cooldown (GCD):** **1.0s** `v1`. Most damaging/healing abilities trigger it. The GCD is reduced by **Haste** (see §6) down to a floor of **0.7s**.
- **Off-GCD:** movement (dash/roll), interrupts, and emergency defensives — so you can always react.
- **Cast types:** *instant*, *cast-time* (channel a bar; moving cancels unless the ability says otherwise), *channeled* (ticks over time). Cast-time abilities can be **interrupted** by enemy interrupts.
- **Costs & cooldowns:** each ability has a resource cost and an individual cooldown independent of the GCD. Defined per class in [CLASS_DESIGN](./CLASS_DESIGN.md).
- **Queuing:** a short input buffer (~0.25s) lets the next ability fire as the GCD ends (feels responsive).
- **Range & LoS:** abilities check range to target and **line of sight** (a single raycast vs. world colliders); blocked LoS shows a clear "no line of sight" message.

## 5. Damage calculation (canonical formula)
A single, legible formula used everywhere (combat tests assert it — see [TEST_STRATEGY](../qa/TEST_STRATEGY.md)):

```
rawHit      = abilityBase + abilityCoeff * primaryStat
mitigated   = rawHit * (1 - armorDR) * (1 - resistDR) * weaknessMods
critical    = mitigated * (isCrit ? critMult : 1)
finalDamage = round(critical * variance)        // variance ∈ [0.95, 1.05]
```
- `primaryStat` = the class's main stat (STR/DEX/SPR).
- `armorDR = armor / (armor + K(level))` — diminishing returns; `K` scales with attacker level so armor stays relevant. `v1: K(L) = 50 + 25*L`.
- `resistDR` analogous, from elemental resistances (fire/frost/blight) vs. typed damage.
- `critMult` base **1.5×** `v1`, raised by gear; `critChance` from DEX/affixes.
- `weaknessMods` = enemy family vulnerabilities/immunities (e.g., undead +X% from holy). See [ENEMY_DESIGN](./ENEMY_DESIGN.md).

**Healing** uses the same shape: `healBase + healCoeff * SPR`, no mitigation, can crit. **Shields** add a temporary absorb pool that soaks damage before HP.

## 6. Core stats & their combat effect
| Stat | Effect |
|---|---|
| STR / DEX / SPR | Primary scaling for Warrior / Hunter / Priest damage (and Priest healing via SPR). |
| VIT | Max HP (`maxHP = base(L) + vitCoeff * VIT`). |
| Armor | Physical mitigation via `armorDR`. |
| Resist (Fire/Frost/Blight) | Typed mitigation via `resistDR`. |
| Crit Chance / Crit Mult | Crit frequency & multiplier. |
| Haste | Reduces GCD and cast/channel time; speeds resource generation for some classes. |
| Cooldown Reduction (CDR) | Reduces ability cooldowns (capped, e.g. 40% `v1`). |
| Leech | % of damage returned as HP (key solo-sustain affix). |
| Move Speed | Out-of-combat traversal + kiting. |
Full item-side detail in [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md).

## 7. Buffs, debuffs, crowd control, interrupts
- **Buffs/debuffs:** timed, stacking rules per effect; shown as icons with durations on the target/self frames.
- **Crowd control:** *Slow, Root, Stun, Knockback, Fear* (limited set). Enemies have **CC resistance/diminishing returns** so casters/elites can't be perma-locked (and to keep the future PvP fair).
- **Interrupts:** each class has at least one tool to interrupt enemy casts (Warrior bash, Hunter trap/concussive, Priest a holy interrupt). Interrupting a telegraphed heavy cast is a core skill expression.

## 8. Enemy telegraphs & feedback
- Dangerous enemy abilities **telegraph**: a wind-up animation + ground decal/AoE indicator + audio cue, with enough lead time to react (`v1: 0.8–1.5s`).
- **Hit feedback:** damage numbers (toggleable), hit flashes, crit emphasis, impact particles, hit-stop on big hits (toggleable), directional damage indicators when hit off-screen.
- **Readability over spectacle:** effects must never obscure the telegraph you need to dodge (see reduced-effects mode in [UX_AND_ACCESSIBILITY](./UX_AND_ACCESSIBILITY.md)).

## 9. Aggro, leashing, reset (PvE)
- **Aggro radius** per enemy; **social aggro** for pack members within a small radius. Caster enemies prefer LoS and kiting.
- **Threat (solo):** simplest viable — the enemy targets whoever damaged it; designed so a single player's threat model is trivial now but **abstracted behind a Threat system** so a future multiplayer build can add tank threat without a rewrite (see [FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md)).
- **Leashing:** if pulled beyond a leash distance from spawn, the enemy disengages, **returns, and heals to full** (prevents trivial drag-kiting exploits while still allowing legitimate kiting within an area).
- **Reset behavior:** on leash/reset, clear debuffs and restore HP; brief invulnerability while returning.

## 10. Combat-state transitions
```
Idle ──enter combat (deal/take damage)──► InCombat
InCombat ──no combat events for T_oc (v1: 5s)──► Recovering
Recovering ──HP/resource regen ramp (≤8s to full)──► Idle
InCombat ──HP reaches 0──► Dead
Dead ──respawn──► Idle (at last Oathstone)
```
- **In-combat** disables sprint and fast HP/resource regen; **out-of-combat** ramps regen so downtime is short (see [SOLO_BALANCE_RULES](./SOLO_BALANCE_RULES.md#recovery)).

## 11. Death & respawn
- On death: respawn at the last activated **Oathstone** (waypoint) or zone entrance.
- **Penalty (gentle):** no XP loss; a short **"Shaken"** debuff (minor stat reduction for ~30s) and the run-back. No item durability/repair in the beta (reduces friction). A small gold cost may be evaluated only if death has no stakes at all in playtests.
- Corpses are not lootable by others (single-player); dropped loot you left persists for a grace period.

## 12. Loot pickup
- Gold and currency: **auto-pickup** on proximity.
- Items: drop as labeled, rarity-colored beams/markers; press `F` (or auto-pickup for common, configurable) to collect. Rare+ items prompt a brief on-screen toast.

## 13. What "combat feels good" means objectively
Replaces vague language with the [Combat Gate](../production/RELEASE_GATES.md#2-combat-gate) criteria, e.g.: input-to-feedback latency ≤ 100ms; same-level normal TTK 3–6s; no ability with zero feedback; interrupt success registers within one frame of input; 60 FPS maintained with 20 active enemies on mid-range hardware. Full list in the gate.

## 14. Explicitly deferred combat features
Mounted combat, swimming combat, destructible environments, full ragdoll physics, free-aim projectiles with per-bone hit detection, and any PvP-specific tuning — all post-beta. See [DEFERRED_FEATURES](../production/DEFERRED_FEATURES.md).

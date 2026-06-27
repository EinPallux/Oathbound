# Changelog

Development proceeds **one phase at a time** (see [docs/production/VERSION_ROADMAP.md](./docs/production/VERSION_ROADMAP.md)).
Each entry is an **independently testable build**. After each phase, work pauses for testing before the next begins.

---

## 0.4.0-INDEV — "Fen & Ember" → Expanded Brackets (Lv 11–20) *(in progress)*
**Goal:** mid-game depth — Lv 11–20 across **Sunken Fen** + **Emberreach**: deeper kits (interrupt, ground-AoE, choice nodes), a live **resistance** system, new archetypes, elite camps, **Epic** rarity, Reinforcement, and bad-luck protection. Large phase, built in verified checkpoints.

### ✅ Checkpoint 1 — Lv 11–20 kit pt.1 (interrupt + ground-AoE)
- **Interrupt** (Lv 12, off-GCD) for all three classes — *Pommel Strike* / *Scatter Shot* / *Silence*: a new `interrupt` targeting that **cancels a winding-up enemy's telegraph** and applies a **Silence** status; the enemy AI refuses to begin a new wind-up while silenced (the Wisp's blight bolt is now counterable).
- **Ground-AoE tool** (Lv 16) for all three classes — *Earthsplitter* / *Rain of Arrows* / *Consecration*: a new `groundAoE` targeting that drops a `GroundAoe` zone (on the target, or ahead of you) which **ticks damage** in radius for its lifetime, then expires. New pure `ground-aoe` system + a tinted, pulsing ground-disc view.
- **Hotbar expands to 10 slots** (keys 1–9, 0) — input + HUD — to seat the growing 11–20 kit (slots 9 & 0 fill in checkpoint 2 with the choice nodes).
- Tests: interrupt (cancels wind-up + silences + damages; unlock-gated), Silence on the enemy AI (no new telegraph), ground-AoE (ticks then despawns; placed on the target) → **134 unit tests**; e2e green (10).

- Verified: `typecheck` ✓ · `npm test` → 134/134 ✓ · `build` ✓ · `test:e2e` → 10/10 ✓.

### ✅ Checkpoint 2 — Lv 11–20 kit pt.2 (choice nodes / talents)
- **Choice nodes** (Lv 14 & Lv 18) for all three classes — a **pick-one-of-two** talent per hotbar slot, producing distinct play: Warrior *Rallying Cry vs Bloodthirst* / *Unbreakable vs Ravager*; Hunter *Aimed Shot vs Explosive Trap* / *Barrage vs Camouflage*; Priest *Penance vs Holy Fire* / *Divine Aegis vs Divine Star*. These fill hotbar slots 9 & 0.
- **Dynamic kit**: `ClassDef.choiceNodes` + `resolveKit(cls, choices)` assemble the ordered kit (8 base + one per node = 10, fixed length). Combat, HUD, and cooldown sizing read the resolved kit; the pick lives on `PlayerClass.choices` and **persists in the save**.
- **Talents UI**: a *Talents* section in the bag/character panel (I/C) — pick A or B per unlocked node, **out of combat**; locked nodes show their unlock level. Swapping resets that slot's cooldown.
- Tests: `resolveKit` ordering + swap, distinct-play (default node A buffs vs option-1 deals damage), unlock gating, save round-trip → **140 unit tests**; a talents-swap e2e (level up → pick the other option → hotbar slot updates) → **11 e2e**. New debug hooks (`debugSetLevel`, `debugTeleport`) for testing.

**Verified:** `typecheck` ✓ · `npm test` → 140/140 ✓ · `build` ✓ (~162 KB gzip) · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 3 — resistance system live + support/pack-leader archetypes
- **Resistance live**: typed mitigation (the `damage.ts` formula already had it) now actually flows from gear — two new defensive affixes (**+Fire Resist**, **+Blight Resist**) roll on armour, feed `deriveStats` → `Defense.resist`, and reduce incoming typed hits (e.g. a Wisp's blight bolt). Tuned to *matter but never fully negate* (and never gate content). Resist is scored for upgrade deltas.
- **Support archetype** — the **Sporemother**: hangs back and **heals the most-wounded nearby ally** on a cadence instead of attacking (kill-the-healer play). Tinted teal-green.
- **Pack-leader archetype** — the **Bramble Warchief**: a bruiser that **rallies nearby allies** with an `Empowered` buff (+25% outgoing damage) while it fights. Tinted banner-red. New `Status.Empowered` read by the shared damage applier.
- A preview pair (Sporemother tending the Sporeling swarm + a Warchief rallying the Bramblekin) is dropped into Thornwood now; proper Fen/Ember camps follow in CP4.
- Tests: resist derives from gear + equipping sets `Defense.resist` + blight resist mitigates; support heals a wounded ally; pack-leader empowers allies; an Empowered attacker hits harder → **146 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 146/146 ✓ · `build` ✓ (~162 KB gzip) · `test:e2e` → 11/11 ✓.

### ⏳ Remaining for the Lv 11–20 brackets (next checkpoints)
- **CP4:** **Sunken Fen** + **Emberreach** zones + elite **camps**.
- **CP5:** **Epic** rarity + **Reinforcement** + **bad-luck protection v1**.

---

## 0.3.0-INDEV — "First Ten Levels" → Level 1–10 Gate *(feature-complete — awaiting gate playtest)*
**Goal:** a polished first bracket for all three classes (the **breadth** band). Large phase, built in verified checkpoints.

### ✅ Checkpoint 1 — ability unlocks + complete Lv 1–10 kits
- **Ability unlock system**: each ability has an `unlockLevel`; the combat system refuses locked abilities, and the hotbar shows locked slots as `Lv N` (greyed). Level up to learn the kit.
- **Complete Lv 1–10 kits** for all three classes (6 abilities each, hotbar keys 1–6):
  - **Warrior** + **Charge** (Lv 7, off-GCD gap-closer: leap to target, build Fury, root it) + **Second Wind** (Lv 9, self-heal scaling with **missing HP**).
  - **Hunter** + **Hunter's Mark** (Lv 5, applies a **vulnerability** debuff — the target takes +12% damage).
  - **Priest** kit assigned unlock levels (Smite/Searing 1 · Holy Nova 3 · Mend 5 · Aegis 7 · Atonement 9).
- New mechanics: `charge` targeting (gap-closer), missing-HP healing rider, and a `Marked` vulnerability handled in the shared damage applier.
- Tests: unlock gating (locked → no fire; unlocked → fires), Charge (closes distance + roots), Second Wind (heals), Hunter's Mark (marked targets take more) → **104 unit tests**; e2e green (8).

### ✅ Checkpoint 2 — Thornwood Vale + enemy tiers + Rare loot
- **Data-driven enemies** (`src/sim/content/enemies.ts`): a template table (shared level curve + per-template overrides) and a generic `spawnEnemy` with **tier multipliers**. `createBloomhusk/Reaver/Wisp` are now thin wrappers.
- **Thornwood Vale (zone 2)** families, placed out to the north-east (Lv 6–8): **Weaver** (fast melee swarm), **Bramblekin** (slow, heavy-armour bruiser), **Sporeling** (fragile fungal swarm).
- **Enemy tiers**: **elite** (×5 HP, ×1.5 dmg, ×5 XP, longer respawn) with an **enrage below 30% HP**, and a **rare-named** (×8 HP, ×12 XP, unique name) — both visually larger/tinted. A Greenmarch elite anchor (*Bloomhusk Matriarch*) and a Thornwood rare (*Old Thornback*).
- **Rare** rarity (blue, 2 affixes, ×1.20 budget) + **tier-aware drop tables** (standards lean common/uncommon; elites add Rare; rare-named mostly Rare). Loot beams + inventory show the new colour.
- Tests: data-driven spawn + tier scaling, Rare item gen, tier loot weights → **108 unit tests**.

### ✅ Checkpoint 3 — Oathstones, fast-travel + vendors
- **Oathstones** (`Oathstone`/`Respawn` components + `waypoint` system): waypoint shrines that **attune on proximity** and **bind your respawn** to the last one visited (death returns you there, not the world spawn — no XP loss). Activated stones + the bound point **persist in the save**. A hub stone at spawn auto-attunes; one waystation per region (Greenmarch, Thornwood Vale).
- **Fast travel** (`src/sim/travel.ts`, panel on **T**): hop between **attuned** Oathstones for a **small gold toll**, **out-of-combat only** — the discovered-waypoint network. Travelling rebinds your respawn to the destination.
- **Vendors** (`src/sim/vendor.ts`, panel on **F** by a stall): **sell** unwanted gear for gold (value scales with ilvl + rarity), with a **Sell all Common** button; locks are respected. A *Quartermaster* sits at the hub. Gold sink (toll) + source (sales) per the economy design.
- **Centralized interact**: the loot system no longer reads input; **F** is routed in one place — close an open vendor panel → pick up nearby loot → else open a vendor. Loot pickup is now `pickUpNearest` (pure, testable).
- **World markers**: Oathstone obelisks (dormant grey → bright cyan + pulse once attuned) and vendor posts, scanned from the world each frame.
- Tests: Oathstone attune/respawn-binding/save round-trip, vendor value/sell/lock/sell-commons/range, fast-travel toll/combat-gate/gold-gate/dormant/here → **123 unit tests**; an Oathstone-attune + fast-travel-panel e2e (9 e2e).

### ✅ Checkpoint 4 — onboarding + HUD/map v1
- **Onboarding / Goal Tracker** (`src/sim/onboarding.ts`, pure like Telemetry): a "teach the loop" checklist — **move → select a target → defeat an enemy → loot (F) → equip (I) → recover** — driven by sim events + player state. Completion persists (localStorage) so returning players skip it.
- **Goal Tracker HUD** (`src/render/goal-tracker.ts`): the dismissible "what now?" panel once onboarding is done — **level + XP to next**, **current zone + level range**, and a few **soft goals** (next bracket/zone, gear upgrade, fast-travel/rare hunt).
- **Regions** (`src/sim/content/regions.ts`, pure): `regionAt`/`regionLabel` for the canonical bands — **Oathhold** (hub) · **The Greenmarch** (1–5) · **Thornwood Vale** (6–10). Crossing a boundary shows a zone-discovery prompt.
- **Minimap + Map v1** (`src/render/minimap.ts`): an always-on, player-centred canvas minimap (region tint, Oathstones bright/dim by attune state, vendor, live enemies, a facing player-arrow) with a zone label; **M** toggles a large world-anchored map with named Oathstones. (Fast travel stays on **T** for v1.)
- Tests: regions point-lookup + labels, onboarding step completion from state/events + skip → **129 unit tests**; a Goal-Tracker/minimap/map-toggle e2e (10 e2e).

**0.3.0 is now feature-complete** — the automatable scope of the **Level 1–10 Gate** is in. The remaining sign-off (each class *feels* solo-viable 1→10; readable/soloable elite + rare; onboarding genuinely ≤2 min) is **owner playtest**.

**Verified:** `typecheck` ✓ · `npm test` → 129/129 ✓ · `build` ✓ (~161 KB gzip) · `test:e2e` → 10/10 ✓.

---

## 0.2.1-INDEV — "The Priest" → Three-Class Gate
**Goal:** the third class — a **Priest** who fights with holy power and survives by weaving heals, shields, and Atonement — completing the three operational classes. Targets the [Three-Class Gate](./docs/production/RELEASE_GATES.md#4-three-class-gate).

**Added**
- **Priest** (holy/SPR/Mana) in the class registry. Early kit: **Smite** (holy projectile filler), **Searing Light** (cast-time nuke), **Holy Nova** (PBAoE + self-heal), **Mend** (self-heal), **Aegis** (absorb shield), and **Atonement** (toggle: a share of spell damage heals the caster). Class-select now offers all three.
- **Healing system** (`src/sim/combat/heal.ts`): same shape as damage (base + coeff·SPR + **+Healing** affix), can crit; green floating numbers.
- **Shields** (`Shield` component): an absorb pool that soaks damage before HP (Aegis), decaying over its duration; shown on the HP bar.
- **Cast-time mechanic** (`CastState`): Searing Light channels a bar (HUD cast bar), resolves on completion, and **cancels if you move**.
- **Caster enemy** — the Greenmarch **Wisp**: stands and casts a telegraphed **blight** bolt that **bypasses armor** (typed `Enemy.attackType`), countered by LoS/burst. The camp is now Bloomhusks + Reavers + a Wisp.
- **Three-Class balance pass**: a combat-sim gate test runs all three classes vs a same-level standard and asserts each lands in the **3–6s TTK band** with the inter-class spread within tolerance; Priest holy damage (armor-ignoring) and Atonement sustain are tuned so it is **not** a weak healer.
- Tests: Priest mechanics (Smite/Mend/Aegis-soak/Atonement-leech/cast resolve+cancel), the **Three-Class Gate TTK** sim, class registry → **100 unit tests**; a "play as the Priest" e2e (8 e2e).

**Verified (automated):** `typecheck` ✓ · `npm test` → 100/100 ✓ · `build` ✓ (~154 KB gzip) · `test:e2e` → 8/8 ✓ (all three classes deal damage; save/reload). Warrior + Hunter + all prior systems remain green.

**Three-Class Gate (automatable parts) ✓:** all three solo a same-level standard; each TTK in band; inter-class spread within tolerance; Priest deals real holy damage (not a weak healer); Warrior is a bruiser (not a slow tank); Hunter uses no pet. The **subjective** parts (each class *feels* solo-viable end-to-end; elite soloable with correct play) remain owner-playtest — the camp now spans all three enemy archetypes to exercise it.

**Tuning note:** balance numbers are `v1` targets; precise inter-class parity is telemetry-tuned over many seeded matchups (per [TEST_STRATEGY](./docs/qa/TEST_STRATEGY.md)). The unit gate guards the band + gross imbalance.

**Not included (by design):** zones beyond Greenmarch, other families, elites/rares, interrupts (L12 kit), full kits past the early game, Reinforcement, consumables.

**How to test**
```bash
npm install && npm run dev   # pick Warrior / Hunter / Priest
# Priest: 1 Smite · 2 Searing Light (cast) · 3 Holy Nova · 4 Mend · 5 Aegis · 6 Atonement
```

**Next phase →** `0.3.0` "First Ten Levels" → **Level 1–10 Gate**: full Lv 1–10 ability unlocks for all classes, **Thornwood Vale** (zone 2) + its families, the first **elite** and **rare-named**, the full equipment slot set up to **Rare**, vendors/Oathstones/fast-travel, and onboarding. (This begins the **breadth** band — appropriate now that the Three-Class Gate is met.)

---

## 0.2.0-INDEV — "The Hunter"
**Goal:** a second, fully distinct class — a ranged **Hunter** — plus the ranged combat tech to support it, proving the slice works for more than one playstyle. Toward the [Three-Class Gate](./docs/production/RELEASE_GATES.md#4-three-class-gate).

**Added**
- **Data-driven classes** (`src/sim/classes.ts`): a class registry (primary stat, resource behaviour, ability kit). The Warrior (melee/STR/Fury) is unchanged; the **Hunter** (ranged/DEX/Focus) is new. A `PlayerClass` component + `setPlayerClass` make the kit/resource/primary swappable; **save** persists the class.
- **Hunter early kit**: Quick Shot (filler projectile), Piercing Arrow (Focus spender), Volley (cone of arrows), **Disengage** (off-GCD backflip + brief move-speed via a Fleet status), and **Snare Trap** (placed trap). Focus regenerates passively (vs Fury's build/decay).
- **Pooled projectiles** (`src/sim/projectiles.ts`): plain structs in a reused pool — zero per-shot allocation — that home to their target and resolve damage via the shared applier. Used by Hunter shots **and** enemy shots. Rendered from a matching mesh pool (`src/render/projectile-view.ts`).
- **Ranged-skirmisher enemy**: the Greenmarch **Reaver** — shoots and **kites** (back-pedals when you close), countered by closing the gap or breaking LoS. The camp is now mixed (Bloomhusks + Reavers). Any hit now aggros an idle enemy (ranged pulls work).
- **Traps + root** (`src/sim/systems/trap.ts`): Snare Trap roots + lightly damages the first enemy to enter, then is consumed; a `Root` status stops enemy movement (kiting tool). Rendered as a ground ring (`src/render/trap-view.ts`).
- **New ability targeting** in the combat system: `projectile`, `cone`, `dash`, and `trap`, alongside the existing melee/AoE/self.
- **Class-select** overlay for new characters (`src/render/class-select.ts`); the HUD is class-aware (Fury/Focus label, kit-driven hotbar incl. key 5); DEX/STR smart-loot so drops favour your class.
- Tests: class registry, Hunter projectile combat + a **Hunter TTK 3–6s** combat-sim, traps/root, the Reaver shooting the player, and class switching → **94 unit tests**; a new "play as the Hunter" e2e (7 e2e).

**Verified (automated):** `typecheck` ✓ · `npm test` → 94/94 ✓ · `build` ✓ (~153 KB gzip) · `test:e2e` → 7/7 ✓ (incl. Hunter ranged shots + save/reload). The Warrior path and all 0.1.x systems remain green.

**Tuning note:** Hunter single-target was tuned **down** into the TTK band and closer to the Warrior; the strict **inter-class ±20% TTK** balance is the job of the `0.2.1` Three-Class Gate (with the Priest), validated via the combat-sim + telemetry.

**Pending owner playtest:** is the Hunter *fun* and solo-viable end-to-end? does kiting feel good without trivializing (leash still holds)? plus the standing 0.1.x perf/fun items.

**Not included (by design):** the Priest (next), other zones/families, elites/rares, Reinforcement, consumables, full ability kits past the early game.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173 → pick Warrior or Hunter
# Hunter: 1 Quick Shot · 2 Piercing Arrow · 3 Volley · 4 Disengage · 5 Snare Trap
```

**Next phase →** `0.2.1-INDEV` "The Priest" → **Three-Class Gate**: the third class (holy damage + Atonement self-sustain + shields), a caster enemy archetype (telegraph + interrupt), and the inter-class balance pass (all three solo the slice within ±20% TTK).

---

## 0.1.1-INDEV — "Loop Hardening"
**Goal:** make the vertical slice **robust, performant, and measurable** — the engineering pass behind the [Core Loop Gate](./docs/production/RELEASE_GATES.md#3-core-loop-gate) so the owner's playtest runs on solid ground.

**Added**
- **Spatial grid broad-phase** (`src/sim/spatial-grid.ts` + `systems/spatial.ts`): a uniform-cell index rebuilt each tick, used for targeting candidate gathering and social aggro so neighbour queries stay near-O(1) as enemy counts climb toward the ≤40-active-AI budget. Integrated as an optional dependency (full-scan fallback preserved for tests).
- **AI throttling**: distant **idle** enemies update on a slow cadence (sim-radius gated) — they cost almost nothing until the player is near.
- **Leak hardening**: uncollected loot now **despawns after a grace period** (`LootDrop.ttl`), keeping world-entity count bounded over long sessions; per-tick **scratch arrays are reused** in the combat/AI systems to cut steady allocation churn.
- **Salvage v1** (`src/sim/salvage.ts`, unlocked Lv 3): convert unwanted gear into **Whetstones** + gold; **item lock**, per-item salvage, and **salvage-all-Common**. Materials are a wallet (not items), persisted in the save.
- **Inventory polish**: backpack **sorted by power**, gold + whetstone wallet, equip / lock / salvage actions, and the salvage-all button (Lv-3 gated with a hint).
- **Telemetry** (`src/sim/telemetry.ts`): kills, deaths, damage dealt/taken, XP, gold, loot, salvage, session time, and **avg TTK + downtime** — fed by sim events, shown on the perf overlay and exposed on the handle to validate the [SOLO_BALANCE_RULES](./docs/design/SOLO_BALANCE_RULES.md) bands during playtests.
- Tests: spatial grid, salvage (gating/yield/lock/salvage-all), telemetry, and a **loot-TTL leak proof** (entity count returns to baseline) → **85 unit tests**; a new telemetry e2e (6 e2e).

**Verified (automated):** `typecheck` ✓ · `npm test` → 85/85 ✓ · `build` ✓ (~150 KB gzip) · `test:e2e` → 6/6 ✓. New gate-relevant proofs: bounded entity growth (loot TTL); broad-phase + AI throttling bound per-tick work; telemetry surfaces TTK/downtime/death-rate.

**Pending owner playtest (unchanged from 0.1.0):** the "20-minute grind is enjoyable" rating, the real 60-minute memory-plateau session, and "60 FPS with 20 active enemies" on reference hardware — the structures are now in place to make those pass; telemetry gives the numbers to tune against.

**Not included (by design):** other classes (Hunter/Priest), other zones/families, elites/rares, Reinforcement upgrade, consumables — all later phases.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173
# Grind the camp; open I/C → sort/lock/salvage gear (salvage unlocks at Lv 3).
# The perf overlay now shows kills / avg TTK / downtime / deaths.
```

**Next phase →** `0.2.0-INDEV` "The Hunter" — the second class (ranged/Focus/kiting) + a ranged-skirmisher enemy archetype. **Gated on the owner's Core Loop playtest sign-off**: per the roadmap, do not widen to more classes until the loop is confirmed fun.

---

## 0.1.0-INDEV — "Vertical Slice"
**Goal:** the first **complete grinding loop** — as a Warrior, fight a Greenmarch camp, gain XP/levels, loot gear, equip upgrades, recover, repeat; the run persists. Targets the [Combat Gate](./docs/production/RELEASE_GATES.md#2-combat-gate) + [Core Loop Gate](./docs/production/RELEASE_GATES.md#3-core-loop-gate).

**Added**
- **Warrior early kit + Fury** (`src/sim/combat/abilities.ts`): Cleaving Strike (filler, builds Fury, frontal cleave), Sunder (spender + Armor Break), Whirl (self-AoE), Bulwark (off-GCD damage reduction). Resource cost/gain, Haste-scaled GCD, timed buffs/debuffs (`statuses.ts`), and leech — applied through one shared damage path (`src/sim/combat/apply.ts`).
- **Melee enemy AI** (`src/sim/systems/enemy-ai.ts`): Bloomhusks (Greenmarch) with idle→engage→attack→leash/reset(heal)→dead/respawn, aggro radius, **social aggro**, leashing, a telegraphed wind-up, and cheap steering (move + ground-snap + prop collision).
- **Progression** (`src/sim/stats.ts`, `progression.ts`): the canonical XP curve, the con (level-difference) system + anti-farm gray rule, level-up with stat recompute + refill.
- **Loot → inventory → equip** (`src/sim/loot/*`, `inventory.ts`): data-driven item generation (Common/Uncommon, per-slot budget + affixes), drop tables (~10% uncommon from a standard), corpse drops, gold auto-pickup, `F` to loot, equip with derived-stat recompute and upgrade deltas.
- **Recovery & death** (`src/sim/systems/recovery.ts`): out-of-combat HP ramp (≤8s) + Fury decay, in-combat Fury trickle, death → respawn at spawn with a **Shaken** debuff (no XP loss).
- **Save v1** (`src/sim/save.ts`, `src/platform/save-store.ts`): versioned serialize/apply (character, gold, gear, inventory, position) persisted to **IndexedDB**, autosave on key events + timer + page-hide, loaded on boot. (Migration/corruption hardening with `idb`+`zod` is scheduled for the Technical Beta phase per ADR-005.)
- **HUD & UI** (`src/render/hud.ts`, `inventory-panel.ts`, `loot-view.ts`, enemy con-colour nameplate): player frame (HP/Fury/XP/level + combat state), ability hotbar with cooldown/affordability, gold, loot prompt, toasts, an interactive inventory/equipment panel (`I`/`C`) with compare + equip, and rarity-coloured loot beams. Minimal procedural **audio** (`src/platform/audio.ts`).
- An entity **factory** (`src/sim/factory.ts`) shared by the bootstrap and tests.
- Tests: stats, items/loot, the warrior combat loop incl. a **TTK 3–6s** combat-sim, the enemy-AI FSM (aggro/social/leash), and a save round-trip → **72 unit tests**; Playwright now drives an attack/GCD sequence, targeting, and a **save/reload persistence** check (5 e2e).

**Removed:** the 0.0.4 target dummies (replaced by real Bloomhusk enemies + AI).

**Verified (automated):** `typecheck` ✓ · `npm test` → 72/72 ✓ · `build` ✓ (~149 KB gzip) · `test:e2e` → 5/5 ✓. Gate items checked by tests: damage = canonical formula; soft tab-target + range/LoS; GCD + cooldowns + resource costs; enemy aggro/social/leash/reset/respawn; TTK 3–6s; loot→inventory→equip; XP/level-up; save/reload restores state.

**Pending owner playtest (subjective/long-running gate items):** the "20-minute grind is enjoyable" rating, the 60-minute no-leak session, "60 FPS with 20 active enemies" on reference HW, and final balance tuning (camp density/aggro, drop cadence, TTK spread) — these need a human playtest and are the focus of `0.1.1`.

**Not included (by design):** other classes (Hunter/Priest), other zones/families, elites/rares, Rare+ rarity, salvage/Reinforcement, consumables, world bosses, class-select, full UI/map.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173
# 1–4 abilities, Tab/click to target, walk over gold + F to loot, I/C for inventory.
# Kill Bloomhusks → XP/level, loot drops, equip upgrades; progress saves automatically.
```

**Next phase →** `0.1.1-INDEV` "Loop Hardening": pooling/AI throttling/spatial grid, drop & inventory polish, salvage v1, telemetry counters, and the playtest-driven balance pass — making the slice robust and provably within the [SOLO_BALANCE_RULES](./docs/design/SOLO_BALANCE_RULES.md) bands.

---

## 0.0.4-INDEV — "First Contact"
**Goal:** a combat skeleton against a target dummy — select it, attack it, and watch damage numbers fly. First step toward the [Combat Gate](./docs/production/RELEASE_GATES.md#2-combat-gate).

**Added**
- **Combat ECS components** (`src/core/ecs/components.ts`): `Health`, `Offense`, `Defense`, `AbilityState`, `Target`, `Targetable`, `EnemyInfo`, `Dummy`, plus a `DamageType` school.
- **Canonical damage formula** (`src/sim/combat/damage.ts`) — `rawHit → mitigated (armorDR/resistDR/weakness) → crit → round(× variance)` with `armorDR = armor/(armor + K(L))`, `K(L)=50+25·L`. Pure & deterministic: the random crit/variance roll is passed in, so unit tests pin exact numbers.
- **Soft tab-targeting** (`src/sim/combat/targeting.ts`) — nearest-in-cone acquisition (~100° `v1`), Tab cycle, and a cheap segment-vs-cylinder line-of-sight check. All pure.
- **Combat system** (`src/sim/systems/combat.ts`) — ticks the GCD (1.0s `v1`) and per-ability cooldowns, a ~0.25s input buffer, soft-acquire / lock validation, applies the formula, faces the target, and emits combat events.
- **Two abilities on the GCD** (`src/sim/combat/abilities.ts`) — *Strike* (basic) and *Heavy Strike* (cooldown). Data-driven; no class resources yet.
- **Target dummies** (×3) that take damage and **auto-respawn** after death (`src/sim/systems/dummy.ts`).
- **Render/UI** (reads sim only): enemy view with capsule, billboarded HP bar, hit flash, and a target reticle (`src/render/enemy-view.ts`); **pooled** floating damage numbers (`src/render/damage-numbers.ts`); a target frame (`src/render/target-frame.ts`).
- **Input**: Tab (cycle target), Esc (clear), `1`/`2` (abilities), left-click (select) (`src/platform/input.ts`).
- Tests: damage / targeting / combat-system unit suites (**53 unit tests**); Playwright now drives an **attack + GCD** sequence and **Tab/Esc** targeting.

**Verified:** `typecheck` ✓ · `npm test` → 53/53 ✓ · `build` ✓ (~140 KB gzip) · `test:e2e` ✓ (boot + movement + attack/GCD + targeting).

**Acceptance (0.0.4):** input→hit feedback well under 100ms (30 Hz sim, next-frame numbers); damage matches the canonical formula in unit tests; GCD enforced (unit + e2e). ✓

**Not included (by design):** enemy AI/aggro/leashing, loot, progression/XP, classes & resources, healing/shields, status effects, interrupts.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173
# 1/2 to attack the dummies ahead, Tab to lock, click to select, Esc to clear
```

**Next phase →** `0.1.0-INDEV` "Vertical Slice": the Warrior early kit vs one Greenmarch enemy family with XP, loot, equip, and a v1 save — the first complete grinding loop → **Combat Gate + Core Loop Gate**.

---

## 0.0.3-INDEV — "Greybox Movement"
**Goal:** walk a character around a greyboxed world with a third-person camera, collision, and ground-snap. Reaches the **Core Movement Gate**.

**Added**
- Procedural greybox **terrain**: a deterministic heightfield with a flattened spawn and gentle hills, rendered as a vertex-coloured mesh (`src/world/heightfield.ts`, `src/render/terrain-mesh.ts`).
- **Kinematic character controller**: camera-relative WASD, gravity + jump, terrain ground-snap, static-collider push-out, world bounds (`src/sim/systems/movement.ts`, `src/sim/collision.ts`).
- **Third-person chase camera** with mouselook (hold right-mouse), wheel zoom, follow smoothing, and **collision spring** (raycasts terrain/props so the view never clips) (`src/render/camera-rig.ts`).
- **Input** controller (keyboard + mouse) exposing plain control state to the sim; **P** toggles pause (`src/platform/input.ts`).
- Player capsule with a facing indicator (`src/render/player-view.ts`); instanced rock props (one draw call).
- Render interpolation between fixed sim steps (`lerp`/`lerpAngle` in `src/core/math.ts`).
- Tests: heightfield sampling, collision push-out, math helpers (+ existing) = **29 unit tests**; Playwright now drives **WASD movement** and asserts the player moves and stays grounded.

**Removed:** the 0.0.2 spinning-cube demo (its instancing lesson now lives in the real terrain/props).

**Verified:** `typecheck` ✓ · `npm test` → 29/29 ✓ · `build` ✓ (~136 KB gzip) · `test:e2e` ✓ (boot + movement).

**Acceptance (Core Movement Gate):** smooth WASD movement; chase camera that doesn't clip terrain; no fall-through (ground-snap) and prop collision; a traversable terrain chunk; input working; loop stable. ✓

**Not included (by design):** combat, targeting, enemies, abilities, loot, UI panels.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173
# WASD to move, hold right-mouse to look, wheel to zoom, Shift sprint, Space jump, P pause
```

**Next phase →** `0.0.4-INDEV` "First Contact": a target dummy, soft tab-targeting, a basic attack + one ability on the global cooldown, the canonical damage formula, and floating damage numbers.

---

## 0.0.2-INDEV — "Scaffold"
**Goal:** an empty Three.js scene renders in-browser with a stable fixed-timestep game loop, an ECS-lite skeleton, and a performance overlay. Establishes the technical foundation before any gameplay.

**Added**
- Vite + TypeScript project; `three` rendering; strict `tsconfig`.
- Fixed-timestep simulation loop decoupled from interpolated rendering (`src/core/loop.ts`, `src/core/time.ts`).
- ECS-lite world — entities + data components + systems (`src/core/ecs/`).
- Seedable RNG (`src/core/rng.ts`) and a typed event bus (`src/core/events.ts`).
- Renderer with sun + hemisphere lighting, fog, ground plane, resize handling (`src/render/renderer.ts`).
- Demo scene: 144 instanced spinning cubes (**one draw call**) driven by the ECS — proves fixed-step sim + render interpolation + instancing (`src/render/demo-scene.ts`).
- Performance overlay devtool: FPS, frame ms, draw calls, entities, sim steps (`src/devtools/perf-overlay.ts`).
- Tests: Vitest unit suites (ECS, RNG, loop accumulator — 17 tests) + Playwright boot smoke test.
- Vercel static-deploy config (`vercel.json`); `.gitignore`.

**Verified**
- `npm run typecheck` ✓ · `npm test` → 17/17 ✓ · `npm run build` ✓ (~131 KB gzip JS) · `npm run test:e2e` ✓ (canvas renders, loop running, draw calls > 0, no console errors).

**Acceptance (Core Movement Gate baseline):** scene renders; loop ticks at fixed DT; perf overlay reports FPS/draw calls; build + tests pass. ✓

**Not included (by design):** movement, input, camera control, collision, combat, gameplay, content, art beyond primitives.

**How to test**
```bash
npm install && npm run dev   # open http://localhost:5173 — spinning cubes + perf overlay
npm test                     # unit tests
npm run test:e2e             # browser smoke test
```

**Next phase →** `0.0.3-INDEV` "Greybox Movement": WASD character controller, third-person chase camera, collision, and a greyboxed terrain chunk → **Core Movement Gate**.

---

## 0.0.1-INDEV — "Blueprint"
**Goal:** a complete, internally consistent development plan before any code.

**Added**
- 40 cross-linked planning documents under [`/docs`](./docs/README.md): research, design, technical, production, QA, assets, and decision records — covering the full path from `0.0.1-INDEV` to `1.0-BETA`.

**Not included (by design):** any runtime code, dependencies, or assets.

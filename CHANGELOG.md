# Changelog

Development proceeds **one phase at a time** (see [docs/production/VERSION_ROADMAP.md](./docs/production/VERSION_ROADMAP.md)).
Each entry is an **independently testable build**. After each phase, work pauses for testing before the next begins.

---

## 0.7.0-INDEV — "Feel & Finish" → UX, Accessibility & Content Polish *(in progress)*
**Goal:** make the game *feel finished to use* — full menus, tooltips/comparison, an audio + VFX pass, onboarding polish, and the **accessibility commit list** ([docs/design/UX_AND_ACCESSIBILITY.md](./docs/design/UX_AND_ACCESSIBILITY.md)), all persisting and taking effect without restart. **Gameplay feature-freeze begins** (no new systems). Built in verified checkpoints.

### ✅ Checkpoint 1 — Settings & accessibility core
- **A persisted Settings panel (`O`)** — device-local preferences (separate from the gameplay save) in `localStorage`, **applied live** to the DOM UI overlay (no restart) via CSS variables/classes (`src/game/settings.ts` + `src/render/settings-panel.ts`). Tolerant load (validates/merges/clamps unknown or old data → defaults), plus a **Reset to defaults**.
- **Accessibility options (first batch, all live):** **UI scale** (whole HUD/menus zoom together), **damage-number toggle + size**, **reduced effects** (motion & flashing — tones down crit pops + floating-number rise + UI transitions), and **high-contrast rarity**.
- **Colorblind-safe rarity (baseline, never color-only).** Every item now shows a **text tier tag** (`[C]/[U]/[R]/[E]/[L]/[★]`) **and a per-rarity border *shape*** (solid/dashed/dotted/double) in the inventory, plus the tag on loot toasts — so rarity reads without relying on color ([UX_AND_ACCESSIBILITY](./docs/design/UX_AND_ACCESSIBILITY.md) requirement). High-contrast mode thickens the borders.
- The framework audio volumes (CP3) and keybind remapping (CP4) will plug into next.
- Tests: settings merge/validate (defaults, clamping, enum/`NaN` rejection, JSON round-trip) + colorblind-safe tier tags → **276 unit tests**; a new **settings e2e** (open with `O`, toggle damage numbers off → applies live, change UI scale → live CSS var, **persists across reload**) → **14 e2e**. Build version bumped **`0.6.0-INDEV` → `0.7.0-INDEV`**.

**Verified:** `typecheck` ✓ · `npm test` → 276/276 ✓ · `build` ✓ (~176 KB gzip) · `test:e2e` → 14/14 ✓.

### ✅ Checkpoint 2 — item tooltips & comparison, character stats, destructive-action confirms
- **Hover tooltips with comparison** (the headline). Hovering any inventory/equipped item shows a full breakdown — name (rarity-coloured + tier tag), slot · ilvl, every stat line, the **relic effect**, salvage value — and, for a bagged item, a **"vs equipped"** block with per-attribute deltas (green/red) + the score change. The pure formatting/comparison core lives in `src/sim/loot/item-info.ts` (`itemStatLines` / `itemContributions` / `compareItems`); the DOM tooltip (`src/render/item-tooltip.ts`) sits on `<body>` so it isn't clipped or zoom-scaled.
- **Character stats, in-panel (the C view).** The inventory/character panel now shows a live **derived-stats** strip — primary, Max HP, Armor, Crit, Haste, Leech, Healing, and any typed resists — **each with a tooltip explaining what it does** ("Clarity: tooltips everywhere").
- **Confirmations before destructive actions.** Salvaging a **Rare-or-better** item is now a **one-click confirm** ("Salvage" → "Confirm?"), gated by a new **Confirm destructive actions** setting (default on). Commons/uncommons still salvage in one click.
- Added a `debugGiveItem` test hook (mirrors the existing debug hooks) to drive the inventory e2e deterministically.
- Tests: item-info formatting (percent vs flat, signed), affix labels, stat lines, contributions, and equip-vs-equipped deltas (incl. order + no-change) → **283 unit tests**; an **inventory e2e** (hover → tooltip with stats; Rare salvage asks to confirm before removing the item) → **15 e2e**.

**Verified:** `typecheck` ✓ · `npm test` → 283/283 ✓ · `build` ✓ (~178 KB gzip) · `test:e2e` → 15/15 ✓.

### ⏳ Remaining for "Feel & Finish" (next checkpoints)
- **CP3:** **audio pass** (Howler) + volume sliders in Settings · VFX/"juice" pass within budgets, respecting reduced-effects.
- **CP4:** **fully remappable keybinds** + camera/mouse options · onboarding polish (class tutorial cards) · any remaining HUD (buff/debuff durations, cast bar polish, low-HP vignette).

---

## 0.6.0-INDEV — "The Chase" → Equipment Depth + Lv-30 Endgame *(✅ feature-complete — awaiting playtest)*
**Goal:** the beta's long tail — the Lv-30 gear chase: **Legendary** + **Relic** tiers, **3 solo world bosses**, and target-farming → the **Endgame Foundation Gate** ([docs/design/ENDGAME_FOUNDATION.md](./docs/design/ENDGAME_FOUNDATION.md)). Built in verified checkpoints.

### ✅ Checkpoint 1 — Legendary rarity
- **Legendary** (orange, **4 affixes**, ×1.45 budget — the aspirational random-drop tier above Epic): the apex of *rolled* gear (hand-designed **Relics** come in CP3). Distinct loot-beam/bag/vendor colour + toast.
- **Drops as a tail** on the highest-value sources: ~6% on **rare-named** kills and ~1.5% on **elites** (never from standards). **Bad-luck protection** now treats Legendary as rare+ (resets the pity counter; the pity boost raises the Legendary tail too).
- Salvages into the most whetstones and sells for the most gold; reinforces like any item.
- Loot toasts now colour by rarity (rare/epic/legendary) instead of one generic style.
- Tests: Legendary gen (4 affixes, out-budgets Epic), drop tail (rare-named yes / standards never), counts as rare+ for BLP, pity raises the Legendary tail → **204 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 204/204 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

### 🌍 World expansion (owner-requested map pass — between CP1 and CP2)
A presentation/scale pass on the world (no gameplay-systems change), done at the owner's request before CP2. **Deliberately non-destructive to the rest of 0.6.0:** all data shapes, function signatures, enemy families/levels/tiers and named spawns are unchanged, collision is byte-for-byte the same (still only the rock cylinders), and world bosses (CP2) drop into the spread-out zones exactly as before — just with far more room.
- **A big open world.** The greybox grew from a 100 m square into a **680 m** open world (`src/world/layout.ts` centralises `WORLD_SIZE`/`WORLD_RES` + the hub/zone-threshold knobs). The **Greenmarch starter ring stays right outside town** (the first mob is still within melee of spawn — onboarding + the boot e2e depend on it); the **five higher regions are spread far out** in their directions (frontier zones begin at `ZONE_THRESHOLD = 120`), each now a distinct, multi-camp area. `regionAt` keeps the same directional layout at the new scale; spawn coords + Oathstones moved to match (families/levels/tiers preserved → the 1→30 balance + coverage suites still hold).
- **Biomes.** A pure, deterministic **biome field** (`src/world/biomes.ts`) shapes terrain elevation per region — the **Riven Peaks rise into snow-capped mountains** (east), the **Sunken Fen sinks** into a bog (south), Emberreach/Gravereach are raised, Thornwood rolls. The heightfield (sim) and the terrain mesh (render) read the same field, so they agree; the spawn stays flat and a small field (the unit tests' 100 m) is unchanged. Terrain is now **tinted per biome** (snow/rock, scorched red, murky fen, ashen ruins, forest green) with smooth borders.
- **Environmental variety** (was: rocks only). A pure scenery generator (`src/world/scenery.ts`) + an instanced renderer (`src/render/scenery-view.ts`) add **trees** (broadleaf / pine / dead-snag, biome-placed — Thornwood is thick forest, the Peaks are pine), **boulders, pebbles, bushes, grass tufts, Fen reeds, wildflowers**, plus **rivers** (a draped, translucent waterway winding through the heartland) and **roads** fanning from the hub out to each frontier Oathstone. All of it is **purely visual** (instanced, no colliders) and kept clear of camps/waypoints/the hub. Fog + camera far-plane widened for open-world vistas.
- **Follow-up polish** (owner feedback): (1) **organic biome borders** — the biome field is now domain-warped (radius-scaled, so the spawn/heartland stay tame) so zone edges wiggle naturally instead of forming axis-aligned rectangles; (2) **rivers/roads now actually render** — the draped ribbons were built with downward (back-face-culled) normals and sampled too coarsely; fixed the winding (up-facing), densified the terrain-hugging resample, lifted them off the ground, and made them double-sided; (3) **fixed a pre-existing strafe-inversion bug** — A/D were reversed relative to the chase camera (Three's `lookAt` makes screen-right = world −x; movement used +x), so strafing now matches the camera, with a new `movement.test.ts` pinning W/S/A/D to the camera.
- Tests: biome field (flat near hub, mountains east / bog south, directional dominance, bounded factors) + scenery generation (determinism, every layer populated, tree-variant mix, clearings respected, one road per target) + camera-relative WASD (no strafe inversion) → **220 unit tests**; regions retargeted to the new scale; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 220/220 ✓ · `build` ✓ (~169 KB gzip) · `test:e2e` → 11/11 ✓.

### 🧍 Player model + class weapons (owner-requested)
The placeholder capsule is replaced by a **procedural low-poly humanoid** (built from primitives — no asset files) with **class-distinct weapons so other players can read your class at a glance**: the **Warrior** carries a **sword + round shield** (+ a crested helm and shoulder pads), the **Hunter** a **longbow + nocked arrow** (+ a hood), the **Priest** a **glowing staff** (+ a hood and a holy halo). These are **purely cosmetic class identity** — equipped armour/weapons intentionally don't show on the model, leaving a clean seam for a future "show equipped gear" feature to slot in.
- **Procedural animation**: a speed-driven **walk cycle** (swinging legs/arms, body bob) + subtle idle breathing, and a one-shot **sword-swing / bow-draw / staff-cast** motion (the Priest's orb flaring on cast) played when an ability fires. All render-side.
- **Wiring**: a new **additive** sim event `AbilityUsed` — combat emits it the moment a player ability commits (past the target/resource guards), carrying class + targeting + cast time; the renderer subscribes to trigger the matching motion. No gameplay/balance/save change — the only sim touch is the new event.
- **Restyle** (owner feedback): reworked into a **chunkier, blockier, bigger and simpler** figure (a big cube head with simple eyes, thick solid torso/limbs) — dropped the crest, shoulder pads, halo, belt and visor for clean solid blocks, keeping the class weapons as the identity. Animation framework unchanged.
- **Weapon angle + cursor polish** (owner feedback): the **sword and staff now rest at a ~45° forward angle** (no longer dead-vertical through the arm/body), and the **mouse cursor hides while right-click-dragging** the camera (restored on release) so it no longer slides across the screen while you look around.
- Tests: combat emits `AbilityUsed` on a successful cast (and not when the ability whiffs with no target) → **222 unit tests**; e2e green (11). The per-test e2e timeout was raised 30 s → 60 s: the now-large open world renders slowly in the headless software-GL container (each heavy interaction test passes in ~20 s alone but contends under parallel load); real-hardware FPS is unaffected.

**Verified:** `typecheck` ✓ · `npm test` → 222/222 ✓ · `build` ✓ (~172 KB gzip) · `test:e2e` → 11/11 ✓.

### 👹 Enemy models + nameplates (owner-requested)
Every enemy family now has its **own unique low-poly model** (procedural primitives, no asset files) instead of the shared capsule — keyed by family + role so the three shared families split correctly (Sporeling/Sporemother, Bramblekin/Warchief, Ashen Reaver/Ember Warlord). ~21 distinct looks across 7 body archetypes — plant (Bloomhusks/Bramblekin), humanoid (Reavers/Drudges/Forsworn knights), floating (Wisps/Wraiths/Revenants/Cinderborn), spider (Weavers), mushroom (Sporelings/Sporemother), beast (Magmaw/Frostfang/Fenstalker) and crystalline/bone construct (Rimebound/Bonewrought) — each themed to its zone (magma cracks, frost ice, undead bone, blight glow…).
- **Name + level nameplate** above each enemy, in addition to the HP bar: a clean billboarded label (baked to a canvas texture) with the **name coloured by tier** (standard pale · elite orange · rare gold) and the level below, outlined for readability on any background.
- Models **flash on hit / tint during telegraphs** (all body materials, preserving caster/ghost glow), **floating creatures hover**, and the click-to-target raycast hits any part of the model.
- **Perf**: models + nameplates are created lazily for enemies near the camera and freed when they move far away (the open world holds ~80 spawns but only a camp or two is ever close); off-screen models are frustum-culled.
- The three CP2 **world bosses** also get unique, oversized models (a fiery Emberhorn beast, a frost Rimewyrm, the crowned Maelgrith), rendered at boss scale with a crimson nameplate.

**Verified (post-merge with CP2):** `typecheck` ✓ · `npm test` → 238/238 ✓ · `build` ✓ (~177 KB gzip) · `test:e2e` → 12/12 ✓.

### 🐦 Living world — enemy wander + ambient wildlife (owner-requested)
- **Idle enemies now wander.** Out of combat, standard enemies amble to random points within ~4.5 m of their spawn, pause, and repeat (at ~35 % move speed, facing where they walk), so camps feel alive instead of frozen. They stay well within leash range (no drifting between camps); aggro / social / leash are unchanged, and **world bosses loom in place** (no wander). The AI sim-radius widened (60→95 m) to match the enemy view distance so all visible enemies wander smoothly.
- **Ambient wildlife** (`src/render/ambient-life.ts`, render-only — no sim entities): **birds wheel overhead** (a flock that lazily follows you, flapping pale silhouettes), **critters** (rats/rabbits) scurry on the ground nearby in short dart-and-pause bursts, and **butterflies** flit close by. A small fixed pool follows the player around the open world (relocated off-screen), so there's always life nearby without spawning thousands — purely decorative (no collision, not targetable, not saved).
- Tests: idle enemies wander but stay near home; bosses don't wander → **240 unit tests**; e2e green (12).

**Verified:** `typecheck` ✓ · `npm test` → 240/240 ✓ · `build` ✓ (~179 KB gzip) · `test:e2e` → 12/12 ✓.

### ✅ Checkpoint 2 — three solo world bosses
- **Three hand-authored open-world bosses**, one deep in each of the three highest frontiers — **Emberhorn, the Cinder Tyrant** (Emberreach, fire, ~Lv 20), **The Rimewyrm** (Riven Peaks, frost, ~Lv 25), and **Maelgrith, the Hollow Crown** (Gravereach, blight/undead, the **Lv-30 capstone fight**). New `boss` enemy tier + a `Boss` component (`src/sim/content/bosses.ts`); they reuse enemy-ai for locomotion/basic swings and add a thin escalation layer.
- **Multi-phase escalation.** A new **boss-ai** system (`src/sim/systems/boss-ai.ts`) derives the boss's phase from its HP (Emberhorn/Rimewyrm 3 phases at 66 %/33 %; Maelgrith **4 phases** at 75/50/25 %) and announces each shift in the HUD. Later phases throw the heavy attack faster; the existing <30 %-HP enrage gives a desperation finish.
- **Telegraphed heavy attack** (reuses the **`GroundAoe`** primitive, now generalised with a `hitsPlayer` flag): on a per-phase cadence the boss drops a **danger-red zone at your feet that fills as it winds up** (~1.3–1.5 s) — stand in it when it lands and you eat a punishing hit (~27–30 % of a level-geared health bar); **step out and it whiffs.** The readable "move or die" beat that makes a solo boss a fight, not a tank-and-spank.
- **Big HP, solo-beatable.** Tuned against the real stat-derivation + damage formula so every class clears each boss as a genuine **multi-minute** fight (no HP wall, never trivial) and survives its basics; a heavy hurts hard but won't one-shot from full. Bosses are **lone** (no pack rally), leash to a wide arena, and **respawn on a 5-minute cooldown** for repeat farming.
- **Legendary-leaning loot.** A new `boss` drop tier **always drops Rare-or-better** (Epic-leaning, ~15 % Legendary) plus big XP/gold — the best *rolled*-gear source in the game (hand-designed **Relics** still come in CP3). Bosses render larger and deep-crimson; the rare Magmaw formerly named "Emberhorn" was renamed **Scorchmaw** so the boss owns the name.
- Tests: boss spawn shape (tier/HP/well-formed phases), Legendary-leaning loot (always rare+, real Legendary tail), a **solo-balance sim** for all three classes × all three bosses (sane time-to-kill, heavies punish but don't one-shot), phase-event escalation, and the heavy-attack mechanic (lands on a stander, whiffs on a dodger) → **238 unit tests**; a new in-browser **world-boss smoke e2e** (boss spawns huge, the fight runs error-free) → **12 e2e**. Build version bumped **`0.5.0-INDEV` → `0.6.0-INDEV`**.

**Verified:** `typecheck` ✓ · `npm test` → 238/238 ✓ · `build` ✓ (~173 KB gzip) · `test:e2e` → 12/12 ✓.

### ✅ Checkpoint 3 — Relics (hand-designed uniques + effect-hook plumbing)
- **A new apex tier — `relic`** (radiant teal, above Legendary, ×1.55 budget): hand-designed **uniques** with strong fixed stats **and a build-enabling effect**, defined as bespoke data (`src/sim/loot/relics.ts`), not random rolls. Four for the beta, one pool per world boss:
  - **Ashbrand, the Tyrant's Horn** (Emberhorn) — *Execute:* +50 % damage to targets below 35 % HP.
  - **Heart of the Rimewyrm** (the Rimewyrm) — *Boss-slayer:* +20 % damage to world bosses, −15 % damage taken from them.
  - **Crown of the Hollow King** (Maelgrith) — *Reaper:* each kill heals 8 % max HP and cuts all cooldowns by 1.5 s.
  - **Sael's Bloodroot Sigil** (Maelgrith) — *Bloodroot:* critical hits leech 25 % of damage as health.
- **Effect-hook plumbing (the reusable part).** Equipped relics aggregate into a plain-number **`RelicMods`** bundle (recomputed in `recomputeDerived`, like derived stats), and a *small, shared* set of hooks reads it — so the sim never hard-codes any specific relic:
  - `src/sim/combat/apply.ts`: attacker-side **execute** + **boss-slayer** multipliers and **crit-leech**, defender-side **boss damage-reduction** — sitting right beside the existing status multipliers.
  - `src/sim/rewards.ts`: on-kill **heal + cooldown-shave** (Reaper).
  Adding a future relic is "add a def (+ at most one `RelicMods` field & hook read)."
- **Drops & economy.** Relics are the **rarest** drops — an ~8 % tail on a world-boss kill (replacing that kill's normal roll), pulled from that boss's pool. They drop **auto-locked** (no accidental salvage), count as rare+ for **bad-luck protection**, and slot into salvage/vendor/loot-beam/HUD-toast/inventory exactly like any rarity (apex values). Pickup announces the effect; the inventory shows it on hover. **Save-compatible** (a new optional `Item.relic` field; effects re-derive on load).
- **Scope note (faithful to the plan):** relics are class-agnostic **combat-modifier** uniques (the clean foundation the effect-hooks were built for); per-ability relic effects (e.g. "Holy Nova chains") are a natural next extension of the same registry, not in this checkpoint.
- Tests: relic instantiation (rarity/effect/locked), the mods-aggregation bundle (incl. stacking), all four effect hooks driven through the **real** damage + kill code (execute ratio, boss-slayer in/out, crit-leech, reaper heal+CDR), boss drop logic (only from the killed boss's pool; a `rewardKill` integration loop), and **save round-trip** of an equipped relic → **253 unit tests**; e2e green (12).

**Verified:** `typecheck` ✓ · `npm test` → 253/253 ✓ · `build` ✓ (~174 KB gzip) · `test:e2e` → 12/12 ✓.

### ✅ Checkpoint 4 — the Lv-30 endgame loop + target-farming guidance (Endgame Foundation Gate)
- **The Lv-30 chase, made legible.** At the cap (XP already stops mattering) the **Goal Tracker pivots to "Endgame"**: it shows **Relic collection progress (N/4)** and points you at the **next relic to hunt** — naming the boss, its zone + direction, and the relic(s) it drops — then rotates to gear goals ("Reinforce toward the cap", "bosses respawn ~5 min"). No new combat systems: it directs the player through the systems CP1–CP3 already built.
- **A target-farming guide as data** (`src/sim/content/endgame.ts`): composes the bosses + relic pools + loot identities into an ordered **target board** with pure helpers (`relicProgress`, `nextRelicTarget`, `uncollectedRelics`) the UI and tests share.
- **Relic collection tracking** — a new `RelicCollection` component records every relic you've ever obtained (persists even if one is later salvaged); a picked-up relic is marked discovered (`pickUpNearest`), it's **saved** (a new `relics` field, reconciled from owned relics on load so old saves are correct), and it drives the chase's N/4 progress.
- **"Locate" the bosses** — the full **map now plots the three world bosses** as distinct crimson diamonds (with names), so the endgame targets are findable, not hidden (a Gate requirement: *locate → attempt → beat*).
- **Endgame Foundation Gate — automatable scope validated by tests:** every class **beats every world boss solo** with a realistic endgame loadout (full Legendary + that boss's Relic) in a sane time window; the full-Legendary power sits a **bounded** margin above the uncommon baseline (the soft power ceiling stays re-tunable); **target farming yields wanted upgrades within a focused session** (bad-luck protection bounds the dry streak to ≤ ~40 elite kills, and a session accumulates several rare+ candidates); world-boss loot floors at rare+. The **subjective "stays engaging across sessions"** check remains the owner's playtest.
- Tests: guidance data integrity (one target/boss, full non-overlapping relic coverage, locations match `regionAt`, progress/next-target helpers), relic discovery + save persistence, the every-class-beats-every-boss gate (+ bounded power ratio), and the target-farming/BLP guarantees → **270 unit tests**; a new **Lv-30 endgame e2e** (the tracker pivots to the relic chase; the boss-marked map renders error-free) → **13 e2e**.

**Verified:** `typecheck` ✓ · `npm test` → 270/270 ✓ · `build` ✓ (~175 KB gzip) · `test:e2e` → 13/13 ✓.

> **0.6.0 "The Chase" is feature-complete** (CP1 Legendary · world/biome/player-model pass · CP2 world bosses · CP3 Relics · CP4 endgame loop). The automatable scope of the **Endgame Foundation Gate** passes; the subjective retention/feel check is the owner's playtest. Next: **0.7.x** UX/accessibility polish.

---

## 0.5.0-INDEV — "Road to Thirty" → Complete Lv 1–30 Progression *(✅ merged — awaiting playtest)*
**Goal:** the final two regions and the rest of the kit so a character can run **1 → 30** end-to-end across all six zones (→ Level 1–30 Content Gate). Large phase, built in verified checkpoints (CP1–CP3, landed via PRs #16/#17/#19). All of `0.0.1`–`0.5.0` is now merged into `claude/game-design-docs-70dim2`.

> **Housekeeping (state sync):** the build's displayed version was bumped **`0.4.0-INDEV` → `0.5.0-INDEV`** (it had never been bumped during the 0.5.0 work) across `package.json`, `index.html`, the perf overlay, and the e2e check. Full health check on the merged HEAD: typecheck ✓ · 200/200 unit ✓ · build ✓ · 11/11 e2e ✓ · no conflict markers / code smells.

### ✅ Checkpoint 1 — Riven Peaks + Gravereach zones + the undead holy-weakness lever
- **The Riven Peaks (Lv 21–25)** to the **east** — frozen mountains introducing the **frost** damage school: **Rimebound** ice-construct bruisers (tanky, fire-weak), fast **Frostfang** packs, and **Revenant** casters (holy-weak). A **frozen-battlefield elite camp** (an elite *Frost Revenant Lord* + a Rimebound guard) and the roaming rare **Hoarfang the White**.
- **Gravereach (Lv 26–30)** to the **north** — the Hollow Crown, the journey's end: **Wraith** blight-casters, **Bonewrought** bone-construct packs, and **Forsworn Knight** pack-leaders — **all undead and holy-weak**. An **inner-court elite camp** (a *Forsworn Knight-Captain* + bone constructs) and the rare **Gravewarden Sael**.
- **Undead holy-weakness lever**: the Riven Revenants and every Gravereach family carry a **holy vulnerability** (×1.2–1.25), so the **Priest's** holy kit bites hardest in the endgame zones (a bonus, never a gate for other classes).
- **Frost resist** completes the typed-defence set: a new **+Frost Resist** armour affix rolls on gear, feeds `deriveStats → Defense.resist.frost`, and mitigates frost hits (matters but never fully negates) — the natural complement to the frost zone, mirroring how fire/blight resist arrived with theirs.
- **Regions + travel**: `regionAt` now lays out **east = Riven Peaks, north = Gravereach** around the hub; each gets an **Oathstone** (Frostgate Keep, Reclaimed Gatehouse) wired into respawn + fast travel, and the Goal Tracker now guides Lv 21→26→30 and tells you which resist to pack (frost for Riven; "undead are holy-weak" for Gravereach).
- Six new data-driven enemy families reuse the existing archetypes (bruiser / caster / pack-leader); no new systems — pure content + the frost-resist affix.
- Tests: Riven/Gravereach region bands + labels (and no Thornwood leak); new families' damage schools (frost) + the undead holy-weakness; holy damage amplified vs a holy-weak target; frost resist derives/equips/mitigates; high-ilvl armour rolls the frost affix → **169 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 169/169 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 2 — the Lv-30 capstone (upgrade-style; owner-chosen)
- **Each class gets an automatic Lv-30 capstone that *empowers an existing ability*** — no new hotbar button (the hotbar stays a clean 10 slots). At level 30 the class's signature spender becomes its mastered form: **Warrior** *Whirl → "Oathbreaker's Wrath"* (×1.8 damage + wider cleave), **Hunter** *Piercing Arrow → "Rapid Fusillade"* (×1.9), **Priest** *Searing Light → "Dawnbreak"* (×1.9). A real level-30 power/identity spike without UX bloat.
- Data-driven: a `Capstone` on each `ClassDef` + pure `empowerAbility` / `empowerKit` (`src/sim/classes.ts`). Below Lv 30 they're a **no-op (same references)**; at 30 only the target ability is replaced. **Combat** (damage) and the **HUD** (name) both consume the empowered kit, and dinging **30 toasts the capstone unlock**.
- Docs: `CLASS_DESIGN.md` gets an as-built note (the capstone is an upgrade, not an 11th button; the planned third choice node folded into it).
- Tests: capstone targets a real kit ability; below-30 no-op (reference identity); at-30 rename + stronger base/coeff/radius; non-target abilities untouched; the empowered ability deals **more damage through the real formula**; Hunter/Priest spenders empowered → **175 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 175/175 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 3 — full 1→30 validation (the automatable Level 1–30 Content Gate)
- **Spawn table extracted to pure content** (`src/sim/content/spawns.ts`, `WORLD_SPAWNS`): the world's enemy placements are now testable data (no Three.js), with a few standards added to fill level-band gaps (Lv 4/5/10/14/15/20/25/30).
- **Automated gate suites** (no new gameplay — verification + light content tuning):
  - **Spawn coverage**: `WORLD_SPAWNS` spans Lv 1–30, every 5-level band has grindable standards (no XP gaps), every leveling region is populated, and nothing spawns in the safe hub.
  - **Progression 1→30**: each class reaches the level cap (30) on the real XP curve with its full 10-slot kit unlocked and its Lv-30 capstone active.
  - **Combat balance 1→30** (18 class×zone sims through the real stat-derivation + damage formula): every class, at each zone's level with level-appropriate gear, can **kill that zone's tankiest standard with no HP wall** (< 60 casts) and **is not one-shot** (< 80% HP from a single hit). Catches genuine scaling blockers (e.g. armor nullifying damage, casters one-shotting).
- Result: **the 1→30 journey is automatically verified completable + balanced for all three classes** — no blockers surfaced; the content the parallel sessions built holds up.
- Tests: spawn coverage, progression, and combat-balance suites → **200 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 200/200 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

**0.5.0 is now feature-complete** (all 3 checkpoints). The **automatable** scope of the Level 1–30 Content Gate passes; the **subjective 1→30 playthrough feel** awaits owner playtest. After that, the natural next phase is **0.6.0** (equipment depth + the Lv-30 endgame: Legendary/Relic tiers, world bosses).

---

## 0.4.0-INDEV — "Fen & Ember" → Expanded Brackets (Lv 11–20) *(feature-complete — awaiting playtest)*
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

- Verified: `typecheck` ✓ · `npm test` → 146/146 ✓ · `build` ✓ · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 4 — Sunken Fen + Emberreach zones + elite camps
- **The Sunken Fen (Lv 11–15)** to the **south** — a blight bog: **Drudge** bruisers, **Fenstalker** ambushers (high aggro), and **Mireling** casters, all dealing **blight** (so the new blight resist matters). A **crypt-approach elite camp** (an elite *Crypt Drudge* backed by a Sporemother healer) and the rare **Henge-Keeper** deep in the bog.
- **The Emberreach (Lv 16–20)** to the **west** — scorched highlands: **Magmaw** heavy beasts, **Ashen Reaver** skirmishers, and **Cinderborn** casters (big fire telegraphs → interrupt/ground-AoE them), all dealing **fire**. A fire-cult **warcamp elite camp** (an **Ember Warlord** pack-leader + an elite *Cult Pyremaster* caster) and the roaming rare **Emberhorn**.
- **Regions + travel**: `regionAt` now lays the world out directionally around the hub (NE woods · south bog · west scorch); each new zone gets an **Oathstone** (Fenhollow Camp, Windbreak Outpost) wired into respawn + fast travel, a minimap tint, and a zone-discovery prompt. The Goal Tracker now points you to the next zone + the resist to pack.
- Six new data-driven enemy families reuse the existing archetypes (incl. CP3 support/pack-leader); no new systems — pure content.
- Tests: Fen/Ember region bands + labels, the new families' damage schools (blight/fire) + the Warlord's pack-leader archetype → **150 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 150/150 ✓ · `build` ✓ (~162 KB gzip) · `test:e2e` → 11/11 ✓.

### ✅ Checkpoint 5 — Epic rarity + Reinforcement + bad-luck protection
- **Epic rarity** (purple, **3 affixes**, ×1.32 budget — the "strong build piece" tier): rolls on the **elite** drop table (a ~7% tail) and the **rare-named** table (~15% tail); never from standards. Loot beams, the bag, and the vendor panel show the new purple; colourblind-safe tier text/labels unchanged. Epic salvages into more whetstones and sells for more gold.
- **Reinforcement** (`src/sim/reinforce.ts`) — the optional gold + whetstone **upgrade sink** (ADR-010): spend currency to add **+1..+5 effective item levels** to a piece you own, strengthening its **base stats** (primary + armor) and rescoring it. Rising per-step cost, hard cap at +5 (stays below the next rarity's natural power). A **⚒ Reinforce** button on every bag **and equipped** item shows the next step + cost; reinforcing equipped gear recomputes derived stats live. Items carry a `reinforced` step count that **persists in the save**.
- **Bad-luck protection v1** (`LootLuck` component + `pityMultiplier`): a **pity counter** rises on every kill that doesn't drop rare-or-better and **boosts the rare+ weight** (+8%/kill, capped +200%); it **resets to 0** the moment a rare+ finally drops. Makes target-farming elites/named feel fair without hidden total-drop inflation. Persists in the save.
- Tests: Epic gen (3 affixes, out-budgets Rare) + epic drop tails (elite/rare yes, standard never); pity multiplier ramp + cap; **`rewardKill` BLP integration** (pity climbs on unlucky kills, resets on a rare+ drop); Reinforcement cost ramp, currency spend, stat/score boost, +5 cap, affordability gate, **equipped-armor recompute**, and reinforced+pity save round-trip → **161 unit tests**; e2e green (11).

**Verified:** `typecheck` ✓ · `npm test` → 161/161 ✓ · `build` ✓ (~163 KB gzip) · `test:e2e` → 11/11 ✓.

**0.4.0 is now feature-complete** (all 5 checkpoints done). Awaiting owner playtest of the full Lv 11–20 experience (zones, mechanics, Epic/Reinforcement chase) before closing the bracket and moving to **0.5.0** (Lv 21–30 / the complete 1–30 journey).

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

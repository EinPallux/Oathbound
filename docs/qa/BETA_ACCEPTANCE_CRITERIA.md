# 1.0-BETA Acceptance Criteria

The **objective definition of done** for Oathbound 1.0-BETA. This is the contract the [1.0-BETA Gate](../production/RELEASE_GATES.md#10-10-beta-gate) checks. 1.0-BETA represents a **polished, complete local single-player foundation** — it does **not** need real multiplayer.

A build is **1.0-BETA** only when **every** box below is checked, all [RELEASE_GATES](../production/RELEASE_GATES.md) pass as current invariants, and the [final quality review](../production/ASSUMPTIONS.md#final-quality-review-brief-31) is green.

## Content & systems
- [ ] **Finished class-selection** experience.
- [ ] **Warrior, Hunter, Priest** — all three playable and solo-viable.
- [ ] **Complete solo progression from level 1 to 30** for each class, with **no progression blocker**.
- [ ] A **coherent open world**: hub **Oathhold** + **six** visually distinct regions, connected with working travel/Oathstones.
- [ ] **Sufficient enemy variety**: standard, elite, and **rare-named** enemies, plus **open-world bosses / pinnacle encounters** appropriate for solo play (the 3 world bosses).
- [ ] **Responsive combat** meeting the [Combat Gate](../production/RELEASE_GATES.md#2-combat-gate) (≤100 ms feedback; TTK bands).
- [ ] **Meaningful class progression**: full ability kits to 30 + the three choice nodes, free respec in town.
- [ ] **Equipment & inventory**: 12 slots, **multiple rarities** (Common→Relic), **useful loot comparison** (delta tooltips), item lock, salvage, sort/filter.
- [ ] **Gold and vendors** with functioning sources/sinks.
- [ ] **A functioning level-30 gear chase** (rares, elites, world bosses, target farming, bad-luck protection, optional Reinforcement).

## Onboarding, guidance & navigation
- [ ] **Minimal onboarding** (≤2 min to first kill) teaching move/target/ability/loot/equip/recover.
- [ ] **Very limited quest dependence** — leveling is grind-driven, not quest-driven (Pillar 3).
- [ ] A **world map / equivalent navigation tool** + the Goal Tracker; a returning player re-orients in <1 min.

## Persistence
- [ ] **Local saving** (IndexedDB), autosave + manual, multiple character slots.
- [ ] **Save migrations** pass for every historical schema version; **export/import** round-trips losslessly.
- [ ] Corruption detection + backup recovery; confirmations before destructive actions.
- [ ] **No known save-destroying bugs.**

## Settings, accessibility, performance
- [ ] **Settings**: remappable controls, sensitivity, camera options, audio.
- [ ] **Accessibility options**: UI scaling, colorblind-safe rarity (shape+label, not color alone), reduced flashing/shake, effect intensity, damage-number/combat-text controls, clear cooldown/resource/target readouts, **pause**.
- [ ] **Performance options**: shadows, draw distance, effects/reduced-effects, resolution scale, nameplate density.
- [ ] **Audio and visual feedback** present for combat, loot, level-up, and UI (within budgets).

## Technical & deployment
- [ ] **Stable Vercel deployment** (static build; no backend/DB/account).
- [ ] **Browser compatibility**: loads and plays in **Chromium + Firefox**; reduced-effects mode runs on integrated graphics.
- [ ] **All [PERFORMANCE_BUDGETS](./PERFORMANCE_BUDGETS.md) met** on the reference machine; never below min-acceptable FPS in normal play.
- [ ] Global **error handling** (recoverable screen, not a blank canvas).

## Quality bars
- [ ] **No critical progression blockers.**
- [ ] No critical/blocker bugs open ([Content Beta Gate](../production/RELEASE_GATES.md#9-content-beta-gate)).
- [ ] Playtest KPIs in band ([PLAYTEST_PLAN](./PLAYTEST_PLAN.md)).

## The experiential bar (must be true)
> A player can **start a new character, reach level 30, develop a build, improve equipment, explore the complete beta world, and continue farming meaningful upgrades** — entirely **solo**, **locally**, with **no account or backend**, deployed on **Vercel**.

## Explicitly NOT required for 1.0-BETA
Real multiplayer, accounts, servers, networking, dungeons, raids, guilds, PvP, factions, trading, auction house, global chat, mail — all deferred ([DEFERRED_FEATURES](../production/DEFERRED_FEATURES.md), [POST_BETA_MMO_HORIZON](../production/POST_BETA_MMO_HORIZON.md)). Their absence is **not** a beta defect.

## Sign-off
1.0-BETA ships when this checklist is fully green, gates 1–10 pass, and a fresh-character full playthrough per class is completed without a critical issue. Record the evidence (test reports, perf captures, playthrough notes, telemetry exports) with the release.

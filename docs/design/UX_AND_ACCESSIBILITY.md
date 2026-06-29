# UX & Accessibility

Canonical owner of: HUD layout, menus, onboarding UX, control remapping, and accessibility options. Pillar 6 (accessible browser gameplay) + the brief's accessibility requirements. The local single-player build **supports pause**.

## HUD (combat readability first)
- **Player frame:** HP, resource (Fury/Focus/Mana), level, XP bar, active buffs/debuffs with durations.
- **Target frame:** name, level, **con color**, HP, tier marker (elite/rare), cast bar with the ability name (so interrupts are informed).
- **Hotbar:** ability icons with **clear cooldown sweeps + numeric timers**, resource-cost dimming when unaffordable, GCD shimmer.
- **Reticle/nameplates:** current target highlighted; nearby enemies show compact nameplates (toggle density).
- **Minimap + Goal Tracker:** zone name & level range, Oathstones, the dismissible [Goal Tracker](./CORE_GAMEPLAY_LOOP.md#the-goal-tracker-lightweight-hud-element).
- **Combat feedback:** floating damage/heal numbers (togg*able* and style-configurable), crit emphasis, hit flashes, low-HP vignette.

## Menus
- **Inventory (I):** grid, compare-on-hover, sort/filter, salvage-all-below-rarity, item lock. See [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md).
- **Character (C):** equipped gear, stats with tooltips explaining each stat's effect.
- **Skills (K):** ability list, unlocks, the three **choice nodes** (free respec in town).
- **Map (M):** zone atlas, Oathstone fast-travel, discovered rares.
- **Settings:** controls, graphics/performance, accessibility, audio, save management.

## Onboarding (≤ 2 min to first kill)
Short, skippable, diegetic prompts teach: move (WASD) → camera → target (Tab) → use an ability → kill → loot → equip an upgrade → recover. Optional **class tutorial** cards appear on each new ability unlock. No long dialogue. Full philosophy in [CORE_GAMEPLAY_LOOP](./CORE_GAMEPLAY_LOOP.md#guidance--quests).

## Controls & input
- **Fully remappable** keybinds; sensible defaults ([COMBAT_DESIGN](./COMBAT_DESIGN.md#3-controls-map-default-remappable)).
- **Mouse sensitivity** & invert options; **camera options** (distance, FoV, shake amount, follow smoothing).
- **Keyboard navigation** for menus where practical.
- Designed for **keyboard + mouse**; UI is responsive but desktop is the priority (no mobile-first controls in beta).

## Accessibility options (commit list)
| Category | Options |
|---|---|
| **Visual** | UI scaling; readable font sizes; **colorblind-safe rarity** (label + border *shape*, not color alone); colorblind palettes; high-contrast nameplates. |
| **Motion/flash** | reduced flashing; reduced camera shake; reduced/disabled hit-stop; effect-intensity slider; **reduced-effects mode** (caps particles/post-processing — also a perf win). |
| **Combat text** | damage-number toggle/size/style; combat-log verbosity; clear telegraph emphasis option. |
| **Clarity** | clear cooldown indicators; clear resource display; clear target info; tooltips everywhere; optional larger reticle. |
| **Pace** | **pause** (P) for the local game; confirmations before destructive actions (salvage rare+, delete save). |

> **Rarity is never color-only.** Every rarity shows a text tier + a distinct border, so colorblind players read loot at a glance ([ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md#rarity-tiers)).

## Reduced-effects / performance-accessibility overlap
The reduced-effects mode doubles as both an **accessibility** feature (motion/flash sensitivity) and a **performance** feature (lower-end hardware). It caps particle counts, disables heavy post-processing, simplifies shadows, and lowers nameplate density. Tied to [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md) and graphics settings (shadow quality, draw distance, resolution scaling).

## Pause behavior
As a local single-player game, `P` pauses simulation and shows a menu. Pausing is **not** removed for the sake of a hypothetical future multiplayer build (the brief is explicit). When multiplayer eventually exists, pause becomes a menu-overlay-without-sim-stop in online contexts only.

## Feedback & "juice" (within budgets)
Tasteful screen-space feedback (hit flashes, crit pops, loot beams, level-up flourish, ability sounds) makes combat feel good — but **must respect** the reduced-motion/reduced-effects toggles and never obscure enemy telegraphs ([COMBAT_DESIGN](./COMBAT_DESIGN.md#8-enemy-telegraphs--feedback)).

## Acceptance hooks
Accessibility items are checked in the [Content Beta Gate](../production/RELEASE_GATES.md#9-content-beta-gate) and [BETA_ACCEPTANCE_CRITERIA](../qa/BETA_ACCEPTANCE_CRITERIA.md): every option present, persists in save/settings, and takes effect without restart.

> **Implemented (0.7.0 "Feel & Finish").** A persisted **Settings panel (`O`)** — device-local in `localStorage`, applied live (no restart) — now carries the commit list: **UI scale**, **damage-number** toggle/size, **reduced effects** (motion & flashing), **high-contrast + colorblind-safe rarity** (text tier tag + per-rarity border *shape*, never colour-only), **audio volume + mute**, **confirm destructive actions**, **mouse sensitivity + invert-Y**, and **fully remappable keybinds** (`src/game/keybinds.ts` + the InputController; Tab/Esc fixed). Plus item **hover tooltips with equip-comparison**, a **character stats** strip with per-stat tooltips, and a reduced-effects-aware **low-HP vignette**. The HUD's cast bar + numeric cooldowns + combat-state were already in place. Remaining optional polish: buff/debuff **duration icons** and onboarding **class-tutorial cards**. Subjective feel/UX is the owner's playtest.

# Core Gameplay Loop

This document defines the moment-to-moment, session, and long-horizon loops, plus the reward cadence that keeps grinding satisfying. It is the heartbeat the whole game serves. Pillars: see [GAME_VISION](./GAME_VISION.md).

## The loops, nested

### A. Micro loop (seconds) — a single fight
1. Acquire target (soft-target/Tab) → 2. Open with an ability → 3. Manage resource & cooldowns → 4. React to enemy telegraph (dodge/interrupt/defensive) → 5. Kill → 6. Pick up loot/gold → 7. Brief recover → repeat.

**Health metric:** a same-level normal fight is **3–6s** and leaves you at **≥70% HP** when appropriately geared (see [SOLO_BALANCE_RULES](./SOLO_BALANCE_RULES.md)).

### B. Core loop (minutes) — a grinding pocket
Explore → **discover a monster area** → clear pulls → bank XP → **find loot** → compare & equip → maybe unlock/improve an ability → notice a rare spawn or elite camp → decide: push, farm, or move on.

### C. Session loop (30–90 min)
Enter world → check goals (next level, a wanted drop, a rare to hunt) → grind a zone → ding a level / get an upgrade / clear a named rare → bank progress (autosave) → set a next target → log off cleanly. The game must be **easy to return to after days away** (clear "what now?" via the goal tracker, see below).

### D. Progression loop (hours → the whole game)
Level brackets unlock abilities and new zones → gear improves → builds form → reach **level 30** → enter the **endgame gear chase** (rares, elites, world bosses, target farming). See [PROGRESSION_AND_XP](./PROGRESSION_AND_XP.md) and [ENDGAME_FOUNDATION](./ENDGAME_FOUNDATION.md).

## Why grinding stays satisfying (the anti-boredom checklist)
Grind quality comes from **layered, overlapping reasons to keep going**, not bigger HP bars:
- **Responsive combat** (tight input→feedback; see [COMBAT_DESIGN](./COMBAT_DESIGN.md)).
- **Meaningful enemy differences** (families with distinct behaviors; see [ENEMY_DESIGN](./ENEMY_DESIGN.md)).
- **Drop anticipation** (rarity beams, near-miss bad-luck protection; see [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md)).
- **Visible power growth** (numbers go up *and* you feel it).
- **Class mastery & build development** (ability choices, gear synergies).
- **New zones & rare discoveries** (exploration dopamine).
- **Short- and long-term goals always coexisting.**

## Reward cadence (target rhythm)
A player should almost always be **< ~2 minutes from a small reward** and **< ~20–30 minutes from a meaningful one**.

| Cadence | Reward | Source |
|---|---|---|
| Every fight | XP, gold, common drops, hit/crit feedback | normal kills |
| Every few minutes | an uncommon/rare drop, a resource node, a discovery | grind |
| Every ~10–20 min | a level, an ability unlock, a noticeable upgrade | bracket pacing |
| Every ~20–40 min | a rare-named kill, an elite camp clear, a wanted slot upgrade | targeted farming |
| Per session | a build milestone, a new zone, a world-boss attempt | exploration/endgame |

If telemetry (see [../qa/PLAYTEST_PLAN.md](../qa/PLAYTEST_PLAN.md)) shows a dry spell longer than these targets, tune drop rates or pacing — **do not** add busywork quests.

## Session shapes we support
- **Short (10–20 min):** clear a known camp, bank a level or a drop, log off mid-grind safely (autosave + resume).
- **Long (60–120 min):** push a new zone, hunt a rare, attempt a world boss, reorganize a build.
- **Return-after-days:** the **Goal Tracker** restates "you're level X, your next zone is Y, you were hunting Z," so re-entry is frictionless.

## Guidance & quests (minimal by design)
Per Pillar 3, quests are **scaffolding, not the spine**. We use:
- A **short onboarding** (≤2 min to first kill): move, target, use an ability, loot, equip.
- **Optional class tutorials** surfaced on ability unlocks.
- **Zone-discovery** prompts ("The road north leads to Thornwood Vale, Lv 6–10").
- **Feature-unlock objectives** (e.g., first salvage, first upgrade, first waypoint).
- A few **handcrafted world events** and **optional milestone challenges** (e.g., "defeat a rare in each zone").

We **avoid**: long NPC dialogue, fetch chains, kill-quests that merely re-skin grinding, quest-gated zone unlocks, and screen-covering markers. Guidance prefers **world markers, signposts, environment design, monster-level labels, and map labels**. Full UX in [UX_AND_ACCESSIBILITY](./UX_AND_ACCESSIBILITY.md).

## The Goal Tracker (lightweight HUD element)
A small, dismissible panel that always answers "what now?":
- Current level & XP to next; current zone & its level range.
- Up to 3 soft goals: e.g., "Reach Lv 11 → unlock Sunken Fen," "Upgrade your weapon," "Hunt the rare *Gravewright*."
- It **suggests**, never forces; it is not a quest log full of fetch tasks.

## Failure & friction we explicitly prevent
- No mandatory downtime that isn't fun (recovery ≤8s out of combat; see [SOLO_BALANCE_RULES](./SOLO_BALANCE_RULES.md)).
- No inventory management every few kills (generous stacks, auto-pickup gold, salvage-all; see [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md)).
- No "follow the marker for an hour" stretches.
- No XP wall that converts the grind into a chore.

# Game Vision — Oathbound

## One-sentence pitch
> A chill, solo-friendly 3D browser MMORPG where you take up a broken Oath, pick a class, explore a compact fantasy world, grind monsters, grow a build, reach level 30, and chase ever-better gear — no account, no group, no download required.

## The fantasy
You are an **Oathbound**: someone who has sworn the old Warden's Oath to protect the region of **Aldermere** now that its original protectors have fallen and a creeping corruption — the **Blight** — spreads from the ruined heart of the land. The story is light and largely environmental; the *feeling* is a small but genuine living MMO world.

## The intended experience
A relaxing, approachable browser MMORPG-style game where the player **chooses a class, explores an open fantasy world, grinds monsters, becomes stronger, finds increasingly exciting equipment, develops a build, reaches level 30, and continues hunting for valuable gear.**

It should feel like a real MMORPG through its world, progression, combat, enemies, equipment, classes, UI, and long-term goals — while **honestly remaining a local single-player experience** for the 1.0-BETA milestone.

## What success feels like (player verbs)
*Explore → discover a monster area → fight → earn XP → find loot → compare & equip → unlock/improve abilities → push into more dangerous areas → hunt stronger monsters and rarer drops → repeat with increasingly meaningful decisions.*

## Design pillars (the constitution)
All roadmap and design decisions must serve these. Full detail in the [GAME_DESIGN_DOCUMENT](./GAME_DESIGN_DOCUMENT.md#3-design-pillars).

1. **Solo-First, Not Solo-Possible** — solo is the primary experience; no class is balanced around a second player.
2. **Grinding Is the Main Progression** — satisfying because of responsive combat, meaningful enemies, drop anticipation, visible growth, and builds — *not* just bigger HP bars.
3. **Minimal Quest Dependence** — guidance over fetch-quests; you never spend the game following markers NPC-to-NPC.
4. **Compact but Meaningful Open World** — interconnected, dense, navigable — never huge and empty.
5. **Equipment Is a Major Motivation** — loot is a top retention pillar with legible, deep upgrade decisions.
6. **Accessible Browser Gameplay** — fast to enter, readable on a normal monitor, performant on mid-range desktops, deep enough to reward mastery.

## What Oathbound is NOT
A menu/idle game · a combat demo · a short tech prototype · a wave-survival game · a linear quest RPG · a lobby dungeon game · a pile of unfinished MMO systems · a fake MMO with simulated players · a shallow "MVP" with one tiny example of every feature.

**Prioritize depth in the core loop over breadth across incomplete systems.**

## Scope boundary for 1.0-BETA
- One local player; local save; runs in a modern desktop browser; deployable to Vercel.
- No account, login, backend, or database. No real or fake multiplayer.
- Three classes (Warrior, Hunter, Priest); levels 1–30; 6 leveling regions + hub; standard/elite/rare/world-boss enemies; full equipment & inventory; a level-30 gear chase.

See the precise bar in [BETA_ACCEPTANCE_CRITERIA](../qa/BETA_ACCEPTANCE_CRITERIA.md) and the deferred list in [DEFERRED_FEATURES](../production/DEFERRED_FEATURES.md).

## North-star metric
A new player can **start a character, reach level 30 in roughly 12–18 hours, develop a viable solo build, improve equipment, explore the whole beta world, and still have meaningful gear to chase** — and *want* to keep grinding.

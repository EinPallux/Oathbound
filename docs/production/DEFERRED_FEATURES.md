# Deferred Features

Systems **explicitly out of scope for 1.0-BETA**. This list is a scope-creep firewall: if a request appears here, the answer during the beta is **"not now — recorded for the post-beta horizon."** Sequencing for some of these (if ever pursued) lives in [POST_BETA_MMO_HORIZON](./POST_BETA_MMO_HORIZON.md).

> **⚠️ Partial supersession ([ADR-013](../decisions/DECISION_RECORDS.md#adr-013-going-online--authoritative-node-server--sqlite)):** the owner has since committed to the online track. **Multiplayer servers, real-time networking, accounts, authentication, and global chat** are now *in scope* via the [MMO_ROADMAP](./MMO_ROADMAP.md) (phases M0–M8). Everything else below (dungeons, raids, PvP, trading, guilds, auction house, mail, housing, mounts, monetization, …) **remains deferred**.

## Hard-deferred (do not schedule into early development)
Dungeons · Raids · Accounts · Authentication · Multiplayer servers · Real-time networking · Guilds · Clans · PvP · Factions · Trading · Auction house · Global chat · Mail · Player housing · Mounts & mount breeding · Large crafting professions · Multiple character races with unique skeletons · More than three classes · Extensive story campaigns · Cinematics · Monetization · Battle passes · Cash shops · Mobile-first controls · Procedurally infinite worlds.

## Why each is deferred (grouped)
| Group | Items | Reason |
|---|---|---|
| **Requires a server** | accounts, auth, multiplayer, networking, guilds, global chat, mail, trading, auction house, live economy | the beta is honestly local single-player; a static Vercel app can't host an authoritative server. Building these now is premature ([FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md)). |
| **Group content** | dungeons, raids, parties | genuine *group* content; faking it with bots is explicitly forbidden. Must wait for real multiplayer **and** a proven solo loop. |
| **Competitive** | PvP, factions | needs server authority + anti-cheat + balance pass; irrelevant to a solo beta. |
| **Scope/content sinks** | extra classes/races, big crafting, story campaigns, cinematics, mounts/breeding, housing | each is a large system that competes with polishing the level 1–30 solo loop (depth-over-breadth). |
| **Business** | monetization, battle passes, cash shops | not part of the beta's purpose; avoid design distortion. |
| **Platform** | mobile-first controls | beta is keyboard+mouse desktop-first (responsive, not mobile-first). |
| **Tech direction** | infinite procedural worlds | we want a compact, authored, dense world (Pillar 4). |

## The "do-not-proceed" rule (raids/dungeons specifically)
Raids and dungeons are an **important long-term endgame goal**, but **no production work** on them begins until **all** of the following are true (re-stated from the brief; enforced via [PHASE_DEPENDENCIES](./PHASE_DEPENDENCIES.md) and gates):
1. all three classes playable & balanced for solo progression
2. complete level 1–30 path exists
3. world has sufficient grinding content
4. equipment progression functional
5. level-30 open-world farming functional
6. core combat polished
7. enemy AI stable
8. local saves reliable
9. performance budgets met
10. the core-loop playtest gate passed

Because raids/dungeons are **genuine group content**, we do **not** fake them with artificial player bots to pad the beta. If they don't logically fit before 1.0-BETA (they don't), they live in the clearly-labeled [POST_BETA_MMO_HORIZON](./POST_BETA_MMO_HORIZON.md).

## Smaller deferrals (item/system level)
Sockets/gems, runewords, full crafting trees, transmog/cosmetics, account-bound stash, item trading, durability/repair (cut for friction), a second resource per class, talent *trees* (we use 3 light choice nodes instead), seasons/ladders, daily/weekly systems, achievements meta. Recorded here so they aren't quietly added.

## What is NOT deferred (in scope for beta — for contrast)
Three classes; full 1→30; six regions; standard/elite/rare/world-boss enemies; equipment with rarities/affixes/comparison; gold & vendors; salvage + optional Reinforcement; level-30 gear chase; local saves + migration; settings/accessibility/performance options; Vercel deploy. See [BETA_ACCEPTANCE_CRITERIA](../qa/BETA_ACCEPTANCE_CRITERIA.md).

## Handling a deferred-feature request mid-development
1. Confirm it's on this list (or belongs here). 2. Add it to the post-beta backlog with a one-line rationale. 3. Do **not** start it. 4. Re-affirm the current band's gate. This keeps R1 (scope creep) and R23 (raids too early) in check ([RISK_REGISTER](./RISK_REGISTER.md)).

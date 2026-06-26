# Game Design Document — Oathbound (umbrella spec)

This is the **top-level design spec**. It states the canonical "at a glance" facts and links to the detailed document that owns each system. When a number appears both here and in a detailed doc, the **detailed doc is canonical**; this page is the map.

- Vision & pillars → [GAME_VISION](./GAME_VISION.md)
- Reference research → [HORDES_IO_ANALYSIS](../research/HORDES_IO_ANALYSIS.md)

---

## 1. Product summary

| Attribute | Value |
|---|---|
| Title | **Oathbound** |
| Genre | Solo-friendly 3D browser MMORPG (action-light tab-target) |
| Platform | Modern desktop browser (Chromium + Firefox), keyboard & mouse |
| Deploy | Static build on **Vercel**; no backend/DB/account for 1.0-BETA |
| Persistence | Local (**IndexedDB**) + JSON export/import |
| Players | One local player (honest single-player; no fake MMO population) |
| Level cap | **30** |
| Classes | **Warrior, Hunter, Priest** (exactly three for the beta) |
| Target time to cap | **~12–18h** (≈14h design center) |
| Art | Low-poly, flat-shaded / vertex-colored, stylized; procedural-first |

## 2. Setting (kept deliberately light)
The region of **Aldermere**; hub town **Oathhold**. The Warden's Oath that protected the land has broken; the **Blight** spreads from the ruined citadel at **Gravereach**. The player is a new **Oathbound**. Lore is delivered through environment, signposts, and a handful of optional encounters — never long dialogue trees. Full world in [WORLD_AND_ZONES](./WORLD_AND_ZONES.md).

## 3. Design pillars
The six pillars from [GAME_VISION](./GAME_VISION.md) govern everything:
1. Solo-First, Not Solo-Possible · 2. Grinding Is the Main Progression · 3. Minimal Quest Dependence · 4. Compact but Meaningful Open World · 5. Equipment Is a Major Motivation · 6. Accessible Browser Gameplay.

## 4. Core gameplay loop
Explore → find a monster area → fight → XP → loot → compare/equip → unlock/improve abilities → push to a harder area → hunt stronger monsters & rarer drops → repeat with more meaningful decisions. Detailed loop, session shapes, and reward cadence → [CORE_GAMEPLAY_LOOP](./CORE_GAMEPLAY_LOOP.md).

## 5. Controls & combat (at a glance)
- **Movement:** WASD direct movement; mouse controls a third-person chase camera; scroll to zoom; hold right-mouse to mouselook/steer.
- **Targeting:** **Soft tab-target hybrid** — `Tab`/click to lock; otherwise abilities auto-acquire the nearest valid target in the camera-forward cone.
- **Abilities:** hotbar slots `1–6` + `Q/E/R`; a **1.0s global cooldown (GCD)**; movement/defensive tools are off-GCD.
- Full model (camera, GCD, damage formula, aggro, leashing, death) → [COMBAT_DESIGN](./COMBAT_DESIGN.md).

## 6. Classes (at a glance)
| Class | Resource | Range | Identity | Solo answer to packs | Detail |
|---|---|---|---|---|---|
| **Warrior** | Fury (builds in combat) | Melee | Durable bruiser, cleave, self-sustain | Cleave + AoE taunt-cleave | [CLASS_DESIGN#warrior](./CLASS_DESIGN.md#warrior) |
| **Hunter** | Focus (regenerates) | Ranged physical | Kiting, traps, mobility, burst | Volley + traps + dash | [CLASS_DESIGN#hunter](./CLASS_DESIGN.md#hunter) |
| **Priest** | Mana | Ranged holy | Holy damage + heal/shield self-sustain | Consecrate-style AoE + shield | [CLASS_DESIGN#priest](./CLASS_DESIGN.md#priest) |

No permanent pet for the beta (analysis in [CLASS_DESIGN](./CLASS_DESIGN.md#hunter-and-the-pet-question)). Each class levels 1→30 alone, full stop.

## 7. Progression & XP (at a glance)
- Level cap **30**; smooth XP curve (no sudden walls); ~1,950 same-level-equivalent kills to cap with the rest of the 12–18h coming from exploration, elites, rares, and gear management.
- Level-difference **con system** (gray→green→white→orange→red) scales XP and difficulty and provides anti-farm rules.
- Canonical curve, per-bracket pacing, ability/milestone unlock cadence → [PROGRESSION_AND_XP](./PROGRESSION_AND_XP.md).

## 8. Items & equipment (at a glance)
- 12 equipment slots; rarities **Common → Uncommon → Rare → Epic → Legendary → Relic(unique)**.
- Primary stats **STR / DEX / SPR / VIT**; secondary **affixes** (crit, haste, CDR, armor, resist, leech, move speed, +max resource, +healing).
- Item power model, affix pools, drop tables, gold sinks, optional upgrade system → [ITEMS_AND_EQUIPMENT](./ITEMS_AND_EQUIPMENT.md).

## 9. Enemies (at a glance)
Families introduced gradually across zones; tiers **Standard / Elite / Rare-named / World-boss**. Data-driven configs (stats, abilities, drops, spawn rules). Full framework → [ENEMY_DESIGN](./ENEMY_DESIGN.md).

## 10. World & zones (at a glance)
Hub **Oathhold** + **6 leveling regions** (Lv 1–5, 6–10, 11–15, 16–20, 21–25, 26–30) connected by short transition areas, with hidden rare camps and 3 endgame world bosses. Streaming via **scene-segmented connected chunks**. Full atlas → [WORLD_AND_ZONES](./WORLD_AND_ZONES.md).

## 11. Solo balance (at a glance)
Explicit, measurable targets: normal same-level TTK 3–6s; elite 20–45s; world boss 2–5 min solo; ≥70% HP after a normal fight; ≤8s out-of-combat recovery; survive 3-mob pulls; gentle death penalty. Full rules → [SOLO_BALANCE_RULES](./SOLO_BALANCE_RULES.md).

## 12. Endgame foundation (at a glance)
Level-30 chase via rare open-world enemies, elite camps, named monsters, hard solo encounters, target farming, high-rarity drops, and optional gear upgrading. This is the *temporary local-beta endgame*, not raids. Detail → [ENDGAME_FOUNDATION](./ENDGAME_FOUNDATION.md).

## 13. Quests & guidance
Minimal: a short onboarding sequence, optional class tutorials, zone-discovery guidance, feature-unlock objectives, a few handcrafted events, optional milestone challenges. Quests are **never** the primary XP source. Detail folded into [CORE_GAMEPLAY_LOOP](./CORE_GAMEPLAY_LOOP.md#guidance--quests) and [UX_AND_ACCESSIBILITY](./UX_AND_ACCESSIBILITY.md).

## 14. UX & accessibility (at a glance)
Remappable controls, UI scaling, colorblind-safe rarity (shape+label, not color alone), reduced-flash/shake, damage-number controls, clear cooldown/resource/target readouts, and **pause** (it's a local game). Detail → [UX_AND_ACCESSIBILITY](./UX_AND_ACCESSIBILITY.md).

## 15. Technical direction (at a glance)
TypeScript + Vite + **raw Three.js**; DOM/HTML UI overlay; lightweight **ECS-lite** with a fixed-timestep simulation decoupled from rendering; **IndexedDB** saves with schema versioning; data-driven content; **Vitest + Playwright** tests; **Vercel** static deploy. Rationale and alternatives → [TECH_STACK_EVALUATION](../technical/TECH_STACK_EVALUATION.md), [ARCHITECTURE_PLAN](../technical/ARCHITECTURE_PLAN.md), and the [Decision Records](../decisions/DECISION_RECORDS.md).

## 16. Explicitly out of scope for 1.0-BETA
Dungeons, raids, accounts, auth, servers, networking, guilds, PvP, factions, trading, auction house, global chat, mail, housing, mounts/breeding, large crafting, extra races/classes, story campaigns, cinematics, monetization, mobile-first controls, infinite procedural worlds. See [DEFERRED_FEATURES](../production/DEFERRED_FEATURES.md) and [POST_BETA_MMO_HORIZON](../production/POST_BETA_MMO_HORIZON.md).

## 17. Definition of done
The objective 1.0-BETA bar lives in [BETA_ACCEPTANCE_CRITERIA](../qa/BETA_ACCEPTANCE_CRITERIA.md); the phased path to it lives in [VERSION_ROADMAP](../production/VERSION_ROADMAP.md), gated by [RELEASE_GATES](../production/RELEASE_GATES.md).

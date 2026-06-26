# Hordes.io — Benchmark Analysis

**Purpose:** Hordes.io is the primary design reference for Oathbound — a proof that a small team (in its case, effectively one person) can ship a real-feeling 3D MMORPG in the browser. We study it to *learn its strengths and avoid its weaknesses*, **not to clone it**.

> **Originality guardrail.** We do **not** copy Hordes.io's names, classes (beyond common fantasy archetypes), world, map layouts, monsters, lore, ability names, item names, UI, icons, visual identity, source code, models, textures, audio, or balancing values. See [THIRD_PARTY_ASSET_POLICY](../assets/THIRD_PARTY_ASSET_POLICY.md). All facts below cite [SOURCE_LOG](./SOURCE_LOG.md).

## 1. What Hordes.io is (confirmed)

- A free, no-download **3D browser MMORPG** with a low-poly, stylized look. `[CONFIRMED S1,S3]`
- **Group-oriented** open-world **PvP and PvM**. `[CONFIRMED S1,S2]`
- Classes: **Warrior, Mage, Archer/Ranger, Shaman**; two **factions (Bloodlust / Vanguard)** drive open-world PvP. `[CONFIRMED S1]`
- Core PvE loop: **grind monsters → level up → fight rare bosses and world bosses → chase exceptionally rare loot**. `[CONFIRMED S1,S2]`
- Built and maintained by a **solo developer ("Dek") since ~2016**, starting on **Three.js** before moving to a heavily modified low-level WebGL library for performance; networking moved from Socket.io/JSON to custom serialization over uWebSockets with server-side validation. `[INFERRED S5,S6]`

## 2. Features worth learning from

| Feature | Why it works | How Oathbound adapts it |
|---|---|---|
| **Immediately understandable loop** | Pick class → fight nearby monsters → loot → level. No manual required. | Keep this. Onboarding ≤ 2 minutes to first kill. See [CORE_GAMEPLAY_LOOP](../design/CORE_GAMEPLAY_LOOP.md). |
| **Tab-target combat with a hotbar** | Cheap to render, readable, networkable, low asset cost. | Adopt a **soft tab-target hybrid** (lock target or auto-acquire). See [COMBAT_DESIGN](../design/COMBAT_DESIGN.md) and [ADR-003](../decisions/DECISION_RECORDS.md#adr-003-combat-targeting-model). |
| **Low-poly stylized art** | Tiny asset footprint, fast loads, ages well, achievable solo. | Adopt a flat-shaded / vertex-colored low-poly direction. See [ART_DIRECTION_PLAN](../assets/ART_DIRECTION_PLAN.md). |
| **Item rarity + world/boss loot chase** | Long-term retention from gear, not just levels. | Make equipment a top-3 retention pillar. See [ITEMS_AND_EQUIPMENT](../design/ITEMS_AND_EQUIPMENT.md). |
| **Rare spawns & world bosses** | Cheap, high-excitement content reusing existing systems. | Named rares per zone + 3 solo-tunable world bosses for the beta endgame. See [ENDGAME_FOUNDATION](../design/ENDGAME_FOUNDATION.md). |
| **Open world with leveling zones of rising danger** | Natural progression and exploration without quest chains. | 6 connected leveling regions + hub. See [WORLD_AND_ZONES](../design/WORLD_AND_ZONES.md). |
| **Started small, expanded over years** | Vertical-slice-first scope discipline. | Our roadmap makes *one* class + *one* enemy family feel good before breadth. See [VERSION_ROADMAP](../production/VERSION_ROADMAP.md). |

## 3. Features that should be redesigned (the core thesis of Oathbound)

| Hordes.io trait | Problem for our goal | Oathbound redesign |
|---|---|---|
| **Group-dependent progression** | Punishes solo players; healers/tanks feel bad alone. | **Solo-first**: every class levels 1→30 and farms gear alone. See [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md). |
| **Healer/Support class is group-oriented** | A pure healer is miserable solo. | The **Priest** has real offensive output (holy damage + an "atonement"-style heal-through-damage). See [CLASS_DESIGN](../design/CLASS_DESIGN.md#priest). |
| **Tank archetype is low-damage** | A tank-only Warrior can't solo-grind efficiently. | The **Warrior** is durable *and* deals strong close-range/cleave damage with self-sustain. |
| **Grind can become "bigger HP bars"** | Repetition without new decisions. | Grind escalates via **enemy mechanics, builds, zones, and gear**, not just stat inflation. See [ENEMY_DESIGN](../design/ENEMY_DESIGN.md). |
| **Faction PvP as a central system** | Out of scope and irrelevant to a local single-player beta. | **No PvP/factions** before the post-beta MMO horizon. |

## 4. Features that should NOT be copied

- **Names, classes-as-named, world, monsters, lore, ability/item names, UI, icons, visual identity** — originality requirement and IP safety.
- **Balancing values** — derive our own from the model in [PROGRESSION_AND_XP](../design/PROGRESSION_AND_XP.md) and [SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md).
- **Any source code, models, textures, or audio.**
- **The custom low-level WebGL engine path** — premature for us (see Technical Lessons).

## 5. Features that do not fit the current local single-player release

These are real Hordes.io systems that are **out of scope for 1.0-BETA** and live in the [POST_BETA_MMO_HORIZON](../production/POST_BETA_MMO_HORIZON.md):

- Real-time multiplayer & authoritative server · Factions & open-world PvP · Parties/grouping · Guilds/clans · Global chat · Trading/auction house · Instanced group dungeons & raids · Accounts/persistence on a server.

We **do not fake** any of these with bots or simulated populations (explicitly forbidden by the project brief).

## 6. Technical lessons relevant to a modern Three.js project

1. **Start on Three.js. Don't pre-optimize into a custom engine.** Hordes.io itself began on Three.js; the custom WebGL rewrite came *years later, after the game existed and needed extreme scale*. `[INFERRED S5]` We are a local single-player beta — Three.js is more than sufficient. See [ADR-001](../decisions/DECISION_RECORDS.md#adr-001-raw-threejs-vs-react-three-fiber).
2. **Draw calls are the silent killer.** Budget aggressively; use `InstancedMesh` for crowds of identical monsters/props (many → one draw call), shared materials, and texture atlases. `[CONFIRMED S13,S14,S16]` See [RENDERING_AND_PERFORMANCE](../technical/RENDERING_AND_PERFORMANCE.md).
3. **Object pooling and LOD matter from day one.** Pool projectiles, hit numbers, particles, and enemies; throttle/disable AI for distant entities. `[CONFIRMED S13,S15,S17]`
4. **Design networking boundaries early, but don't build them.** Hordes.io's server validates client movement plausibility. `[INFERRED S5]` We keep combat/progression logic **out of rendering code** so a future server could own it — without implementing any networking now. See [FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md).
5. **Build dev tools.** Hordes.io's author built a custom map editor. `[INFERRED S5]` We plan (not build now) spawn/level/teleport/loot-sim dev tools. See [TEST_STRATEGY](../qa/TEST_STRATEGY.md).
6. **Serialization is a future concern, not a beta one.** Local saves use IndexedDB + JSON; a binary wire format is a post-beta problem.

## 7. One-paragraph takeaway

Hordes.io proves the *format* — a readable, low-poly, tab-target browser MMORPG with a satisfying grind-and-loot loop — is achievable by a tiny team. Its central weakness for our audience is **group dependency**. Oathbound's entire reason to exist is to keep the approachable open-world grind while making it **genuinely, comfortably solo**, shipped first as an honest local single-player game.

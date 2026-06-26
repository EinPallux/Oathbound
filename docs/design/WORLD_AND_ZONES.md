# World & Zones — Aldermere

Canonical owner of: world structure, the zone atlas (Lv ranges, themes, families, landmarks, loot identity), travel, and the streaming approach. Goal: a **compact, interconnected, content-dense** world — never huge and empty (Pillar 4). All content is **original** to Oathbound.

## World shape
A single contiguous region, **Aldermere**, built from **scene-segmented connected chunks** (not one giant map; not isolated lobbies). The hub sits central; leveling regions fan outward in a rough ring of rising danger, each connected by short **transition areas** with short load fades.

```
                 [Riven Peaks 21–25]
                        |  (Frostgate)
[Emberreach 16–20]—(Ashen Stair)—[OATHHOLD hub]—(Old Kingsroad)—[Greenmarch 1–5]
        |                              |                               |
   (Cinder Pass)             (Mistgate Pass)                    (Millford Path)
        |                              |                               |
[Sunken Fen 11–15]——————————[Thornwood Vale 6–10]———————————————————————+
                                       |
                              (The Wound)  ↓
                              [Gravereach 26–30] — final region, world bosses
```
*(Exact adjacency is a layout starting point; the implementation may refine connectivity while preserving the level-gradient and the central hub.)*

## Streaming & segmentation (decision)
**Chosen: connected zone chunks with short-transition loading at borders**, plus in-zone LOD/instancing. See [ADR-004](../decisions/DECISION_RECORDS.md#adr-004-world-segmentation--streaming) and budgets in [RENDERING_AND_PERFORMANCE](../technical/RENDERING_AND_PERFORMANCE.md).
- Each zone is its own scene graph; crossing a border triggers a ≤2s fade load of the neighbor and unload of the far one (keep current + adjacent warm where memory allows).
- Within a zone: terrain chunking, frustum culling, instanced props/enemies, prop-density budgets, LOD.
- Rationale: best balance of immersion vs browser memory vs indie feasibility; avoids the cost and bugs of seamless mega-streaming while still feeling continuous.

## Travel
- **Oathstones** (waypoints): activate by visiting; fast-travel between known Oathstones for a small gold toll. ~2–3 per zone + hub.
- Early game is walked (to teach the world); fast travel unlocks as Oathstones are discovered, reducing backtracking tedium for return sessions.
- Move-speed gear and out-of-combat sprint smooth traversal.

## Per-zone documentation schema
Each zone below specifies: Level range · Theme/Mood · Landmarks · Families ([ENEMY_DESIGN](./ENEMY_DESIGN.md)) · Grinding areas · Difficulty progression · Rare/elite encounters · Loot identity · Hazards · Safe area · Travel · Exploration rewards · Asset notes (procedural-first) · Performance notes.

---

### 0. Oathhold — Hub (safe)
- **Theme/Mood:** a fortified frontier town on the old Warden road; warm, safe, lived-in. The only fully safe zone.
- **Landmarks:** the broken Oath Monument (central), vendor row, the Stash, the first Oathstone, the four road-gates to the regions.
- **Function:** class trainer/respec, vendors (gear, consumables), salvage & Reinforcement station, stash, Goal Tracker board, onboarding.
- **Assets:** modular low-poly buildings (instanced), warm lighting; no combat → cheapest scene.

---

### 1. The Greenmarch — Lv 1–5
- **Theme/Mood:** rolling meadows and farmland just past Oathhold's walls; bright, gentle, inviting — the tutorial biome.
- **Landmarks:** Millford (ruined farm), the Old Kingsroad, a wisp-lit pond.
- **Families:** **Bloomhusks** (melee bruisers), **Reavers** (ranged bandits), **Wisps** (fast swarm).
- **Grinding areas:** west fields (Bloomhusks), bandit camp (Reavers, first elite at ~Lv 5).
- **Difficulty progression:** single melee → small packs → a ranged enemy → first elite (bandit captain).
- **Rare/elite:** *Old Tusker* (rare Bloomhusk), Bandit Captain (elite camp anchor).
- **Loot identity:** starter gear; teaches rarity colors & comparison.
- **Hazards:** none harsh (maybe a shallow water slow).
- **Safe area:** Millford waystation (Oathstone).
- **Exploration rewards:** a hidden chest behind the pond; first salvage tutorial pickup.
- **Assets/Perf:** procedural rolling terrain + instanced grass/trees; tiny draw-call footprint; the performance baseline scene.

### 2. Thornwood Vale — Lv 6–10
- **Theme/Mood:** dense, dim forest; canopy light shafts; first real "wild" danger.
- **Landmarks:** the Great Bramble, a collapsed ranger lodge, spider hollows.
- **Families:** **Weavers** (spiders — fast/poison), **Bramblekin** (defensive thorn-constructs), **Sporelings** (caster fungal — spore clouds).
- **Grinding areas:** hollows (Weavers), bramble thickets (Bramblekin), a spore grove (Sporelings).
- **Difficulty progression:** introduces **roots/poison DoT** and a **defensive** enemy (armor-break matters); first **caster** telegraphs.
- **Rare/elite:** *Broodmother* (rare Weaver), Bramble Warden (elite).
- **Loot identity:** poison-resist & DoT-leaning affixes begin; first build-defining drops.
- **Hazards:** spore clouds (blight DoT zones), thorn walls (terrain).
- **Safe area:** the ranger lodge (Oathstone).
- **Exploration rewards:** a canopy shortcut to a hidden rare nest.
- **Assets/Perf:** instanced trees with LOD; light shafts via cheap fog/god-ray fake; watch overdraw from foliage.

### 3. The Sunken Fen — Lv 11–15
- **Theme/Mood:** waterlogged bog under perpetual mist; oppressive, eerie; the Blight's first strong presence.
- **Landmarks:** the Drowned Henge, a sunken crypt entrance (small cave subarea), gas vents.
- **Families:** **Drudge** (bog-drowned bruisers), **Fenstalkers** (amphibious ambushers), **Mirelings** (gas-imp casters).
- **Grinding areas:** henge shallows, crypt approach (first **elite camp**), vent fields.
- **Difficulty progression:** **ambush** mechanics, **blight damage** (resist matters), the first proper **elite camp** designed for cooldown use.
- **Rare/elite:** *Henge-Keeper* (rare), Crypt Drudge (elite).
- **Loot identity:** blight-resist, leech, and first **Epic** drops from the elite camp.
- **Hazards:** gas vents (telegraphed blight bursts), deep water (forced wade/slow).
- **Safe area:** a dry hummock camp (Oathstone).
- **Exploration rewards:** the Sunken Crypt mini-dungeon-*area* (open, not instanced) with a guaranteed rare.
- **Assets/Perf:** flat bog terrain (cheap), mist (fog), reflective water kept simple (no expensive planar reflections — use a stylized shader).

### 4. The Emberreach — Lv 16–20
- **Theme/Mood:** scorched volcanic highlands; ash skies, lava cracks; dramatic and hot.
- **Landmarks:** the Cinder Spire, a fire-cult warcamp, cooling-lava flats.
- **Families:** **Cinderborn** (fire elementals — casters), **Ashen Reavers** (fire cult — mixed), **Magmaw** (heavy beasts).
- **Grinding areas:** ash flats, the warcamp (large elite camp), spire approach.
- **Difficulty progression:** heavy **telegraphed fire AoE**, **resist-checks** (Fire), tankier elites; rewards the Lv 18 ground-AoE tools.
- **Rare/elite:** *Emberhorn* (rare Magmaw, a roaming mini-boss), Cult Pyremaster (elite caster).
- **Loot identity:** fire-resist, crit, and strong weapon drops; the gear "power spike" zone.
- **Hazards:** lava (instant heavy damage — clear visual), ember storms (periodic AoE).
- **Safe area:** a windbreak outpost (Oathstone).
- **Exploration rewards:** a lava-tube shortcut hiding a Legendary-tier early chance.
- **Assets/Perf:** emissive materials for lava (unlit glow, cheap), particle ash (pooled, capped), limited dynamic light (use emissive fakes not many point lights).

### 5. The Riven Peaks — Lv 21–25
- **Theme/Mood:** jagged frozen mountains, howling wind, thin air; harsh and majestic.
- **Landmarks:** the Frostgate, a frozen battlefield, a wyrm-scarred ridge.
- **Families:** **Rimebound** (ice constructs — defensive), **Frostfang** (frost beasts — fast packs), **Revenants** (frozen undead — casters, **holy-weak**).
- **Grinding areas:** the battlefield (Revenants + elites), ridge packs (Frostfang), construct vaults (Rimebound).
- **Difficulty progression:** **frost slows** (mobility tax), defensive constructs (sustained DPS/armor-break), undead introduce the **holy-weakness** lever; **elite camps** with support enemies (kill-priority).
- **Rare/elite:** *The Rimewyrm* (world-boss-class, see [ENDGAME_FOUNDATION](./ENDGAME_FOUNDATION.md)), Frost Revenant Lord (elite).
- **Loot identity:** frost-resist, CDR, and Epic/Legendary tail; pre-endgame gear.
- **Hazards:** ice patches (slip/slow), blizzard zones (vision + frost DoT).
- **Safe area:** Frostgate keep (Oathstone).
- **Exploration rewards:** a hidden vault with a guaranteed Epic + lore on the fallen Wardens.
- **Assets/Perf:** white terrain with vertex-color variation, particle snow (capped), blizzard via fog density toggles.

### 6. Gravereach (The Hollow Crown) — Lv 26–30 + endgame
- **Theme/Mood:** the corrupted ruins of the Warden citadel, epicenter of the Blight; foreboding, climactic — the journey's end and the endgame's home.
- **Landmarks:** the Hollow Crown (ruined citadel), the Oathbreaker's Court, the Blight Wound.
- **Families:** **Wraiths** (blight casters), **Bonewrought** (bone constructs — defensive/pack), **The Forsworn** (oath-broken knight elites — the signature threat).
- **Grinding areas:** outer ruins (26–28), inner court (28–30), boss approaches.
- **Difficulty progression:** the **densest mechanics** — blight casters + Forsworn elites demanding interrupts, positioning, and resist gear; the capstone test of a build.
- **Rare/elite:** **Maelgrith the Forsworn** (final world boss), plus named Forsworn knights (rares).
- **Loot identity:** the **best beta gear** — Legendary/Relic tail concentrated here; ilvl 30–36 chase items.
- **Hazards:** blight pools (heavy DoT), collapsing ruins (telegraphed), corruption auras (periodic resist checks).
- **Safe area:** a reclaimed gatehouse (Oathstone).
- **Exploration rewards:** Relic-bearing hidden rares; the lore conclusion of the Oath.
- **Assets/Perf:** dark palette with emissive blight accents; reuse Riven/Fen geometry kits recolored; careful particle/light budget for the climactic feel without blowing the [PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md).

---

## Future dungeon/raid entrances (placed, not built)
Gravereach and the Sunken Crypt include **sealed doorways/portals** intended as **future instanced-dungeon entrances**. For the beta they are **locked set-dressing with a "The Oath is not yet ready" tooltip** — no instance behind them. This signposts the post-beta horizon without faking content. See [DEFERRED_FEATURES](../production/DEFERRED_FEATURES.md) and [POST_BETA_MMO_HORIZON](../production/POST_BETA_MMO_HORIZON.md).

## World content sizing (anti-empty checklist)
- Every zone has ≥3 distinct grinding pockets, ≥1 elite camp, ≥1 named rare, ≥1 hazard, ≥1 exploration reward, and a unique loot identity.
- No traversable area should be >~30s of walking without a point of interest, enemy camp, or reward.
- Build zones **one bracket at a time** to a high bar rather than ten empty zones (Pillar 4 / [Roadmap philosophy](../production/VERSION_ROADMAP.md)).

## Originality note
All names (Aldermere, Oathhold, Greenmarch, Thornwood Vale, Sunken Fen, Emberreach, Riven Peaks, Gravereach, the Forsworn, etc.), monsters, and lore are original. No Hordes.io map, zone, or monster is referenced or reused. See [THIRD_PARTY_ASSET_POLICY](../assets/THIRD_PARTY_ASSET_POLICY.md).

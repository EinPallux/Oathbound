# Importing a Map Builder map into Oathbound

How to take a map you designed in the **Oathbound Map Builder** (the `Oathbound-AdminTools`
web tool) and load it into the game.

## TL;DR

1. In the Map Builder, click **Export JSON** → you get a file like `my-world.oathbound-map.json`.
2. Drop that file into this repo at **`public/maps/`**.
3. Open the game with **`?map=my-world`** in the URL.

That's it. With no `?map=`, the game boots the normal procedural world — your map only loads when you ask for it.

---

## Step by step

### 1. Export from the Map Builder

In the builder's top bar, click **Export JSON**. It downloads:

```
<name>.oathbound-map.json
```

…where `<name>` is your map's name lowercased with spaces turned into dashes
(e.g. a map named “Sample Vale” exports as `sample-vale.oathbound-map.json`).

> **Save vs Export:** *Save* keeps the map in your browser's local storage (and the builder
> autosaves your last session). *Export JSON* is the file you bring into the game.

### 2. Put the file in `public/maps/`

Copy the downloaded file into this folder:

```
Oathbound/
└─ public/
   └─ maps/
      ├─ sample.oathbound-map.json        ← the bundled demo
      └─ my-world.oathbound-map.json      ← your map goes here
```

You can keep as many maps here as you like.

### 3. Load it with `?map=`

The `?map=` value is the **filename without the `.oathbound-map.json` part**.

| File in `public/maps/` | URL to load it |
|---|---|
| `my-world.oathbound-map.json` | `…/?map=my-world` |
| `sample.oathbound-map.json` | `…/?map=sample` |

- **Local dev:** run `npm run dev`, then open `http://localhost:5173/?map=my-world`.
  (Vite serves `public/` live — just add the file and refresh, no restart needed.)
- **Deployed (Vercel):** `https://your-game.vercel.app/?map=my-world` — but the file must be
  **committed to the repo** first (see *Shipping a map* below), because `public/` is bundled at build time.

Try the included demo right now: **`?map=sample`**.

---

## What loads from a map

Everything you placed in the builder comes through:

- **Terrain** (sculpted heightfield) + **biome painting** (ground colour + which vegetation the game auto-scatters)
- **Water** (lakes, rivers) and **roads**
- **Assets** — built-in props, the pre-made presets (buildings, walls, towers, town-style props, ruins, trees, rocks…) and your **custom assets** (Asset Builder). Buildings/walls with a footprint are **solid**. Build your settlements from these.
- **Gameplay markers** — enemy spawns, world bosses, Oathstone travel points and the player spawn.
- **Friendly NPCs** — they walk their patrol routes (or idle), and can carry **dialog + quests** (see below).
- **Quests & dialog** — talk to an NPC to read its lines; accept quests at their giver NPC and turn them in at the destination NPC for a reward (gold + XP, and optionally an item — a rolled piece of gear or a named relic). Progress (kills / talk) is tracked on-screen and saved with your character. Quests can require earlier quests to form **questlines**, and NPCs float `!` / `?` quest markers. See **[QuestSetup.md](./QuestSetup.md)** for the full authoring workflow.

### Good-to-know behaviour

- **Player spawn:** fresh characters start where you placed the Player Spawn marker.
- **Vendor:** the Quartermaster is placed next to your player spawn so the sell/buy loop always works — build your own town/market around it with preset props.
- **Oathstones:** if you didn't place any, a `Home` stone is auto-added at the spawn so respawn + fast-travel work.
- **NPC interaction:** **left-click** an NPC, or stand near it and press **F**, to open its dialog. Quest progress and accepted/completed quests persist in your save.

---

## Shipping a map with the game

To make a map available on your deployed (Vercel) build, commit it:

```bash
git add public/maps/my-world.oathbound-map.json
git commit -m "Add my-world map"
git push
```

Vercel rebuilds and the map is then reachable at `https://your-game.vercel.app/?map=my-world`.

---

## Switching / editing maps

- **Multiple maps:** keep several files in `public/maps/` and switch with `?map=<name>`.
- **Edit later:** in the Map Builder use **Import** and pick your `.oathbound-map.json` to load it back in, tweak, and **Export** again.

---

## Troubleshooting

- **It booted the normal (procedural) world instead of my map.** Open the browser console — if the map couldn't be found you'll see
  `Oathbound: map "<name>" not found (404)…`. The loader **falls back to the default world** rather than erroring. Check that:
  - the file is at `public/maps/<name>.oathbound-map.json`, and
  - your URL uses the matching `?map=<name>` (no `.oathbound-map.json` suffix in the URL).
- **Changes don't show up.** Hard-refresh (Ctrl/Cmd-Shift-R). On Vercel, make sure you committed + redeployed.
- **Advanced paths:** if `?map=` contains a `/` or `.`, it's treated as an explicit path/URL — e.g. `?map=/maps/foo.oathbound-map.json` or even a full external URL.

---

## Under the hood (for reference)

- Entry point `src/main.ts` reads `?map=`, fetches `public/maps/<name>.oathbound-map.json`, and sets it as the active map **before** the world boots.
- `src/game/bootstrap.ts` branches on it: a custom map builds the world from your JSON; otherwise the procedural generators run unchanged.
- The format is defined in `src/world/map-format.ts` (a byte-for-byte mirror of the builder's `src/format/map.ts`), so exports and the loader always agree.
- A small note on map files also lives in [`public/maps/README.md`](./public/maps/README.md).

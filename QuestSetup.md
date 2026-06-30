# Quest Setup — authoring quests & questlines for Oathbound

How to build dialog, quests, and questlines in the **Map Builder's Quests & Dialog editor**
and get them running in the game. Quests live **inside the map file** — there is no separate
quest file to import. If you can already load a custom map (see [ImportInfo.md](./ImportInfo.md)),
your quests come with it for free.

---

## The workflow in one minute

1. In the **Map Builder**, place your NPCs with the **NPCs** tool (give each a name + patrol/idle).
2. Open **Quests & Dialog** (top bar). On the **left**, pick an NPC and give it a *title* and
   *dialog lines*. On the **right**, add quests and wire them to your NPCs.
3. **Export JSON** → you get `<name>.oathbound-map.json` (NPCs, dialog **and** quests are all inside it).
4. Drop the file into the game at **`public/maps/<name>.oathbound-map.json`**.
5. Run the game with **`?map=<name>`** (e.g. `http://localhost:5173/?map=my-world`).

That's it — the game reads `quests` straight out of the map. Re-export and refresh to iterate.

---

## What a quest is

Each quest is authored on a card in the editor:

- **Name / Description** — shown to the player.
- **Giver (accept)** — the NPC where the quest is picked up.
- **Turn-in (complete)** — the NPC where it's handed in (can be the same NPC).
- **Requires (prerequisite quests)** — tick other quests that must be **turned in first**. This is
  how you build **questlines** (see below). Leave empty for a quest that's available from the start.
- **Objective** — one of:
  - **Kill enemies** — slay *N* of a chosen enemy type (any spawn of that type, anywhere, counts).
  - **Talk to an NPC** — visit a target NPC (advances the moment you open their dialog).
- **Reward** — **gold + XP**, plus an optional **item**:
  - **Gear** — rolled on turn-in from a spec (*slot + rarity + item level + optional primary stat*),
    exactly like normal loot. A fresh roll each time.
  - **Relic** — one of the named end-game uniques, handed over whole. Very powerful — use sparingly.
- **Offer / In-progress / Complete text** — optional flavour lines for each stage (sensible defaults
  are used if you leave them blank).

## How it plays in-game

- **Talk:** left-click an NPC, or stand near them and press **F**, to open their dialog.
- **Accept:** a giver with an available quest shows an **Accept** button in their dialog.
- **Track:** active quests appear in the on-screen tracker with kill progress (`2/3`) or a "Talk to …" hint.
- **Turn in:** return to the turn-in NPC once the objective is met and press **Turn in** — you get the
  gold, XP, and any item. The rolled gear's real name shows in the toast; a full bag is reported
  rather than losing the drop.
- **Persistence:** active progress and completed quests are **saved with your character** and survive reloads.

## NPC quest markers

Markers float over NPCs so players know where to go (standard MMO convention):

- **gold `!`** — this NPC has a quest you can **accept** right now.
- **gold `?`** — this NPC has a quest **ready to turn in** (objective complete).
- **dim `?`** — a quest you're on turns in here, but it isn't finished yet.

Markers update live as you accept, progress, and complete quests.

## Questlines (follow-up quests)

Use **Requires** to chain quests. Example — a 2-step line:

1. *A Word with the Elder* — no prerequisites, so it's offered from the start.
2. *The Elder's Errand* — **Requires: A Word with the Elder**. Its giver shows **no** `!` until step 1
   is turned in; the moment it is, the follow-up unlocks (and the giver lights up with `!`).

A quest can require **several** prerequisites (all must be done — AND logic), so you can build straight
chains *and* convergent lines (e.g. a finale that needs three earlier quests). Cycles never unlock
(A requires B, B requires A) — don't do that. Try the bundled demo: **`?map=sample`** ships a working
two-step questline plus kill/talk quests and item rewards.

---

## What the quest system supports today

Everything above is fully wired end-to-end (editor → export → game), so you can start building now:

- NPC dialog (title + lines), clickable / F-to-interact.
- Kill and talk objectives, with on-screen progress.
- Rewards: gold + XP + an optional item (rolled gear **or** a named relic).
- Questlines via prerequisites, with live `!` / `?` markers.
- Save/load persistence.

**Current v1 limits** (good to know when planning a questline):

- **One objective per quest.** No multi-step ("do X then Y") or "collect N items" / "reach a location"
  objectives yet — model multi-step stories as a *chain of single-objective quests* with `requires`.
- **Objective types are kill / talk only.** Kill credit is by enemy *type*, not a specific spawn.
- **No branching/choice dialog**, timers, or escort objectives.
- **One item per reward** (plus gold + XP).

These are clean extension points — if you hit a wall building your questline, note what you need and it
can be added to the format + editor + loader together.

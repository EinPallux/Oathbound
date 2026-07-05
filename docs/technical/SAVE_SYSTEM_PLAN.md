# Save System Plan

> **⚠️ Partially superseded by the MMO track (ADR-013).** The browser/offline save (this doc's subject) still stands. But "no remote database before the post-beta horizon" no longer holds: online play uses a **server-side SQLite** store as the durable authority (`server/db.ts`), through the same `serialize()`/`applySave()` boundary (`src/sim/save.ts`) as the offline path. See [VPS_HOSTING_GUIDE](./VPS_HOSTING_GUIDE.md) and [MMO_ARCHITECTURE](./MMO_ARCHITECTURE.md).

The local beta must have **reliable persistence** with versioning, migration, and corruption recovery. Storage choice rationale: [ADR-005](../decisions/DECISION_RECORDS.md#adr-005-save-storage). No remote database before the [post-beta horizon](../production/POST_BETA_MMO_HORIZON.md).

## Storage
- **IndexedDB** (via the `idb` wrapper) holds character saves, inventory, world flags, and discovered-Oathstone/rare data.
- **localStorage** holds only small, non-critical **settings** (graphics/accessibility/keybinds) for synchronous startup reads.
- **JSON export/import** lets players back up or move a save as a file.

## What is saved
| Domain | Examples |
|---|---|
| Character | class, level, XP, stats, chosen build-nodes, resource |
| Inventory & equipment | items (id, ilvl, rarity, rolled affixes, locked, reinforcement), gold, materials |
| Progression | unlocked abilities, milestone flags, tutorial completion |
| World state | discovered zones/Oathstones, seen rares, world-event flags, current zone & position |
| Meta | save schema version, created/updated timestamps, playtime, checksum |
| Settings (localStorage) | keybinds, graphics, accessibility, audio |

## Save schema versioning & migration
- Every save embeds `schemaVersion`. On load, run **ordered migrations** `vN → vN+1 → …` up to current.
- Migrations are **pure functions** with unit tests (a real save from each historical version is kept as a [test fixture](../qa/TEST_STRATEGY.md#save--migration-tests)).
- **Content-change safety:** items/abilities reference content by **stable id**. If an item/ability definition changed or was removed, the loader **reconciles gracefully**:
  - missing item def → keep raw item data, show a safe placeholder, never crash;
  - changed ability def → remap by id, drop invalid build-node picks with a free respec;
  - removed content → quarantine into a "legacy" bucket rather than deleting silently.

## Saving behavior
- **Autosave** on key events (level-up, zone change, item equip/major loot, settings change) and on a periodic timer (e.g., every 60s) and on `beforeunload`/visibility-hidden (best-effort flush).
- **Manual save** available from the menu.
- Writes are **transactional**; a `updatedAt` + **checksum** is written so corruption is detectable.
- Target save duration **≤100ms** typical ([PERFORMANCE_BUDGETS](../qa/PERFORMANCE_BUDGETS.md)).

## Backup & corruption recovery
- Keep the **last-known-good** save as a separate backup slot; write new → verify checksum → promote to primary, demote previous to backup (write-ahead style).
- On load: validate checksum + zod-parse the schema. If primary fails, **fall back to backup**; if both fail, offer **import from file** or a clean new character — never wipe silently.
- All destructive actions (delete character, hard reset, overwrite import) require **explicit confirmation** ([UX_AND_ACCESSIBILITY](../design/UX_AND_ACCESSIBILITY.md)).

## Multiple character slots
- **Yes, a small fixed number** (e.g., 3) so players can try all three classes without destroying progress — justified by the three-class design. Each slot is an independent save record.

## Validation
- On import and on load, the save is validated with a **zod schema** matching the current `schemaVersion` (after migration). Invalid → recovery flow, not a crash.
- This same zod-at-the-boundary discipline protects against a future server payload ([CONTENT_DATA_STRATEGY](./CONTENT_DATA_STRATEGY.md)).

## Development save tools (planned, not built now)
- **Save-state snapshots** (named dev saves), **level/XP setters**, **equipment generators**, **zone teleport**, **fresh-state at level N** fixtures for testing each bracket. Listed in [TEST_STRATEGY](../qa/TEST_STRATEGY.md) and surfaced via the dev panel.

## Browser storage limits
- Stay well within typical IndexedDB quotas; saves are small (KBs–low MBs). Handle quota-exceeded errors with a clear message and export prompt. Inform the player that **clearing browser data deletes local saves** — hence export/import.

## Future-multiplayer note
Local saves become **client cache + migration source** when accounts/servers arrive; the [FUTURE_MULTIPLAYER_BOUNDARIES](./FUTURE_MULTIPLAYER_BOUNDARIES.md) doc identifies which fields must migrate to server-authoritative storage and how solo progress is preserved. No server persistence is implemented now.

## Acceptance hooks
Save reliability is gated by the [Technical Beta Gate](../production/RELEASE_GATES.md#8-technical-beta-gate): no known save-destroying bug, migrations pass for every historical version, corruption recovery works, export/import round-trips losslessly.

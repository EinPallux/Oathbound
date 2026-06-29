// Browser persistence transport for saves (IndexedDB). Raw IndexedDB keeps the bundle
// lean for "save v1"; the `idb` wrapper + zod validation + migrations arrive with the
// Technical Beta hardening (ADR-005). Degrades to a no-op where IndexedDB is unavailable.
//
// Multi-character (0.7.x onboarding): the store holds up to MAX_SLOTS independent saves,
// keyed slot0..slotN. `loadSave/writeSave/clearSave` act on the *active* slot so the
// bootstrap stays slot-agnostic; the account/character-select screens read every slot.
// slot0 is the legacy single-save key, so an existing save simply becomes character 1.

import type { SaveData } from '../sim/save';

const DB_NAME = 'oathbound';
const STORE = 'saves';
const DB_VERSION = 1;

/** Number of character slots an account can hold. */
export const MAX_SLOTS = 3;

/** slot0 is the historical single-save key — kept first so old saves migrate in place. */
function slotKey(i: number): string {
  return `slot${i}`;
}

// Which slot the in-world session reads/writes. Defaults to 0 so, if nothing selects a
// slot (e.g. the legacy/dev path), behaviour is byte-identical to the old single save.
let activeSlot = 0;

/** Point the active read/write at a character slot (clamped to range). */
export function setActiveSlot(i: number): void {
  activeSlot = Math.max(0, Math.min(MAX_SLOTS - 1, Math.floor(i)));
}

/** The slot the in-world session is bound to. */
export function getActiveSlot(): number {
  return activeSlot;
}

function available(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Read a specific character slot, or null if empty / unavailable / unreadable. */
export async function loadSlot(i: number): Promise<SaveData | null> {
  if (!available()) return null;
  try {
    const db = await openDb();
    const data = await new Promise<SaveData | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(slotKey(i));
      req.onsuccess = () => resolve((req.result as SaveData | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return data && typeof data.schemaVersion === 'number' ? data : null;
  } catch {
    return null;
  }
}

/** Persist to a specific character slot. Resolves false on failure (never throws). */
export async function writeSlot(i: number, data: SaveData): Promise<boolean> {
  if (!available()) return false;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, slotKey(i));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Delete a specific character slot. */
export async function clearSlot(i: number): Promise<void> {
  if (!available()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(slotKey(i));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* ignore */
  }
}

/** Read the saved game for the active slot, or null if none / unavailable. */
export function loadSave(): Promise<SaveData | null> {
  return loadSlot(activeSlot);
}

/** Persist the active slot. Resolves false on failure (never throws). */
export function writeSave(data: SaveData): Promise<boolean> {
  return writeSlot(activeSlot, data);
}

/** Delete the active slot's save (used by a fresh-start / dev reset). */
export function clearSave(): Promise<void> {
  return clearSlot(activeSlot);
}

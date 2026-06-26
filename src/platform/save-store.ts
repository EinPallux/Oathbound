// Browser persistence transport for saves (IndexedDB, single slot for the slice).
// Raw IndexedDB keeps the bundle lean for "save v1"; the `idb` wrapper + zod
// validation + migrations arrive with the Technical Beta hardening (ADR-005).
// Degrades to a no-op where IndexedDB is unavailable.

import type { SaveData } from '../sim/save';

const DB_NAME = 'oathbound';
const STORE = 'saves';
const SLOT = 'slot0';
const DB_VERSION = 1;

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

/** Read the saved game, or null if none / unavailable / unreadable. */
export async function loadSave(): Promise<SaveData | null> {
  if (!available()) return null;
  try {
    const db = await openDb();
    const data = await new Promise<SaveData | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(SLOT);
      req.onsuccess = () => resolve((req.result as SaveData | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return data && typeof data.schemaVersion === 'number' ? data : null;
  } catch {
    return null;
  }
}

/** Persist the game. Resolves false on failure (never throws). */
export async function writeSave(data: SaveData): Promise<boolean> {
  if (!available()) return false;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, SLOT);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Delete the saved game (used by a fresh-start / dev reset). */
export async function clearSave(): Promise<void> {
  if (!available()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(SLOT);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* ignore */
  }
}

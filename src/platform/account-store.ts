// Account / character roster for the onboarding flow (0.7.x). There is no auth yet — an
// "account" is just this device: up to MAX_SLOTS character saves (in IndexedDB, via
// save-store) plus a small names manifest in localStorage. Character class + level are
// read straight from each slot's SaveData; only the chosen display name lives here, so
// the save schema (src/sim/save.ts) is untouched and stays forward-compatible.

import type { ClassId } from '../core/ecs/components';
import { MAX_SLOTS, loadSlot, clearSlot } from './save-store';

const NAMES_KEY = 'oathbound.characterNames';
const ACCOUNT_KEY = 'oathbound.accountName';

export interface CharacterSummary {
  slot: number;
  name: string;
  classId: ClassId;
  level: number;
}

const CLASS_LABEL: Record<ClassId, string> = {
  warrior: 'Warrior',
  hunter: 'Hunter',
  priest: 'Priest',
};

/** Human-readable class name (used as a fallback character name + on the roster cards). */
export function classLabel(id: ClassId): string {
  return CLASS_LABEL[id] ?? id;
}

function readNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeNames(map: Record<string, string>): void {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable → names degrade to class-based fallbacks.
  }
}

/** The stored display name for a slot, or null if none was set. */
export function getCharacterName(slot: number): string | null {
  return readNames()[String(slot)] ?? null;
}

/** Record a slot's display name (set at character creation). */
export function setCharacterName(slot: number, name: string): void {
  const map = readNames();
  map[String(slot)] = name;
  writeNames(map);
}

function clearCharacterName(slot: number): void {
  const map = readNames();
  delete map[String(slot)];
  writeNames(map);
}

/** Cosmetic login name for this device ("no auth"); empty string if unset. */
export function getAccountName(): string {
  try {
    return localStorage.getItem(ACCOUNT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAccountName(name: string): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, name);
  } catch {
    /* ignore */
  }
}

/** Summary per slot (null = empty), merging each slot's save with the names manifest. */
export async function listCharacters(): Promise<(CharacterSummary | null)[]> {
  const names = readNames();
  const out: (CharacterSummary | null)[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const data = await loadSlot(i);
    if (!data) {
      out.push(null);
      continue;
    }
    const classId = data.classId ?? 'warrior';
    out.push({
      slot: i,
      name: names[String(i)] ?? classLabel(classId),
      classId,
      level: data.character?.level ?? 1,
    });
  }
  return out;
}

/** The first empty slot index, or -1 if the account is full (MAX_SLOTS characters). */
export async function firstEmptySlot(): Promise<number> {
  const list = await listCharacters();
  return list.findIndex((c) => c === null);
}

/** Delete a character: wipe its save slot and forget its name. */
export async function deleteCharacter(slot: number): Promise<void> {
  await clearSlot(slot);
  clearCharacterName(slot);
}

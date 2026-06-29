// App shell / onboarding orchestrator. Owns the pre-world flow — Login → Character
// Select → (Create) → enter world — and the in-game "log out / switch character" path,
// then hands off to boot() (src/game/bootstrap.ts) for the actual play session.
//
// The world is only booted once a character is chosen, so the menus render over a black
// canvas. Logging out reloads the page to tear the world down cleanly and return to the
// character-select screen (the session intent is remembered in sessionStorage).

import { boot, type Game } from './bootstrap';
import { LoginScreen } from '../render/login-screen';
import { CharacterSelect } from '../render/character-select';
import { setActiveSlot, loadSlot } from '../platform/save-store';
import { setCharacterName, deleteCharacter } from '../platform/account-store';
import type { ClassId } from '../core/ecs/components';

interface NewCharacter {
  name: string;
  classId: ClassId;
}

// Session intent (survives reloads within a tab, not across new tabs):
//   absent       → fresh visit: show the login screen
//   'world:<n>'  → playing slot n this session: a reload resumes straight into it
//   'select'     → returned from a log-out: show character select (skip login)
const SESSION_KEY = 'oathbound.session';

function readSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(v: string | null): void {
  try {
    if (v === null) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, v);
  } catch {
    // sessionStorage unavailable → routing falls back to the login screen each load.
  }
}

export function runApp(): void {
  const host = document.body;
  const login = new LoginScreen(host);
  const select = new CharacterSelect(host);
  let game: Game | null = null;

  function enterWorld(slot: number, newChar?: NewCharacter): void {
    setActiveSlot(slot);
    if (newChar) setCharacterName(slot, newChar.name);
    writeSession(`world:${slot}`);
    login.dispose();
    select.dispose();
    game = boot({
      newCharacter: newChar,
      onLogout: () => {
        // Reload so the whole world graph is torn down cleanly; on reload the 'select'
        // intent routes us back to the character-select screen.
        writeSession('select');
        game?.stop();
        location.reload();
      },
    });
  }

  select.onPlay = (slot) => enterWorld(slot);
  select.onCreate = (slot, name, classId) => enterWorld(slot, { name, classId });
  select.onDelete = (slot) => void deleteCharacter(slot).then(() => select.refresh());
  select.onBack = () => {
    writeSession(null);
    select.hide();
    login.show();
  };

  login.onPlay = () => {
    writeSession('select');
    login.hide();
    select.show();
  };

  // ── Entry routing ──
  const params = new URLSearchParams(location.search);
  if (import.meta.env.DEV && params.has('autostart')) {
    void quickStart(enterWorld);
    return;
  }

  const session = readSession();
  if (session && session.startsWith('world:')) {
    const slot = Number(session.slice('world:'.length));
    if (Number.isInteger(slot) && slot >= 0) {
      enterWorld(slot);
      return;
    }
  }
  if (session === 'select') {
    select.show();
    return;
  }
  login.show();
}

// Dev/test fast path (disabled in production builds): skip the menus and drop straight
// into slot 0 — resuming its save if present, else spinning up a default character. Keeps
// the e2e suite booting directly into the world while real users get the onboarding flow.
async function quickStart(enter: (slot: number, nc?: NewCharacter) => void): Promise<void> {
  const data = await loadSlot(0);
  if (data) enter(0);
  else enter(0, { name: 'Adventurer', classId: 'warrior' });
}

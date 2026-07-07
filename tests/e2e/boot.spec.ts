// Playwright online-boot smoke (real browser). Oathbound is online-only: these tests boot the
// Vite client AND a local authoritative game server (both started by playwright.config.ts's
// webServer list), connect, auto-enter a character, and assert the world + HUD come up cleanly.
//
// KNOWN BASELINE: in a headless/CI environment without GPU acceleration the software WebGL path
// produces very slow frames, so render-heavy timing can be flaky. These tests deliberately assert
// only that the client connects, enters the world, and drives the reused HUD/panels without
// console errors — deep sim behaviour is covered by the unit suite (npm test) and the server
// persistence test (npm run server:test).

import { test, expect, type Page } from '@playwright/test';

const WS_URL = process.env.OATHBOUND_E2E_WS ?? 'ws://127.0.0.1:8080/ws';

/** A unique account per test so parallel runs (and a reused server DB) never collide. */
function creds(): { user: string; pass: string } {
  const rnd = Math.random().toString(36).slice(2, 8);
  return { user: `e2e_${Date.now().toString(36)}_${rnd}`, pass: 'e2e-password-123' };
}

/** Boot the online client straight into the world as a fresh warrior in slot 0. */
async function enterWorld(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  const { user, pass } = creds();
  const q = new URLSearchParams({ server: WS_URL, user, pass, char: '0', class: 'warrior' });
  await page.goto(`/?${q.toString()}`);
  // The status bar flips to "playing" once we've entered the world.
  await page.waitForFunction(() => document.body.innerText.includes('playing'), { timeout: 45_000 });
  return errors;
}

/** Tap a key (real key events; synthetic ones are unreliable for the input layer). */
async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
  await page.waitForTimeout(400);
}

test('connects, enters the world, and renders the HUD without errors', async ({ page }) => {
  const errors = await enterWorld(page);
  await expect(page.locator('#game')).toBeVisible();
  // Give the client a few snapshots to populate the shadow world + self block.
  await page.waitForTimeout(2000);
  // The reused offline unit-frame HUD is present once the self block has arrived.
  await expect(page.locator('.unit-frame.player')).toBeVisible();
  expect(errors).toEqual([]);
});

test('opens the core panels (inventory, character, travel, settings)', async ({ page }) => {
  const errors = await enterWorld(page);
  await page.waitForTimeout(2000);

  await tap(page, 'b'); // inventory
  await expect(page.locator('.inv-panel')).toBeVisible();
  await tap(page, 'b');

  await tap(page, 'c'); // character sheet
  await expect(page.locator('.char-panel')).toBeVisible();
  await tap(page, 'c');

  await tap(page, 't'); // fast travel — lists the spawn-attuned Home oathstone
  await expect(page.locator('.travel-panel')).toBeVisible();
  await expect(page.locator('.travel-panel')).toContainText('Home');
  await tap(page, 't');

  await tap(page, 'o'); // settings (client-only)
  await expect(page.locator('.settings-panel')).toBeVisible();

  expect(errors).toEqual([]);
});

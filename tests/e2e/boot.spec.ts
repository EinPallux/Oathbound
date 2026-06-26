import { test, expect } from '@playwright/test';

interface OathboundHandle {
  world: { entityCount: number };
  renderer: { drawCalls: number };
  loop: { isRunning: boolean };
  player: () => { x: number; y: number; z: number; yaw: number };
  target: () => number | null;
  enemies: () => { id: number; name: string; hp: number; max: number }[];
}
declare global {
  interface Window {
    __oathbound?: OathboundHandle;
  }
}

test('boots the greybox world, renders, and runs the loop', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');

  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('.perf-overlay')).toContainText('Oathbound 0.0.4-INDEV');

  await page.waitForFunction(() => (window.__oathbound?.world.entityCount ?? 0) >= 1);
  const running = await page.evaluate(() => window.__oathbound!.loop.isRunning);
  const drawCalls = await page.evaluate(() => window.__oathbound!.renderer.drawCalls);
  expect(running).toBe(true);
  expect(drawCalls).toBeGreaterThan(0);

  expect(errors).toEqual([]);
});

test('WASD moves the player and ground-snaps to terrain', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__oathbound !== undefined);

  const before = await page.evaluate(() => window.__oathbound!.player());

  // Hold W (camera yaw defaults to 0, so forward is +Z).
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');

  const after = await page.evaluate(() => window.__oathbound!.player());

  // Moved meaningfully forward along +Z.
  expect(after.z).toBeGreaterThan(before.z + 1);
  // Stayed on the ground (capsule centre ≈ terrain + halfHeight, terrain is gentle).
  expect(Number.isFinite(after.y)).toBe(true);
  expect(Math.abs(after.y - before.y)).toBeLessThan(3);
});

test('attacking a dummy deals damage and respects the GCD', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);

  const hp0 = await page.evaluate(() => window.__oathbound!.enemies()[0].hp);

  // Press "1" (Strike): with no lock, it soft-acquires the dummy ahead (+Z).
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(150);
  const hp1 = await page.evaluate(() => window.__oathbound!.enemies()[0].hp);
  expect(hp1).toBeLessThan(hp0);

  // A second press inside the 1s GCD is swallowed.
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(150);
  const hp2 = await page.evaluate(() => window.__oathbound!.enemies()[0].hp);
  expect(hp2).toBe(hp1);

  // After the GCD elapses, the next press lands.
  await page.waitForTimeout(1000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(150);
  const hp3 = await page.evaluate(() => window.__oathbound!.enemies()[0].hp);
  expect(hp3).toBeLessThan(hp1);
});

test('Tab locks onto a dummy and Esc clears it', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);

  expect(await page.evaluate(() => window.__oathbound!.target())).toBeNull();

  await page.keyboard.press('Tab');
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__oathbound!.target())).not.toBeNull();

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__oathbound!.target())).toBeNull();
});

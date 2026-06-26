import { test, expect } from '@playwright/test';

interface OathboundHandle {
  world: { entityCount: number };
  renderer: { drawCalls: number };
  loop: { isRunning: boolean };
  player: () => { x: number; y: number; z: number; yaw: number };
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
  await expect(page.locator('.perf-overlay')).toContainText('Oathbound 0.0.3-INDEV');

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

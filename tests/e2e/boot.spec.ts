import { test, expect } from '@playwright/test';

interface OathboundHandle {
  world: { entityCount: number };
  renderer: { drawCalls: number };
  loop: { isRunning: boolean };
}
declare global {
  interface Window {
    __oathbound?: OathboundHandle;
  }
}

test('boots, renders, runs the loop, and shows the perf overlay', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');

  // Canvas is present and the DOM UI overlay is rendering.
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('.perf-overlay')).toContainText('Oathbound 0.0.2-INDEV');

  // The ECS world is populated (demo entities created).
  await page.waitForFunction(() => (window.__oathbound?.world.entityCount ?? 0) > 0);
  const entities = await page.evaluate(() => window.__oathbound!.world.entityCount);
  expect(entities).toBeGreaterThan(100);

  // The loop is running and the renderer is issuing draw calls.
  await page.waitForTimeout(500);
  const running = await page.evaluate(() => window.__oathbound!.loop.isRunning);
  const drawCalls = await page.evaluate(() => window.__oathbound!.renderer.drawCalls);
  expect(running).toBe(true);
  expect(drawCalls).toBeGreaterThan(0);

  // No runtime errors during boot.
  expect(errors).toEqual([]);
});

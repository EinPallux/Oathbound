import { test, expect } from '@playwright/test';

interface EnemySnapshot {
  id: number;
  name: string;
  hp: number;
  max: number;
  state: string;
}
interface OathboundHandle {
  world: { entityCount: number };
  renderer: { drawCalls: number };
  loop: { isRunning: boolean };
  player: () => { x: number; y: number; z: number; yaw: number };
  target: () => number | null;
  enemies: () => EnemySnapshot[];
  level: () => number;
  xp: () => number;
  gold: () => number;
  materials: () => number;
  bagCount: () => number;
  classId: () => string;
  resource: () => { current: number; max: number };
  oathstones: () => { name: string; activated: boolean }[];
  telemetry: () => { damageDealt: number; kills: number; sessionSeconds: number };
  debugAddXp: (n: number) => void;
  debugSetClass: (id: 'warrior' | 'hunter' | 'priest') => void;
  save: () => Promise<boolean>;
}
declare global {
  interface Window {
    __oathbound?: OathboundHandle;
  }
}

const totalEnemyHp = () =>
  (window.__oathbound?.enemies() ?? []).reduce((s, e) => s + e.hp, 0);

test('boots the vertical slice, renders, and runs the loop', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');

  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('.perf-overlay')).toContainText('Oathbound 0.3.0-INDEV');

  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);
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
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__oathbound!.player());

  expect(after.z).toBeGreaterThan(before.z + 1);
  expect(Number.isFinite(after.y)).toBe(true);
  expect(Math.abs(after.y - before.y)).toBeLessThan(3);
});

test('attacking damages a Bloomhusk and respects the GCD', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);

  const before = await page.evaluate(totalEnemyHp);

  // Cleaving Strike soft-acquires the camp ahead (+Z).
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(150);
  const after1 = await page.evaluate(totalEnemyHp);
  expect(after1).toBeLessThan(before);

  // Inside the 1s GCD, a second press is swallowed.
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(150);
  const after2 = await page.evaluate(totalEnemyHp);
  expect(after2).toBe(after1);

  // After the GCD, the next press lands.
  await page.waitForTimeout(1000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(150);
  const after3 = await page.evaluate(totalEnemyHp);
  expect(after3).toBeLessThan(after1);
});

test('Tab locks onto an enemy and Esc clears it', async ({ page }) => {
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

test('telemetry counts damage dealt through the real event flow', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);

  expect(await page.evaluate(() => window.__oathbound!.telemetry().damageDealt)).toBe(0);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__oathbound!.telemetry().damageDealt)).toBeGreaterThan(0);
});

test('plays as the Hunter — ranged shots damage the camp', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);

  await page.evaluate(() => window.__oathbound!.debugSetClass('hunter'));
  expect(await page.evaluate(() => window.__oathbound!.classId())).toBe('hunter');
  expect(await page.evaluate(() => window.__oathbound!.resource().current)).toBeGreaterThan(0);

  const before = await page.evaluate(totalEnemyHp);
  // Quick Shot (slot 1): soft-acquires the camp ahead and fires a projectile.
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(400); // let the projectile fly + land
  const after = await page.evaluate(totalEnemyHp);
  expect(after).toBeLessThan(before);
});

test('plays as the Priest — holy Smite damages the camp', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);

  await page.evaluate(() => window.__oathbound!.debugSetClass('priest'));
  expect(await page.evaluate(() => window.__oathbound!.classId())).toBe('priest');

  const before = await page.evaluate(totalEnemyHp);
  await page.keyboard.press('Digit1'); // Smite (holy projectile)
  await page.waitForTimeout(400);
  const after = await page.evaluate(totalEnemyHp);
  expect(after).toBeLessThan(before);
});

test('attunes the spawn Oathstone and opens fast travel with T', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__oathbound?.oathstones().length ?? 0) >= 1);

  // The hub Oathstone next to spawn attunes on the first tick (binds the respawn).
  await page.waitForFunction(() =>
    (window.__oathbound?.oathstones() ?? []).some((o) => o.activated),
  );

  // T opens the fast-travel panel, listing the discovered hub.
  await page.keyboard.press('KeyT');
  await expect(page.locator('.travel-panel')).toBeVisible();
  await expect(page.locator('.travel-panel')).toContainText('Fast Travel');
  await expect(page.locator('.travel-panel')).toContainText('Oathhold');

  // T again closes it.
  await page.keyboard.press('KeyT');
  await expect(page.locator('.travel-panel')).toBeHidden();
});

test('shows the Goal Tracker + minimap and toggles the full map with M', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__oathbound !== undefined);

  // Fresh character → the onboarding checklist is up.
  await expect(page.locator('.goal-tracker')).toBeVisible();
  await expect(page.locator('.goal-tracker')).toContainText('Getting Started');
  await expect(page.locator('.goal-tracker')).toContainText('Move with WASD');

  // Always-on minimap, labelled with the current region (spawn = the hub).
  await expect(page.locator('.minimap')).toBeVisible();
  await expect(page.locator('.minimap-label')).toContainText('Oathhold');

  // M opens the full map; M again closes it.
  await expect(page.locator('.map-overlay')).toBeHidden();
  await page.keyboard.press('KeyM');
  await expect(page.locator('.map-overlay')).toBeVisible();
  await page.keyboard.press('KeyM');
  await expect(page.locator('.map-overlay')).toBeHidden();
});

test('progress persists across a reload (save v1)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__oathbound !== undefined);
  expect(await page.evaluate(() => window.__oathbound!.level())).toBe(1);

  // Gain enough XP to reach level 2 (xpToNext(1) = 50), then persist.
  await page.evaluate(() => window.__oathbound!.debugAddXp(60));
  expect(await page.evaluate(() => window.__oathbound!.level())).toBe(2);
  await page.evaluate(() => window.__oathbound!.save());

  await page.reload();
  await page.waitForFunction(() => window.__oathbound?.level() === 2);
  expect(await page.evaluate(() => window.__oathbound!.level())).toBe(2);
});

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
  debugSetLevel: (n: number) => void;
  debugTeleport: (x: number, z: number) => void;
  debugSetClass: (id: 'warrior' | 'hunter' | 'priest') => void;
  debugGiveItem: (rarity?: string) => void;
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

  await page.goto('/?autostart');

  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('.perf-overlay')).toContainText('Oathbound 0.7.2-INDEV');

  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);
  const running = await page.evaluate(() => window.__oathbound!.loop.isRunning);
  const drawCalls = await page.evaluate(() => window.__oathbound!.renderer.drawCalls);
  expect(running).toBe(true);
  expect(drawCalls).toBeGreaterThan(0);

  expect(errors).toEqual([]);
});

test('WASD moves the player and ground-snaps to terrain', async ({ page }) => {
  await page.goto('/?autostart');
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
  await page.goto('/?autostart');
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
  await page.goto('/?autostart');
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
  await page.goto('/?autostart');
  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);

  expect(await page.evaluate(() => window.__oathbound!.telemetry().damageDealt)).toBe(0);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__oathbound!.telemetry().damageDealt)).toBeGreaterThan(0);
});

test('plays as the Hunter — ranged shots damage the camp', async ({ page }) => {
  await page.goto('/?autostart');
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
  await page.goto('/?autostart');
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
  await page.goto('/?autostart');
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
  await page.goto('/?autostart');
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

test('talents: choosing the other option swaps the hotbar ability', async ({ page }) => {
  await page.goto('/?autostart');
  await page.waitForFunction(() => window.__oathbound !== undefined);
  await page.evaluate(() => window.__oathbound!.debugSetClass('warrior'));
  await page.evaluate(() => window.__oathbound!.debugSetLevel(18));
  await page.evaluate(() => window.__oathbound!.debugTeleport(40, 0)); // empty space, out of combat

  // Open the character/talents panel (C).
  await page.keyboard.press('KeyC');
  const panel = page.locator('.char-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.char-talents')).toContainText('Talents');

  // Hotbar slot 9 (choice node A) shows the default option.
  const slotA = page.locator('.hotbar .slot').nth(8).locator('.slot-name');
  await expect(slotA).toHaveText('Rallying Cry');

  // Pick the other option → the hotbar slot updates.
  await panel.getByRole('button', { name: 'Bloodthirst' }).click();
  await expect(slotA).toHaveText('Bloodthirst');
});

test('a world boss spawns and its fight runs without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/?autostart');
  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);

  // The three world bosses are tracked enemies with vastly more HP than any mob.
  const boss = await page.evaluate(
    () => window.__oathbound!.enemies().find((e) => e.max > 5000) ?? null,
  );
  expect(boss, 'a boss is present in the world').not.toBeNull();
  expect(boss!.max).toBeGreaterThan(5000);

  // Drop a max-level character into Emberhorn's arena (deep west) and let the fight run:
  // this exercises boss-ai (phases + telegraphed heavy → ground-AoE) and the boss/danger
  // render paths in a real browser. We only assert it stays healthy and error-free.
  await page.evaluate(() => window.__oathbound!.debugSetLevel(30));
  await page.evaluate(() => window.__oathbound!.debugTeleport(-213, -20));
  await page.waitForTimeout(2500);

  const running = await page.evaluate(() => window.__oathbound!.loop.isRunning);
  expect(running).toBe(true);
  const stillThere = await page.evaluate(
    () => (window.__oathbound!.enemies().find((e) => e.max > 5000)?.max ?? 0) > 5000,
  );
  expect(stillThere).toBe(true);
  expect(errors).toEqual([]);
});

test('Lv-30 endgame: the Goal Tracker pivots to the relic chase + map renders bosses', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  // Skip the tutorial so the Goal Tracker shows the goals/endgame view.
  await page.addInitScript(() => localStorage.setItem('oathbound.onboarded', '1'));
  await page.goto('/?autostart');
  await page.waitForFunction(() => window.__oathbound !== undefined);
  await page.evaluate(() => window.__oathbound!.debugSetClass('warrior'));
  await page.evaluate(() => window.__oathbound!.debugSetLevel(30));

  const tracker = page.locator('.goal-tracker');
  await expect(tracker).toContainText('Endgame');
  await expect(tracker).toContainText('Relics 0/4');
  await expect(tracker).toContainText('Emberhorn'); // the next relic target to hunt

  // The full map (with the crimson world-boss markers + labels) renders error-free.
  await page.keyboard.press('KeyM');
  await expect(page.locator('.map-overlay')).toBeVisible();
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test('Settings (O): accessibility options apply live and persist across reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/?autostart');
  await page.waitForFunction(() => window.__oathbound !== undefined);

  // O opens the settings panel.
  await expect(page.locator('.settings-panel')).toBeHidden();
  await page.keyboard.press('KeyO');
  await expect(page.locator('.settings-panel')).toBeVisible();

  // Toggling "Show damage numbers" off applies live (a class on #ui-root, no restart).
  await expect(page.locator('#ui-root')).not.toHaveClass(/dmg-off/);
  await page.locator('.settings-panel input[type="checkbox"]').first().uncheck();
  await expect(page.locator('#ui-root')).toHaveClass(/dmg-off/);

  // Changing UI scale sets the live CSS variable.
  await page.locator('.settings-panel select').first().selectOption('1.3');
  const scale = await page.evaluate(
    () => document.getElementById('ui-root')!.style.getPropertyValue('--ui-scale'),
  );
  expect(scale).toBe('1.3');

  // Audio: mute + set the volume slider (the first range; the Audio section).
  const mute = page.locator('.settings-panel input[type="checkbox"]').nth(4); // 5th: "Mute audio"
  await mute.check();
  const volume = page.locator('.settings-panel input[type="range"]').first();
  await expect(volume).toBeVisible();
  await volume.evaluate((el: HTMLInputElement) => {
    el.value = '30';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Settings persist: after a reload the prefs are still applied.
  await page.reload();
  await page.waitForFunction(() => window.__oathbound !== undefined);
  await expect(page.locator('#ui-root')).toHaveClass(/dmg-off/);
  await page.keyboard.press('KeyO');
  await expect(page.locator('.settings-panel')).toBeVisible();
  expect(await page.locator('.settings-panel input[type="checkbox"]').nth(4).isChecked()).toBe(true);
  expect(await page.locator('.settings-panel input[type="range"]').first().inputValue()).toBe('30');

  expect(errors).toEqual([]);
});

test('Inventory: item hover shows a tooltip; Rare+ salvage asks to confirm', async ({ page }) => {
  await page.goto('/?autostart');
  await page.waitForFunction(() => window.__oathbound !== undefined);
  await page.evaluate(() => window.__oathbound!.debugSetClass('warrior'));
  await page.evaluate(() => window.__oathbound!.debugSetLevel(10)); // past the salvage unlock
  await page.evaluate(() => window.__oathbound!.debugGiveItem('rare'));

  await page.keyboard.press('KeyB');
  const panel = page.locator('.inv-panel.bag');
  await expect(panel).toBeVisible();

  // The granted Rare weapon occupies the only filled bag cell.
  const cell = panel.locator('.bag-cell:not(.empty)').first();
  await expect(cell).toBeVisible();

  // Hovering it shows the item tooltip with its stat lines.
  await cell.hover();
  const tip = page.locator('.item-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Greataxe'); // weapon base name
  await expect(tip).toContainText('Strength'); // warrior weapon → primary STR line

  // Right-click opens the context menu; salvaging a Rare is a two-step confirm.
  await cell.click({ button: 'right' });
  const menu = page.locator('.bag-menu');
  await expect(menu).toBeVisible();
  const salv = menu.locator('.bag-menu-item.danger');
  await expect(salv).toContainText('Salvage');
  await salv.click();
  await expect(salv).toContainText('Confirm');
  expect(await page.evaluate(() => window.__oathbound!.bagCount())).toBe(1); // not yet salvaged
  await salv.click();
  expect(await page.evaluate(() => window.__oathbound!.bagCount())).toBe(0); // confirmed → salvaged
});

test('Controls: rebinding a key takes effect in-game and persists across reload', async ({ page }) => {
  await page.goto('/?autostart');
  await page.waitForFunction(() => window.__oathbound !== undefined);

  await page.keyboard.press('KeyO'); // open settings
  await expect(page.locator('.settings-panel')).toBeVisible();

  const invKey = page.locator('.keybind-row', { hasText: 'Inventory' }).locator('.keybind-key');
  await expect(invKey).toHaveText('B'); // default

  // Rebind Inventory: B → J (capture the next keypress).
  await invKey.click();
  await expect(invKey).toHaveText('Press a key…');
  await page.keyboard.press('KeyJ');
  await expect(invKey).toHaveText('J');

  // Close settings; the new binding actually drives the game (J now opens the bag).
  await page.keyboard.press('KeyO');
  await expect(page.locator('.settings-panel')).toBeHidden();
  await page.keyboard.press('KeyJ');
  await expect(page.locator('.inv-panel.bag')).toBeVisible();

  // Persists across a reload.
  await page.reload();
  await page.waitForFunction(() => window.__oathbound !== undefined);
  await page.keyboard.press('KeyO');
  await expect(
    page.locator('.keybind-row', { hasText: 'Inventory' }).locator('.keybind-key'),
  ).toHaveText('J');
});

test('UI pass: unit frames, Esc menu (layered), and the micro-bar', async ({ page }) => {
  await page.goto('/?autostart');
  await page.waitForFunction(() => (window.__oathbound?.enemies().length ?? 0) >= 1);
  await page.evaluate(() => window.__oathbound!.debugSetClass('warrior'));

  // The floating controls hint is gone; the player unit-frame is present.
  await expect(page.locator('.controls-hint')).toHaveCount(0);
  await expect(page.locator('.unit-frame.player')).toBeVisible();

  // Tab shows the target unit-frame (right of the player frame).
  await page.keyboard.press('Tab');
  await expect(page.locator('.unit-frame.target')).toBeVisible();

  // Layered Esc: first clears the target, then opens the settings menu, then closes it.
  await page.keyboard.press('Escape');
  await expect(page.locator('.unit-frame.target')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.settings-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.settings-panel')).toBeHidden();

  // The micro-bar's first button opens the inventory.
  await page.locator('.micro-bar .micro-btn').first().click();
  await expect(page.locator('.inv-panel')).toBeVisible();
});

test('progress persists across a reload (save v1)', async ({ page }) => {
  await page.goto('/?autostart');
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

test('onboarding: login → create a character → enter world → log out → re-enter', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  // No autostart here — we walk the real flow. The login gate shows first.
  await page.goto('/');
  await expect(page.locator('.login-screen')).toBeVisible();
  await expect(page.locator('#game')).toBeVisible();
  // The world isn't booted until a character is chosen.
  expect(await page.evaluate(() => window.__oathbound === undefined)).toBe(true);

  // Enter → character select with three empty slots.
  await page.locator('.login-play').click();
  await expect(page.locator('.char-select')).toBeVisible();
  await expect(page.locator('.cs-slot.empty.char-create')).toHaveCount(3);

  // Create a Hunter named "Lyra" in the first slot.
  await page.locator('.char-create').first().click();
  await expect(page.locator('.char-create-form')).toBeVisible();
  await page.locator('.create-name').fill('Lyra');
  // The confirm button is disabled until a class is chosen.
  await expect(page.locator('.create-confirm')).toBeDisabled();
  await page.locator('.class-card[data-class="hunter"]').click();
  await expect(page.locator('.create-confirm')).toBeEnabled();
  await page.locator('.create-confirm').click();

  // The world boots with that character.
  await page.waitForFunction(() => window.__oathbound !== undefined);
  expect(await page.evaluate(() => window.__oathbound!.classId())).toBe('hunter');
  await page.evaluate(() => window.__oathbound!.save()); // flush the slot before we leave

  // Log out from in-game (micro-bar "Character select / Log out" button) → back to select.
  await page.locator('.micro-bar .micro-btn').last().click();
  await expect(page.locator('.char-select')).toBeVisible();
  const filled = page.locator('.cs-slot.filled');
  await expect(filled).toHaveCount(1);
  await expect(filled).toContainText('Lyra');
  await expect(filled).toContainText('Hunter');
  // Two empty slots remain (max three characters total).
  await expect(page.locator('.cs-slot.empty.char-create')).toHaveCount(2);

  // Re-enter the world with the existing character.
  await filled.locator('.char-play').click();
  await page.waitForFunction(() => window.__oathbound !== undefined);
  expect(await page.evaluate(() => window.__oathbound!.classId())).toBe('hunter');

  expect(errors).toEqual([]);
});

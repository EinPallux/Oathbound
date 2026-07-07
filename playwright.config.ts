import { defineConfig } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The remote environment pre-installs Chromium under PLAYWRIGHT_BROWSERS_PATH and
// disables browser downloads. Resolve the actual chrome binary so Playwright uses it
// regardless of the @playwright/test version's expected revision.
function findChromium(): string | undefined {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dirs = readdirSync(base)
      .filter((d) => d.startsWith('chromium-'))
      .sort();
    for (const d of dirs) {
      for (const rel of [
        ['chrome-linux', 'chrome'],
        ['chrome-linux', 'headless_shell'],
      ]) {
        const p = join(base, d, ...rel);
        if (existsSync(p)) return p;
      }
    }
  } catch {
    /* fall through to Playwright default */
  }
  return undefined;
}

const executablePath = process.env.PW_CHROMIUM_BIN || findChromium();

export default defineConfig({
  testDir: './tests/e2e',
  // The world is now a large open world; in the headless software-GL container each
  // frame is slow, so heavy interaction tests need more headroom (they pass in ~20s
  // alone but contend under parallel load). Real-hardware FPS is unaffected.
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // Oathbound is online-only, so e2e needs BOTH the Vite client and an authoritative game
  // server. The server persists to a throwaway DB so runs don't pollute the dev database.
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'OATHBOUND_DB=.e2e-oathbound.db OATHBOUND_PORT=8080 npm run server:dev',
      port: 8080,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});

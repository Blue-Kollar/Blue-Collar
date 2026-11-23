/**
 * Visual regression tests – BlueCollar (#815)
 *
 * Baselines key pages in light and dark mode.
 * - Local: `pnpm exec playwright test visual/ --update-snapshots` to capture baselines.
 * - CI:    diffs are surfaced as artifacts; PRs fail on unexpected changes.
 * - Percy: set PERCY_TOKEN to additionally push snapshots to Chromatic/Percy.
 *
 * Run:
 *   pnpm --filter @bluecollar/app exec playwright test packages/app/visual/
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

/** Disable animations / transitions for deterministic snapshots. */
async function freezePage(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`,
  });
}

const PAGES = [
  { name: 'home', path: '/en' },
  { name: 'workers', path: '/en/workers' },
  { name: 'login', path: '/en/auth/login' },
  { name: 'register', path: '/en/auth/register' },
  { name: 'forgot-password', path: '/en/auth/forgot-password' },
];

test.describe('Visual regression – light mode', () => {
  for (const { name, path } of PAGES) {
    test(`${name} desktop`, async ({ page }) => {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState('networkidle');
      await freezePage(page);
      await expect(page).toHaveScreenshot(`${name}-desktop-light.png`);
    });

    test(`${name} mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState('networkidle');
      await freezePage(page);
      await expect(page).toHaveScreenshot(`${name}-mobile-light.png`);
    });
  }
});

test.describe('Visual regression – dark mode', () => {
  for (const { name, path } of PAGES) {
    test(`${name} desktop`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState('networkidle');
      await freezePage(page);
      await expect(page).toHaveScreenshot(`${name}-desktop-dark.png`);
    });
  }
});

import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

test.describe('Performance budgets', () => {
  test('home page load meets budget', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE}/en`);
    await page.waitForLoadState('networkidle');
    const duration = Date.now() - start;

    // Example budget: page should load within 3000ms (adjust as needed)
    expect(duration).toBeLessThan(3000);
  });

  test('workers page load meets budget', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE}/en/workers`);
    await page.waitForLoadState('networkidle');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(3500);
  });
});

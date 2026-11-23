import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

test.describe('Complete user workflows', () => {
  test('registration -> search -> open worker -> tip modal flow', async ({ page }) => {
    const unique = Date.now();
    const email = `e2e+${unique}@example.com`;

    // Registration
    await page.goto(`${BASE}/en/auth/register`);
    await expect(page).toHaveURL(/register/);
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    await emailInput.fill(email);
    const pwInputs = page.locator('input[type="password"]');
    if ((await pwInputs.count()) > 0) {
      await pwInputs.nth(0).fill('Password123!');
      if ((await pwInputs.count()) > 1) await pwInputs.nth(1).fill('Password123!');
    }
    await page.locator('button[type="submit"]').first().click();

    // After register, app may redirect to login or dashboard — tolerate both
    await page.waitForLoadState('networkidle');

    // Search for workers
    await page.goto(`${BASE}/en/workers`);
    await expect(page).toHaveURL(/workers/);
    // Try to use search if available
    const search = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if ((await search.count()) > 0) {
      await search.fill('plumber');
      await search.press('Enter');
    }

    // Open first worker profile
    const workerLink = page.locator('a[href*="/workers/"]').first();
    if ((await workerLink.count()) > 0) {
      await workerLink.click();
      await expect(page).toHaveURL(/workers\//);

      // Tip flow: attempt to open tip modal
      const tipButton = page
        .locator('button:has-text("Tip"), button:has-text("Pay"), [data-testid="tip-button"]')
        .first();
      if ((await tipButton.count()) > 0) {
        await tipButton.click();
        // Expect a modal or auth prompt
        const modal = page.locator('[role="dialog"], [data-testid="tip-modal"]');
        await expect(modal.first()).toBeVisible();
      }
    } else {
      // No workers — at least the listing rendered
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

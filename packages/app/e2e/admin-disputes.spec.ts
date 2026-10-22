/**
 * E2E tests for the admin dispute review UI (#938).
 * The API is mocked via route interception — this suite runs in CI jobs
 * that only boot the Next.js app (no live backend), matching the pattern
 * used by the rest of this e2e suite.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
const MOCK_TOKEN = 'mock-e2e-jwt-token';

const ADMIN_USER = {
  id: 'admin-1',
  firstName: 'Ada',
  lastName: 'Admin',
  email: 'admin@example.com',
  role: 'admin',
};

const REGULAR_USER = {
  id: 'user-1',
  firstName: 'Rae',
  lastName: 'Regular',
  email: 'user@example.com',
  role: 'user',
};

const OPEN_DISPUTE = {
  id: 'dispute-1',
  workerId: 'worker-1',
  filedById: 'user-1',
  reason: 'No-show for scheduled job',
  evidence: 'Photos of empty driveway at appointment time',
  status: 'open',
  resolution: null,
  resolvedById: null,
  createdAt: new Date(0).toISOString(),
  worker: { id: 'worker-1', name: 'Flaky Plumbing Co.' },
  filedBy: { id: 'user-1', firstName: 'Rae', lastName: 'Regular' },
};

/** Log the given user in for the app: sets the auth cookie (read by middleware.ts)
 *  and localStorage token (read by AuthContext), and mocks /auth/me. */
async function loginAs(page: Page, user: typeof ADMIN_USER | typeof REGULAR_USER) {
  await page.context().addCookies([{ name: 'bc_token', value: MOCK_TOKEN, url: BASE }]);
  await page.addInitScript((token) => {
    window.localStorage.setItem('bc_token', token);
  }, MOCK_TOKEN);
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: user }),
    }),
  );
}

test.describe('Admin disputes page', () => {
  test('lists open disputes with evidence visible for an admin', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await page.route('**/v1/disputes**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [OPEN_DISPUTE],
          meta: { total: 1, page: 1, limit: 20, pages: 1 },
        }),
      }),
    );

    await page.goto(`${BASE}/en/dashboard/admin/disputes`);

    await expect(page.getByText('Dispute against Flaky Plumbing Co.')).toBeVisible();
    await expect(page.getByText(OPEN_DISPUTE.evidence)).toBeVisible();
    await expect(page.getByText(OPEN_DISPUTE.reason)).toBeVisible();
  });

  test('resolving a dispute updates its status without a full page reload', async ({ page }) => {
    await loginAs(page, ADMIN_USER);

    let resolved = false;
    await page.route('**/v1/disputes**', (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        const dispute = resolved
          ? { ...OPEN_DISPUTE, status: 'resolved', resolution: 'Resolved by admin as resolved' }
          : OPEN_DISPUTE;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [dispute],
            meta: { total: 1, page: 1, limit: 20, pages: 1 },
          }),
        });
      }
      return route.fallback();
    });
    await page.route('**/v1/disputes/*/resolve', (route) => {
      resolved = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...OPEN_DISPUTE,
            status: 'resolved',
            resolution: 'Resolved by admin as resolved',
          },
        }),
      });
    });

    await page.goto(`${BASE}/en/dashboard/admin/disputes`);
    await expect(page.getByText('Dispute against Flaky Plumbing Co.')).toBeVisible();

    await page.getByRole('button', { name: 'Resolve' }).click();

    // The status badge flips to "resolved" and the action buttons disappear —
    // no navigation should occur (still the same URL, no reload).
    await expect(page.getByText('resolved', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resolve' })).toHaveCount(0);
    await expect(page).toHaveURL(/dashboard\/admin\/disputes/);
  });

  test('redirects a non-admin user away from the disputes page', async ({ page }) => {
    await loginAs(page, REGULAR_USER);
    await page.route('**/v1/disputes**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'error', message: 'Forbidden', code: 403 }),
      }),
    );

    await page.goto(`${BASE}/en/dashboard/admin/disputes`);

    await expect(page).not.toHaveURL(/dashboard\/admin\/disputes/, { timeout: 10_000 });
  });

  test('blocks an unauthenticated visitor from the disputes page', async ({ page }) => {
    await page.goto(`${BASE}/en/dashboard/admin/disputes`);
    await page.waitForURL(/login|auth/, { timeout: 10_000 });
    expect(page.url()).toMatch(/login|auth/);
  });
});

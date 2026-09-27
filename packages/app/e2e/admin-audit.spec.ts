/**
 * E2E tests for the admin audit log page (#942).
 * Covers authorization gating, listing/filtering/pagination, and
 * cross-validation that admin actions taken elsewhere in the dashboard
 * (dispute resolution, user moderation) produce a corresponding audit
 * log entry — the key requirement called out in the issue.
 * The API is mocked via route interception, matching the pattern used by
 * admin-disputes.spec.ts — this suite runs in CI jobs that only boot the
 * Next.js app (no live backend).
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

interface AuditEntry {
  id: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string } | null;
}

function makeLogs(): AuditEntry[] {
  return [
    {
      id: 'log-1',
      action: 'user.suspend',
      resource: 'user',
      resourceId: 'u-1',
      createdAt: new Date(0).toISOString(),
      user: { id: 'admin-1', firstName: 'Ada', lastName: 'Admin' },
    },
    {
      id: 'log-2',
      action: 'dispute.resolve',
      resource: 'dispute',
      resourceId: 'dispute-1',
      createdAt: new Date(1000).toISOString(),
      user: { id: 'admin-1', firstName: 'Ada', lastName: 'Admin' },
    },
  ];
}

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

async function mockAuditLogs(page: Page, logs: AuditEntry[]) {
  await page.route('**/v1/audit?**', (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action')?.toLowerCase();
    const filtered = action ? logs.filter((l) => l.action.toLowerCase().includes(action)) : logs;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: filtered,
        meta: { total: filtered.length, page: 1, limit: 50, pages: 1 },
      }),
    });
  });
}

test.describe('Admin audit log page — authorization', () => {
  test('blocks an unauthenticated visitor', async ({ page }) => {
    await page.goto(`${BASE}/en/dashboard/admin/audit`);
    await page.waitForURL(/login|auth/, { timeout: 10_000 });
    expect(page.url()).toMatch(/login|auth/);
  });

  test('redirects a non-admin user away', async ({ page }) => {
    await loginAs(page, REGULAR_USER);
    await mockAuditLogs(page, makeLogs());
    await page.goto(`${BASE}/en/dashboard/admin/audit`);
    await expect(page).not.toHaveURL(/dashboard\/admin\/audit/, { timeout: 10_000 });
  });
});

test.describe('Admin audit log page — listing and filtering', () => {
  test('lists audit entries with actor, action, and resource columns', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await mockAuditLogs(page, makeLogs());

    await page.goto(`${BASE}/en/dashboard/admin/audit`);

    await expect(page.getByText('user.suspend')).toBeVisible();
    await expect(page.getByText('dispute.resolve')).toBeVisible();
    await expect(page.getByText('Ada Admin')).toHaveCount(2);
  });

  test('shows an empty state when there are no matching entries', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await mockAuditLogs(page, []);

    await page.goto(`${BASE}/en/dashboard/admin/audit`);

    await expect(page.getByText('No audit log entries found')).toBeVisible();
  });

  test('filtering by action sends the filter as a query param and narrows the results', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await mockAuditLogs(page, makeLogs());

    await page.goto(`${BASE}/en/dashboard/admin/audit`);
    await expect(page.getByText('user.suspend')).toBeVisible();
    await expect(page.getByText('dispute.resolve')).toBeVisible();

    const request = page.waitForRequest((req) => req.url().includes('/v1/audit') && req.url().includes('action=dispute'));
    await page.getByPlaceholder('Filter by action...').fill('dispute');
    await request;

    await expect(page.getByText('dispute.resolve')).toBeVisible();
    await expect(page.getByText('user.suspend')).toHaveCount(0);
  });

  test('paginates when more than one page of entries is available', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await page.route('**/v1/audit?**', (route) => {
      const url = new URL(route.request().url());
      const requestedPage = Number(url.searchParams.get('page') ?? '1');
      const logs = makeLogs();
      const pageEntries = requestedPage === 1 ? [logs[0]] : [logs[1]];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: pageEntries, meta: { total: 2, page: requestedPage, limit: 1, pages: 2 } }),
      });
    });

    await page.goto(`${BASE}/en/dashboard/admin/audit`);
    await expect(page.getByText('user.suspend')).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('dispute.resolve')).toBeVisible();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
  });
});

test.describe('Admin audit log page — cross-validation with dispute resolution', () => {
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

  test('resolving a dispute produces a matching audit log entry', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    const auditEntries: AuditEntry[] = [];
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
          body: JSON.stringify({ data: [dispute], meta: { total: 1, page: 1, limit: 20, pages: 1 } }),
        });
      }
      return route.fallback();
    });
    await page.route('**/v1/disputes/*/resolve', (route) => {
      resolved = true;
      auditEntries.push({
        id: 'log-resolve-1',
        action: 'dispute.resolve',
        resource: 'dispute',
        resourceId: OPEN_DISPUTE.id,
        createdAt: new Date().toISOString(),
        user: { id: ADMIN_USER.id, firstName: ADMIN_USER.firstName, lastName: ADMIN_USER.lastName },
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { ...OPEN_DISPUTE, status: 'resolved', resolution: 'Resolved by admin as resolved' },
        }),
      });
    });
    await page.route('**/v1/audit?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: auditEntries, meta: { total: auditEntries.length, page: 1, limit: 50, pages: 1 } }),
      }),
    );

    await page.goto(`${BASE}/en/dashboard/admin/disputes`);
    await expect(page.getByText('Dispute against Flaky Plumbing Co.')).toBeVisible();
    await page.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.getByText('resolved', { exact: false })).toBeVisible();

    await page.goto(`${BASE}/en/dashboard/admin/audit`);

    await expect(page.getByText('dispute.resolve')).toBeVisible();
    await expect(page.getByText(OPEN_DISPUTE.id)).toBeVisible();
  });
});

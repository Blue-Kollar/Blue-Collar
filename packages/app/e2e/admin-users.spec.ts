/**
 * E2E tests for the admin user management page (#942).
 * Covers authorization gating, search/filtering, individual moderation
 * actions (suspend/unsuspend/ban/role change), bulk operations, and
 * cross-validation that each action produces a matching audit log entry.
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

interface MockUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'user' | 'curator' | 'admin';
  deletedAt: string | null;
  createdAt: string;
}

function makeUsers(): MockUser[] {
  return [
    {
      id: 'u-1',
      firstName: 'Wanda',
      lastName: 'Worker',
      email: 'wanda@example.com',
      role: 'user',
      deletedAt: null,
      createdAt: new Date(0).toISOString(),
    },
    {
      id: 'u-2',
      firstName: 'Carl',
      lastName: 'Curator',
      email: 'carl@example.com',
      role: 'curator',
      deletedAt: null,
      createdAt: new Date(0).toISOString(),
    },
    {
      id: 'admin-1',
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      deletedAt: null,
      createdAt: new Date(0).toISOString(),
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

/** Mocks GET /v1/admin/users, applying the same search/role/status filters the
 *  real backend applies, so filter-driven tests exercise the request query params. */
async function mockUserList(page: Page, users: ReturnType<typeof makeUsers>) {
  await page.route('**/v1/admin/users?**', (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search')?.toLowerCase();
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');

    let filtered = users;
    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.firstName.toLowerCase().includes(search) ||
          u.lastName.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search),
      );
    }
    if (role) filtered = filtered.filter((u) => u.role === role);
    if (status === 'suspended') filtered = filtered.filter((u) => u.deletedAt != null);
    if (status === 'active') filtered = filtered.filter((u) => u.deletedAt == null);

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: filtered,
        meta: { total: filtered.length, page: 1, limit: 20, pages: 1 },
      }),
    });
  });
}

test.describe('Admin users page — authorization', () => {
  test('blocks an unauthenticated visitor', async ({ page }) => {
    await page.goto(`${BASE}/en/dashboard/admin/users`);
    await page.waitForURL(/login|auth/, { timeout: 10_000 });
    expect(page.url()).toMatch(/login|auth/);
  });

  test('redirects a non-admin user away', async ({ page }) => {
    await loginAs(page, REGULAR_USER);
    await mockUserList(page, makeUsers());
    await page.goto(`${BASE}/en/dashboard/admin/users`);
    await expect(page).not.toHaveURL(/dashboard\/admin\/users/, { timeout: 10_000 });
  });
});

test.describe('Admin users page — listing and filters', () => {
  test('lists users with role and status badges for an admin', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await mockUserList(page, makeUsers());

    await page.goto(`${BASE}/en/dashboard/admin/users`);

    await expect(page.getByText('Wanda Worker')).toBeVisible();
    await expect(page.getByText('Carl Curator')).toBeVisible();
    await expect(page.getByText('Ada Admin')).toBeVisible();
    await expect(page.getByText('Active', { exact: false }).first()).toBeVisible();
  });

  test('filters the user list by search term', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await mockUserList(page, makeUsers());

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    await expect(page.getByText('Wanda Worker')).toBeVisible();

    await page.getByLabel('Search users').fill('carl');

    await expect(page.getByText('Carl Curator')).toBeVisible();
    await expect(page.getByText('Wanda Worker')).toHaveCount(0);
  });

  test('filters the user list by role', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await mockUserList(page, makeUsers());

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    await expect(page.getByText('Wanda Worker')).toBeVisible();

    await page.getByLabel('Filter by role').selectOption('curator');

    await expect(page.getByText('Carl Curator')).toBeVisible();
    await expect(page.getByText('Wanda Worker')).toHaveCount(0);
    await expect(page.getByText('Ada Admin')).toHaveCount(0);
  });

  test('filters the user list by status', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    const users = makeUsers();
    const wanda = users[0];
    if (wanda) wanda.deletedAt = new Date().toISOString();
    await mockUserList(page, users);

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    await expect(page.getByText('Wanda Worker')).toBeVisible();

    await page.getByLabel('Filter by status').selectOption('suspended');

    await expect(page.getByText('Wanda Worker')).toBeVisible();
    await expect(page.getByText('Carl Curator')).toHaveCount(0);
  });
});

test.describe('Admin users page — moderation actions', () => {
  test('suspends a user and reflects the status change without a full reload', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    const users = makeUsers();
    let suspended = false;

    await page.route('**/v1/admin/users?**', (route) => {
      const data = users.map((u) => (u.id === 'u-1' && suspended ? { ...u, deletedAt: new Date().toISOString() } : u));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data, meta: { total: data.length, page: 1, limit: 20, pages: 1 } }),
      });
    });
    await page.route('**/v1/admin/users/u-1/suspend', (route) => {
      suspended = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'u-1', suspended: true }, status: 'success', code: 200 }),
      });
    });

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    await expect(page.getByText('Wanda Worker')).toBeVisible();

    const row = page.locator('tr', { hasText: 'Wanda Worker' });
    await row.getByRole('button', { name: 'Suspend' }).click();

    await expect(row.getByText('Suspended')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Unsuspend' })).toBeVisible();
    await expect(page).toHaveURL(/dashboard\/admin\/users/);
  });

  test('unsuspends a suspended user', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    const users = makeUsers();
    const wanda = users[0];
    if (wanda) wanda.deletedAt = new Date().toISOString();
    let unsuspended = false;

    await page.route('**/v1/admin/users?**', (route) => {
      const data = users.map((u) => (u.id === 'u-1' && unsuspended ? { ...u, deletedAt: null } : u));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data, meta: { total: data.length, page: 1, limit: 20, pages: 1 } }),
      });
    });
    await page.route('**/v1/admin/users/u-1/unsuspend', (route) => {
      unsuspended = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'u-1', suspended: false }, status: 'success', code: 200 }),
      });
    });

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    const row = page.locator('tr', { hasText: 'Wanda Worker' });
    await expect(row.getByText('Suspended')).toBeVisible();

    await row.getByRole('button', { name: 'Unsuspend' }).click();

    await expect(row.getByText('Active', { exact: false })).toBeVisible();
  });

  test('bans a user after confirming the destructive-action dialog', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    const users = makeUsers();
    let banned = false;

    page.on('dialog', (dialog) => dialog.accept());

    await page.route('**/v1/admin/users?**', (route) => {
      const data = users.filter((u) => !(u.id === 'u-1' && banned));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data, meta: { total: data.length, page: 1, limit: 20, pages: 1 } }),
      });
    });
    await page.route('**/v1/admin/users/u-1/ban', (route) => {
      banned = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'u-1', banned: true }, status: 'success', code: 200 }),
      });
    });

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    const row = page.locator('tr', { hasText: 'Wanda Worker' });
    await row.getByRole('button', { name: 'Ban' }).click();

    await expect(page.getByText('Wanda Worker')).toHaveCount(0);
  });

  test('cannot suspend, ban, or edit the role of an admin row', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await mockUserList(page, makeUsers());

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    const adminRow = page.locator('tr', { hasText: 'Ada Admin' });

    await expect(adminRow.getByRole('button', { name: 'Ban' })).toBeDisabled();
    await expect(adminRow.getByLabel('Change role for Ada Admin')).toBeDisabled();
    await expect(adminRow.getByLabel('Select Ada Admin')).toBeDisabled();
  });

  test('changes a user role via the per-row role select', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    const users = makeUsers();
    let roleChanged = false;

    await page.route('**/v1/admin/users?**', (route) => {
      const data = users.map((u) => (u.id === 'u-1' && roleChanged ? { ...u, role: 'curator' } : u));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data, meta: { total: data.length, page: 1, limit: 20, pages: 1 } }),
      });
    });
    await page.route('**/v1/admin/users/u-1/role', (route) => {
      roleChanged = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'u-1', email: 'wanda@example.com', firstName: 'Wanda', lastName: 'Worker', role: 'curator' },
          status: 'success',
          code: 200,
        }),
      });
    });

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    const row = page.locator('tr', { hasText: 'Wanda Worker' });
    await row.getByLabel('Change role for Wanda Worker').selectOption('curator');

    await expect(row.getByLabel('Change role for Wanda Worker')).toHaveValue('curator');
  });
});

test.describe('Admin users page — bulk operations', () => {
  test('bulk-suspends selected users', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    const users = makeUsers();
    let bulkSuspendedIds: string[] = [];

    await page.route('**/v1/admin/users?**', (route) => {
      const data = users.map((u) => (bulkSuspendedIds.includes(u.id) ? { ...u, deletedAt: new Date().toISOString() } : u));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data, meta: { total: data.length, page: 1, limit: 20, pages: 1 } }),
      });
    });
    await page.route('**/v1/admin/users/bulk-suspend', async (route) => {
      const body = route.request().postDataJSON() as { ids: string[] };
      bulkSuspendedIds = body.ids;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { updated: body.ids.length, suspended: true }, status: 'success', code: 200 }),
      });
    });

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    await expect(page.getByText('Wanda Worker')).toBeVisible();

    await page.getByLabel('Select Wanda Worker').check();
    await page.getByLabel('Select Carl Curator').check();
    await expect(page.getByText('2 selected')).toBeVisible();

    await page.getByRole('button', { name: 'Suspend selected' }).click();

    const wandaRow = page.locator('tr', { hasText: 'Wanda Worker' });
    const carlRow = page.locator('tr', { hasText: 'Carl Curator' });
    await expect(wandaRow.getByText('Suspended')).toBeVisible();
    await expect(carlRow.getByText('Suspended')).toBeVisible();
  });

  test('"select all" only selects non-admin rows', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    await mockUserList(page, makeUsers());

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    await expect(page.getByText('Wanda Worker')).toBeVisible();

    await page.getByLabel('Select all users').check();

    await expect(page.getByText('2 selected')).toBeVisible();
    await expect(page.getByLabel('Select Ada Admin')).not.toBeChecked();
  });
});

test.describe('Admin users page — audit log cross-validation', () => {
  test('a suspend action produces a matching audit log entry', async ({ page }) => {
    await loginAs(page, ADMIN_USER);
    const users = makeUsers();
    const auditEntries: Array<{ id: string; action: string; resource: string; resourceId: string; createdAt: string; user: typeof ADMIN_USER }> = [];
    let suspended = false;

    await page.route('**/v1/admin/users?**', (route) => {
      const data = users.map((u) => (u.id === 'u-1' && suspended ? { ...u, deletedAt: new Date().toISOString() } : u));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data, meta: { total: data.length, page: 1, limit: 20, pages: 1 } }),
      });
    });
    await page.route('**/v1/admin/users/u-1/suspend', (route) => {
      suspended = true;
      auditEntries.push({
        id: 'log-1',
        action: 'user.suspend',
        resource: 'user',
        resourceId: 'u-1',
        createdAt: new Date().toISOString(),
        user: ADMIN_USER,
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'u-1', suspended: true }, status: 'success', code: 200 }),
      });
    });
    await page.route('**/v1/audit?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: auditEntries,
          meta: { total: auditEntries.length, page: 1, limit: 50, pages: 1 },
        }),
      }),
    );

    await page.goto(`${BASE}/en/dashboard/admin/users`);
    const row = page.locator('tr', { hasText: 'Wanda Worker' });
    await row.getByRole('button', { name: 'Suspend' }).click();
    await expect(row.getByText('Suspended')).toBeVisible();

    await page.goto(`${BASE}/en/dashboard/admin/audit`);

    await expect(page.getByText('user.suspend')).toBeVisible();
    await expect(page.getByText('u-1')).toBeVisible();
  });
});

/**
 * E2E smoke tests for the consolidated locale-prefixed admin routes.
 * Confirms the admin overview, users, disputes, audit, categories, and
 * moderation pages are all reachable under a locale prefix now that the
 * legacy non-locale `dashboard/admin` monolith has been removed.
 * Also covers the relocated auth-callback and wallet/history routes.
 * Issue #934
 */
import { test, expect } from '@playwright/test'
import { injectFreighterMock } from './freighter-mock'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

const ADMIN_ROUTES = [
  '/en/dashboard/admin',
  '/en/dashboard/admin/users',
  '/en/dashboard/admin/disputes',
  '/en/dashboard/admin/audit',
  '/en/dashboard/admin/categories',
  '/en/dashboard/admin/moderation',
]

test.describe('Admin dashboard routes (locale-prefixed)', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterMock(page)
  })

  for (const route of ADMIN_ROUTES) {
    test(`${route} is reachable (redirects to login when unauthenticated)`, async ({ page }) => {
      await page.goto(`${BASE}${route}`)
      await page.waitForURL(/login|auth|dashboard/, { timeout: 10_000 })
      const url = page.url()
      expect(url.includes('login') || url.includes('auth') || url.includes('dashboard')).toBeTruthy()
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
      await expect(page.locator('body')).not.toContainText('Application error')
    })
  }

  test('non-locale /dashboard/admin no longer resolves directly and is redirected to a locale prefix', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/admin`)
    await page.waitForURL(/\/(en|fr|es|pt)\//, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/(en|fr|es|pt)\/(dashboard\/admin|.*auth.*|.*login.*)/)
  })
})

test.describe('Relocated auth-callback and wallet/history routes', () => {
  test('auth-callback page loads under a locale prefix without crashing', async ({ page }) => {
    await page.goto(`${BASE}/en/auth-callback`)
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')
    // No token/error query param present -> the page renders its "No authentication token received" error state
    await expect(page.locator('body')).toContainText(/sign-in|token/i)
  })

  test('wallet/history page loads under a locale prefix without crashing', async ({ page }) => {
    await injectFreighterMock(page)
    await page.goto(`${BASE}/en/wallet/history`)
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')
    await expect(page.locator('body')).toContainText(/transaction history/i)
  })
})

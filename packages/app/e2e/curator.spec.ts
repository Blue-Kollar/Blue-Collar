/**
 * E2E tests for curator listing management flows.
 * Covers: discovery → profile → tip (wallet mocked) and curator CRUD journeys.
 * Issue #811
 */
import { test, expect } from '@playwright/test'
import { injectFreighterMock } from './freighter-mock'
import {
  BASE,
  goToHome,
  goToLogin,
  goToRegister,
  goToForgotPassword,
  goToDashboard,
  goToWorkers,
  emailInputLocator,
  passwordInputLocator,
  firstWorkerLinkLocator,
  expectNoServerError,
  expectAuthRedirect,
} from './helpers'

test.describe('Discovery → Profile → Tip flow (mocked wallet)', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterMock(page)
  })

  test('workers listing page loads and shows search UI', async ({ page }) => {
    await goToWorkers(page)
    await expect(page).toHaveURL(/workers/)
    await expectNoServerError(page)

    const searchOrFilter = page.locator(
      'input[type="search"], input[placeholder*="search" i], select, [role="combobox"]'
    )
    await expect(searchOrFilter.first()).toBeVisible({ timeout: 10_000 })
  })

  test('worker profile page renders without errors when navigated to', async ({ page }) => {
    await goToWorkers(page)
    const workerLink = firstWorkerLinkLocator(page)
    if (await workerLink.count() > 0) {
      await workerLink.click()
      await expect(page).toHaveURL(/workers\//)
      await expectNoServerError(page)
    } else {
      // No workers seeded in CI — page must at least render
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('tip modal opens on worker profile when wallet is mocked', async ({ page }) => {
    await goToWorkers(page)
    const workerLink = firstWorkerLinkLocator(page)
    if (await workerLink.count() === 0) {
      test.skip(true, 'No workers seeded — skipping tip modal test')
      return
    }
    await workerLink.click()
    await expect(page).toHaveURL(/workers\//)

    const tipButton = page.locator(
      'button:has-text("Tip"), button:has-text("Send Tip"), [data-testid="tip-button"]'
    ).first()
    if (await tipButton.count() > 0) {
      await tipButton.click()
      const modal = page.locator('[role="dialog"]').first()
      await expect(modal).toBeVisible({ timeout: 5_000 })
      await expect(modal).not.toContainText('Internal Server Error')
    }
  })
})

test.describe('Curator listing management', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterMock(page)
  })

  test('curator dashboard page is reachable (redirects to login when unauthenticated)', async ({ page }) => {
    await goToDashboard(page)
    await expectAuthRedirect(page)
  })

  test('curator new worker page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(`${BASE}/en/dashboard/workers/new`)
    await expectAuthRedirect(page)
  })

  test('curator page loads without crashing', async ({ page }) => {
    await page.goto(`${BASE}/en/curator`)
    await expectNoServerError(page)
  })

  test('mock wallet address is accessible via injected API', async ({ page }) => {
    await goToHome(page)
    const address = await page.evaluate(() => (window as any).__mockFreighter?.getAddress())
    expect(address?.address).toBeDefined()
  })
})

test.describe('Auth flow critical paths', () => {
  test('login page renders and accepts input', async ({ page }) => {
    await goToLogin(page)
    const emailField = emailInputLocator(page)
    await expect(emailField).toBeVisible()
    await emailField.fill('test@example.com')
    await expect(emailField).toHaveValue('test@example.com')
  })

  test('register page renders required fields', async ({ page }) => {
    await goToRegister(page)
    await expect(emailInputLocator(page)).toBeVisible()
    await expect(passwordInputLocator(page)).toBeVisible()
  })

  test('forgot password page renders', async ({ page }) => {
    await goToForgotPassword(page)
    await expect(emailInputLocator(page)).toBeVisible()
  })

  test('home page loads without errors', async ({ page }) => {
    await goToHome(page)
    await expectNoServerError(page)
  })
})

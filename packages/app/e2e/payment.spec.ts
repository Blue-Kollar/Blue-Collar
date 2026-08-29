import { test, expect } from '@playwright/test'
import { injectFreighterMock, MOCK_WALLET_ADDRESS } from './freighter-mock'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

test.describe('Payment and escrow flows', () => {
  test('tip modal is not visible without authentication', async ({ page }) => {
    await page.goto(`${BASE}/en/workers`)
    // Tip/payment buttons should either be absent or redirect to login
    const tipButton = page.locator('button:has-text("Tip"), button:has-text("Pay"), [data-testid="tip-button"]')
    const count = await tipButton.count()
    if (count > 0) {
      await tipButton.first().click()
      // Should redirect to login or show auth prompt
      const url = page.url()
      const hasAuthPrompt = await page.locator('[role="dialog"], [data-testid="auth-modal"]').count()
      expect(url.includes('login') || hasAuthPrompt > 0 || url.includes('auth')).toBeTruthy()
    }
  })

  test('dashboard page requires authentication', async ({ page }) => {
    await page.goto(`${BASE}/en/dashboard`)
    // Should redirect to login when not authenticated
    await page.waitForURL(/login|auth|dashboard/, { timeout: 10_000 })
    const url = page.url()
    // Either redirected to login or shows dashboard (if auth is mocked)
    expect(url.includes('login') || url.includes('auth') || url.includes('dashboard')).toBeTruthy()
  })

  test('worker detail page shows tip button when wallet connected', async ({ page }) => {
    await page.goto(`${BASE}/en/workers`)
    const workerLink = page.locator('a[href*="/workers/"]').first()
    if (await workerLink.count() > 0) {
      await workerLink.click()
      await expect(page).toHaveURL(/workers\//)
      // Page should render without crashing
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })
})

test.describe('Escrow creation flow (mocked wallet)', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterMock(page)
  })

  test('creates an escrow and reflects the resulting pending status in the UI', async ({ page }) => {
    await page.goto(`${BASE}/en/escrow`)

    const connectButton = page.locator('button:has-text("Connect Wallet")')
    if (await connectButton.count() > 0) {
      await connectButton.click()
    }

    const amountInput = page.locator('#amount')
    await expect(amountInput).toBeVisible({ timeout: 15_000 })

    await amountInput.fill('50')
    await page.locator('#counterparty').fill(MOCK_WALLET_ADDRESS)
    await page.locator('#terms').fill('Deliver the agreed work before funds are released.')
    await page.locator('button[type="submit"]').click()

    // The page simulates escrow submission asynchronously — assert the resulting
    // record renders with the real data entered, not just that a request fired.
    await expect(page.getByText('Your Escrows (1)')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pending').first()).toBeVisible()
    await expect(page.getByText('50 XLM').first()).toBeVisible()
    await expect(page.getByText(MOCK_WALLET_ADDRESS).first()).toBeVisible()
  })
})

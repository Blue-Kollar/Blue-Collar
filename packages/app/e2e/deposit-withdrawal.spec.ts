/**
 * deposit-withdrawal.spec.ts — E2E test for the full deposit-to-withdrawal
 * (escrow) user journey (#1262).
 *
 * Journey map:
 *  1. Navigate to the escrow page (unauthenticated — should show connect prompt)
 *  2. Inject the Freighter mock and connect wallet
 *  3. Fill in the escrow / deposit form and submit
 *  4. Verify the pending escrow is displayed with the entered values
 *  5. Release the escrow (simulate withdrawal to payee)
 *  6. Verify the status transitions to "released"
 *  7. Navigate to wallet history page and verify the "Connect your wallet"
 *     prompt is no longer shown (wallet already connected via session)
 *
 * Additional paths:
 *  - Dispute path: escrow can transition to "disputed"
 *  - Wallet not connected: escrow page shows connect prompt
 *  - Transaction history page requires wallet (unauthenticated prompt)
 *
 * Uses the project's `injectFreighterMock` helper from e2e/freighter-mock.ts.
 */

import { test, expect, type Page } from '@playwright/test'
import { injectFreighterMock, MOCK_WALLET_ADDRESS } from './freighter-mock'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function gotoEscrow(page: Page, locale = 'en') {
  await page.goto(`${BASE}/${locale}/escrow`)
}

async function gotoWalletHistory(page: Page, locale = 'en') {
  await page.goto(`${BASE}/${locale}/wallet/history`)
}

async function connectWallet(page: Page) {
  const connectBtn = page.locator(
    'button:has-text("Connect Wallet"), button:has-text("Connect")',
  ).first()
  if (await connectBtn.isVisible({ timeout: 5_000 })) {
    await connectBtn.click()
  }
}

async function fillEscrowForm(
  page: Page,
  opts: { amount?: string; counterparty?: string; terms?: string } = {},
) {
  const amount      = opts.amount      ?? '50'
  const counterparty = opts.counterparty ?? MOCK_WALLET_ADDRESS
  const terms       = opts.terms       ?? 'Deliver the agreed work before funds are released.'

  await expect(page.locator('#amount')).toBeVisible({ timeout: 15_000 })
  await page.locator('#amount').fill(amount)
  await page.locator('#counterparty').fill(counterparty)
  await page.locator('#terms').fill(terms)
  await page.locator('button[type="submit"]').click()
}

// ─────────────────────────────────────────────────────────────────────────────
// Unauthenticated state
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Deposit-to-Withdrawal: unauthenticated state', () => {
  test('escrow page shows connect-wallet prompt without a wallet', async ({ page }) => {
    await gotoEscrow(page)

    // Should NOT render the escrow form — show connect prompt instead
    const connectPrompt = page.locator(
      'button:has-text("Connect Wallet"), button:has-text("Connect")',
    )
    await expect(connectPrompt.first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('#amount')).not.toBeVisible()
  })

  test('wallet history page shows connect-wallet prompt without a wallet', async ({ page }) => {
    await gotoWalletHistory(page)

    await expect(
      page.locator('h2:has-text("Connect your wallet"), h1:has-text("Connect"), button:has-text("Connect Wallet")')
        .first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Happy-path: deposit → pending → release (withdrawal)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Deposit-to-Withdrawal: full happy-path journey', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterMock(page)
  })

  test('step 1 — wallet connect reveals the deposit (escrow) form', async ({ page }) => {
    await gotoEscrow(page)
    await connectWallet(page)

    // After connecting, the escrow form should be visible
    await expect(page.locator('#amount')).toBeVisible({ timeout: 15_000 })
  })

  test('step 2 — filling the form and submitting creates a pending escrow', async ({ page }) => {
    await gotoEscrow(page)
    await connectWallet(page)
    await fillEscrowForm(page, { amount: '75' })

    // A new escrow row should appear in "Your Escrows"
    await expect(page.getByText('Your Escrows (1)')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pending').first()).toBeVisible()
    await expect(page.getByText('75 XLM').first()).toBeVisible()
  })

  test('step 3 — counterparty address is shown in the escrow record', async ({ page }) => {
    await gotoEscrow(page)
    await connectWallet(page)
    await fillEscrowForm(page, { amount: '25', counterparty: MOCK_WALLET_ADDRESS })

    await expect(page.getByText('Your Escrows (1)')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(MOCK_WALLET_ADDRESS).first()).toBeVisible()
  })

  test('step 4 — releasing the escrow transitions it to released (withdrawal)', async ({ page }) => {
    await gotoEscrow(page)
    await connectWallet(page)
    await fillEscrowForm(page, { amount: '100' })

    await expect(page.getByText('Your Escrows (1)')).toBeVisible({ timeout: 10_000 })

    // Click the Release button on the first escrow
    const releaseBtn = page.locator('button:has-text("Release")').first()
    await expect(releaseBtn).toBeVisible({ timeout: 5_000 })
    await releaseBtn.click()

    // Status should transition from Pending → Released
    await expect(page.getByText('Released').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Pending')).not.toBeVisible()
  })

  test('step 5 — multiple escrows can be created and have independent statuses', async ({ page }) => {
    await gotoEscrow(page)
    await connectWallet(page)

    // Create first escrow
    await fillEscrowForm(page, { amount: '10' })
    await expect(page.getByText('Your Escrows (1)')).toBeVisible({ timeout: 10_000 })

    // Create second escrow (form should still be accessible)
    await fillEscrowForm(page, { amount: '20' })
    await expect(page.getByText('Your Escrows (2)')).toBeVisible({ timeout: 10_000 })

    // Both should show as pending
    const pendingItems = page.getByText('Pending')
    await expect(pendingItems).toHaveCount(2, { timeout: 5_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Dispute path
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Deposit-to-Withdrawal: dispute path', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterMock(page)
  })

  test('disputing an escrow transitions its status to disputed', async ({ page }) => {
    await gotoEscrow(page)
    await connectWallet(page)
    await fillEscrowForm(page, { amount: '50' })

    await expect(page.getByText('Your Escrows (1)')).toBeVisible({ timeout: 10_000 })

    const disputeBtn = page.locator('button:has-text("Dispute")').first()
    await expect(disputeBtn).toBeVisible({ timeout: 5_000 })
    await disputeBtn.click()

    await expect(page.getByText('Disputed').first()).toBeVisible({ timeout: 5_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Wallet history post-connect
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Deposit-to-Withdrawal: wallet history', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterMock(page)
  })

  test('wallet history page renders a transaction list or empty state when wallet connected', async ({ page }) => {
    await gotoWalletHistory(page)
    await connectWallet(page)

    // After connecting, the "Connect your wallet" prompt should no longer show
    // and we should see either a transaction table or an empty-state message
    await expect(
      page.locator('h2:has-text("Connect your wallet")'),
    ).not.toBeVisible({ timeout: 10_000 })

    // Page should render without crashing
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('h1:has-text("Transaction History")')).toBeVisible({ timeout: 10_000 })
  })

  test('navigating from escrow to wallet history maintains wallet session', async ({ page }) => {
    // Connect via escrow page
    await gotoEscrow(page)
    await connectWallet(page)

    // Navigate to wallet history — session should persist through localStorage
    await gotoWalletHistory(page)

    // Should not show the connect prompt since session is stored
    await expect(page.locator('h1:has-text("Transaction History")')).toBeVisible({ timeout: 15_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Form validation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Deposit-to-Withdrawal: form validation', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterMock(page)
  })

  test('submit button is present and enabled when form is visible', async ({ page }) => {
    await gotoEscrow(page)
    await connectWallet(page)

    await expect(page.locator('#amount')).toBeVisible({ timeout: 15_000 })
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeVisible()
  })

  test('page does not crash when terms field is left empty', async ({ page }) => {
    await gotoEscrow(page)
    await connectWallet(page)

    await expect(page.locator('#amount')).toBeVisible({ timeout: 15_000 })
    await page.locator('#amount').fill('10')
    await page.locator('#counterparty').fill(MOCK_WALLET_ADDRESS)
    // Intentionally omit #terms
    await page.locator('button[type="submit"]').click()

    // Page should remain stable (not crash)
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})

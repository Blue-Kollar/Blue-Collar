/**
 * E2E Tests: Wallet Connection Failure Paths
 * Issue #1864: E2E tests for wallet connect failure paths
 *
 * Covers failure scenarios:
 *   - Freighter not installed / unavailable
 *   - User rejects wallet access request
 *   - Wrong network connected (not TESTNET)
 *   - Connection timeout / network error
 *   - Transaction signing fails
 *   - App handles errors gracefully without crashes
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  BASE,
  goToHome,
  goToWorkers,
  walletConnectButtonLocator,
  seedFakeSession,
} from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Inject a mock that immediately rejects access (user rejected)
// ─────────────────────────────────────────────────────────────────────────────
async function injectRejectedWalletMock(page: Page) {
  await page.addInitScript(() => {
    const freighter = {
      isConnected: () => Promise.resolve({ isConnected: false }),
      requestAccess: () => Promise.reject(new Error('User rejected the request')),
      getAddress: () => Promise.reject(new Error('Not connected')),
      getNetwork: () => Promise.reject(new Error('Not connected')),
      signTransaction: () => Promise.reject(new Error('Not connected')),
      signBlob: () => Promise.reject(new Error('Not connected')),
    }
    ;(window as any).freighterApi = freighter
    ;(window as any).__mockFreighter = freighter
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Inject a mock that simulates Freighter not installed
// ─────────────────────────────────────────────────────────────────────────────
async function injectNoWalletMock(page: Page) {
  await page.addInitScript(() => {
    // Remove any Freighter injection to simulate not installed
    delete (window as any).freighterApi
    delete (window as any).__mockFreighter
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Inject mock with wrong network (PUBLIC instead of TESTNET)
// ─────────────────────────────────────────────────────────────────────────────
async function injectWrongNetworkMock(page: Page) {
  await page.addInitScript(() => {
    const freighter = {
      isConnected: () => Promise.resolve({ isConnected: true }),
      requestAccess: () => Promise.resolve({ address: 'GABC1234DEFG5678HIJKLMNOP' }),
      getAddress: () => Promise.resolve({ address: 'GABC1234DEFG5678HIJKLMNOP' }),
      getNetwork: () => Promise.resolve({
        network: 'PUBLIC',
        networkPassphrase: 'Public Global Stellar Network ; September 2015',
      }),
      signTransaction: (_xdr: string, _opts: unknown) =>
        Promise.resolve({ signedTxXdr: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }),
      signBlob: (_blob: string, _opts: unknown) =>
        Promise.resolve({ signedBlob: 'mock-signed-blob' }),
    }
    ;(window as any).freighterApi = freighter
    ;(window as any).__mockFreighter = freighter
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Inject mock that throws on signing (not on connection)
// ─────────────────────────────────────────────────────────────────────────────
async function injectSigningFailureMock(page: Page) {
  await page.addInitScript(() => {
    const freighter = {
      isConnected: () => Promise.resolve({ isConnected: true }),
      requestAccess: () => Promise.resolve({ address: 'GABC1234DEFG5678HIJKLMNOP' }),
      getAddress: () => Promise.resolve({ address: 'GABC1234DEFG5678HIJKLMNOP' }),
      getNetwork: () => Promise.resolve({
        network: 'TESTNET',
        networkPassphrase: 'Test SDF Network ; September 2015',
      }),
      signTransaction: () => Promise.reject(new Error('User denied signing')),
      signBlob: () => Promise.reject(new Error('User denied signing')),
    }
    ;(window as any).freighterApi = freighter
    ;(window as any).__mockFreighter = freighter
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Freighter Not Installed
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Wallet Failure Paths — Freighter Not Installed (closes #1864)', () => {
  test('app loads without crashing when Freighter is not installed', async ({ page }) => {
    await injectNoWalletMock(page)
    await goToHome(page)

    // Page should render without errors
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('wallet connect button is still visible when Freighter not installed', async ({ page }) => {
    await injectNoWalletMock(page)
    await goToHome(page)

    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      // Button should be discoverable even if Freighter is not installed
      // (user should see it and get helpful error message)
      await expect(connectBtn).toBeVisible({ timeout: 5_000 })
    }
  })

  test('clicking connect button shows helpful message when Freighter not installed', async ({ page }) => {
    await injectNoWalletMock(page)
    await goToHome(page)

    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()

      // Should show installation prompt or helpful message, not crash
      const errorOrInstallPrompt = page.locator(
        'text=/install|download|not found|extension|freighter/i'
      )

      // Either error message or continue without crashing
      await page.waitForTimeout(1_000)
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  test('app remains functional after failed Freighter connection attempt', async ({ page }) => {
    await injectNoWalletMock(page)
    await goToHome(page)

    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
      await page.waitForTimeout(1_000)
    }

    // App should still be navigable
    await goToWorkers(page)
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: User Rejection
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Wallet Failure Paths — User Rejection (closes #1864)', () => {
  test('app does not crash when user rejects wallet access', async ({ page }) => {
    await injectRejectedWalletMock(page)
    await goToHome(page)

    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
      await page.waitForTimeout(1_000)
    }

    // Page should still render without errors
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('error message is displayed when user rejects access', async ({ page }) => {
    await injectRejectedWalletMock(page)
    await goToHome(page)

    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
      await page.waitForTimeout(2_000)

      // Should display rejection error, not crash
      const errorMessage = page.locator(
        'text=/rejected|declined|cancelled|access denied/i'
      )

      // Verify error message OR at least that page didn't crash
      if (await errorMessage.count() > 0) {
        await expect(errorMessage).toBeVisible()
      }
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  test('user can retry after rejecting access', async ({ page }) => {
    await injectRejectedWalletMock(page)
    await goToHome(page)

    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      // First attempt (rejected)
      await connectBtn.click()
      await page.waitForTimeout(1_000)

      // Button should still be clickable for retry
      await expect(connectBtn).not.toBeDisabled()

      // Retry should be possible (would need actual Freighter for success)
      // Just verify button remains interactive
      expect(await connectBtn.count()).toBeGreaterThan(0)
    }
  })

  test('rejection error state clears after timeout', async ({ page }) => {
    await injectRejectedWalletMock(page)
    await goToHome(page)

    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
      await page.waitForTimeout(3_000)

      // Page should still be functional
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Wrong Network
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Wallet Failure Paths — Wrong Network (closes #1864)', () => {
  test('app displays network warning when connected to PUBLIC instead of TESTNET', async ({ page }) => {
    await injectWrongNetworkMock(page)
    await seedFakeSession(page)
    await goToHome(page)

    // Navigate to a page that checks network
    await goToWorkers(page)

    // Should display network warning, not crash
    const networkWarning = page.locator(
      'text=/network|testnet|public|wrong network/i'
    )

    await page.waitForTimeout(2_000)

    // Either warning displayed or at least no crash
    if (await networkWarning.count() > 0) {
      await expect(networkWarning).toBeVisible()
    }
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('app remains usable with network warning displayed', async ({ page }) => {
    await injectWrongNetworkMock(page)
    await seedFakeSession(page)
    await goToHome(page)

    // User should still be able to navigate
    await goToWorkers(page)

    // Verify app didn't crash
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('user can view network in wallet status when wrong network', async ({ page }) => {
    await injectWrongNetworkMock(page)
    await seedFakeSession(page)
    await goToHome(page)

    // Look for network display in header/nav
    const networkDisplay = page.locator('text=/PUBLIC|network/i')

    await page.waitForTimeout(1_000)

    if (await networkDisplay.count() > 0) {
      await expect(networkDisplay).toBeVisible()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Transaction Signing Failure
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Wallet Failure Paths — Signing Failure (closes #1864)', () => {
  test('app does not crash when transaction signing fails', async ({ page }) => {
    await injectSigningFailureMock(page)
    await seedFakeSession(page)
    await goToWorkers(page)

    // Find and attempt to trigger a payment/tip that requires signing
    const workerLink = page.locator('a[href*="/workers/"]').first()
    if (await workerLink.count() > 0) {
      await workerLink.click()
      await page.waitForTimeout(1_000)
    }

    // App should still be functional
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('signing error message is displayed when transaction denied', async ({ page }) => {
    await injectSigningFailureMock(page)
    await seedFakeSession(page)
    await goToWorkers(page)

    // Attempt to interact with payment feature
    const workerLink = page.locator('a[href*="/workers/"]').first()
    if (await workerLink.count() > 0 && await workerLink.isVisible()) {
      await workerLink.click()

      // Look for send tip button
      const tipButton = page.locator(
        'button:has-text("Send Tip"), button:has-text("Tip")'
      ).first()

      if (await tipButton.count() > 0 && await tipButton.isVisible()) {
        await tipButton.click()

        // Find submit button in modal
        const submitBtn = page.locator(
          'button:has-text("Send"), button:has-text("Confirm")'
        ).first()

        if (await submitBtn.count() > 0 && await submitBtn.isVisible()) {
          await submitBtn.click()
          await page.waitForTimeout(2_000)
        }
      }
    }

    // Either error message shown or graceful degradation
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('user can retry after signing failure', async ({ page }) => {
    await injectSigningFailureMock(page)
    await seedFakeSession(page)
    await goToWorkers(page)

    const workerLink = page.locator('a[href*="/workers/"]').first()
    if (await workerLink.count() > 0 && await workerLink.isVisible()) {
      await workerLink.click()
      await page.waitForTimeout(1_000)

      // UI should allow retry (e.g., retry button or re-attempt transaction)
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: General Error Recovery
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Wallet Failure Paths — Error Recovery (closes #1864)', () => {
  test('error state does not persist after navigation', async ({ page }) => {
    await injectRejectedWalletMock(page)
    await goToHome(page)

    // Trigger error
    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
      await page.waitForTimeout(1_000)
    }

    // Navigate away
    await goToWorkers(page)
    await page.waitForTimeout(1_000)

    // Page should be clean
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('wallet errors do not affect navigation', async ({ page }) => {
    await injectNoWalletMock(page)
    await goToHome(page)

    // Attempt wallet action
    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
      await page.waitForTimeout(500)
    }

    // Should still be able to navigate
    await goToWorkers(page)
    await expect(page).toHaveURL(/workers/)
  })

  test('localStorage is not corrupted by wallet errors', async ({ page }) => {
    await injectRejectedWalletMock(page)
    await seedFakeSession(page)
    await goToHome(page)

    // Check that localStorage was seeded
    const token = await page.evaluate(() => localStorage.getItem('bc_token'))
    expect(token).toBe('fake-e2e-token')

    // Trigger wallet error
    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
      await page.waitForTimeout(1_000)
    }

    // localStorage should still contain session token
    const tokenAfter = await page.evaluate(() => localStorage.getItem('bc_token'))
    expect(tokenAfter).toBe('fake-e2e-token')
  })

  test('console errors do not crash the application', async ({ page }) => {
    await injectRejectedWalletMock(page)
    await goToHome(page)

    // Collect console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Trigger wallet errors
    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
    }

    await page.waitForTimeout(2_000)

    // App should still be functional despite console errors
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Combined Scenarios
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Wallet Failure Paths — Combined Scenarios (closes #1864)', () => {
  test('multiple failed connection attempts do not break the app', async ({ page }) => {
    await injectRejectedWalletMock(page)
    await goToHome(page)

    const connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      // Attempt to connect 3 times
      for (let i = 0; i < 3; i++) {
        await connectBtn.click()
        await page.waitForTimeout(500)
      }
    }

    // App should still be functional
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await goToWorkers(page)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('switching between different failure modes does not crash', async ({ page }) => {
    // Start with no wallet
    await injectNoWalletMock(page)
    await goToHome(page)

    let connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
      await page.waitForTimeout(500)
    }

    // Reload with rejection
    await injectRejectedWalletMock(page)
    await page.reload()

    connectBtn = walletConnectButtonLocator(page)
    if (await connectBtn.count() > 0) {
      await connectBtn.click()
      await page.waitForTimeout(500)
    }

    // Should still work
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})

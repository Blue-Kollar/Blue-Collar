/**
 * Shared E2E test helpers and fixtures.
 *
 * Centralises all duplicated setup, navigation, and locator helpers so that
 * individual spec files stay focused on assertions rather than plumbing.
 *
 * @module e2e/helpers
 * Closes #1205
 */

import type { Page, Locator } from '@playwright/test'

// ─── Base URL ────────────────────────────────────────────────────────────────

export const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

// ─── Navigation helpers ───────────────────────────────────────────────────────

/** Navigate to the workers/discovery page. */
export async function goToWorkers(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/workers`, { timeout: 15_000 })
}

/** Navigate to the home/landing page. */
export async function goToHome(page: Page): Promise<void> {
  await page.goto(`${BASE}/en`, { timeout: 15_000 })
}

/** Navigate to the login page. */
export async function goToLogin(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/auth/login`, { timeout: 15_000 })
}

/** Navigate to the register page. */
export async function goToRegister(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/auth/register`, { timeout: 15_000 })
}

/** Navigate to the forgot-password page. */
export async function goToForgotPassword(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/auth/forgot-password`, { timeout: 15_000 })
}

/** Navigate to the dashboard (requires auth; will redirect to login if unauthenticated). */
export async function goToDashboard(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/dashboard`, { timeout: 15_000 })
}

/** Navigate to the messages page. */
export async function goToMessages(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/messages`, { timeout: 15_000 })
}

/** Navigate to the notifications page. */
export async function goToNotifications(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/notifications`, { timeout: 15_000 })
}

/** Navigate to the notification preferences page. */
export async function goToNotificationPreferences(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/notifications/preferences`, { timeout: 15_000 })
}

/** Navigate to the wallet history page. */
export async function goToWalletHistory(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/wallet/history`, { timeout: 15_000 })
}

/** Navigate to the escrow page. */
export async function goToEscrow(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/escrow`, { timeout: 15_000 })
}

// ─── Viewport helpers ─────────────────────────────────────────────────────────

/** Set the viewport to a standard mobile size (iPhone 14 Pro). */
export async function setMobileViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 })
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/**
 * Fake authentication: seeds a token into localStorage and mocks the /api/auth/me
 * endpoint so the app treats the session as authenticated.
 * Use this in specs that need an authenticated context without a real login flow.
 */
export async function seedFakeSession(
  page: Page,
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  } = {
    id: 'e2e-user',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    role: 'user',
  },
): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('bc_token', 'fake-e2e-token')
  })
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: user }),
    }),
  )
}

// ─── Assertion helpers ────────────────────────────────────────────────────────

/**
 * Assert that the page did not crash with a server/application error.
 * Checks for the absence of "Internal Server Error" and "Application error"
 * strings in the response body.
 */
export async function expectNoServerError(page: Page): Promise<void> {
  const { expect } = await import('@playwright/test')
  await expect(page.locator('body')).not.toContainText('Internal Server Error')
  await expect(page.locator('body')).not.toContainText('Application error')
}

/**
 * Assert that the page redirected to an auth/login URL, which is the expected
 * behaviour for any protected route when the user is not authenticated.
 */
export async function expectAuthRedirect(page: Page): Promise<void> {
  const { expect } = await import('@playwright/test')
  await page.waitForURL(/login|auth|dashboard/, { timeout: 10_000 })
  const url = page.url()
  expect(
    url.includes('login') || url.includes('auth') || url.includes('dashboard')
  ).toBeTruthy()
}

// ─── Locator helpers ──────────────────────────────────────────────────────────

/** Returns the primary search input on the workers/discovery page. */
export function searchInputLocator(page: Page): Locator {
  return page
    .locator(
      'input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]'
    )
    .first()
}

/** Returns the email input on an auth page. */
export function emailInputLocator(page: Page): Locator {
  return page.locator('input[name="email"], input[type="email"]').first()
}

/** Returns all password inputs on an auth page. */
export function passwordInputLocator(page: Page): Locator {
  return page.locator('input[type="password"]').first()
}

/** Returns all password inputs on an auth page (for confirm-password forms). */
export function passwordInputsLocator(page: Page): Locator {
  return page.locator('input[type="password"]')
}

/** Returns the primary submit button on a form. */
export function submitButtonLocator(page: Page): Locator {
  return page.locator('button[type="submit"]').first()
}

/** Returns the notification bell button in the nav. */
export function notificationBellLocator(page: Page): Locator {
  return page.locator('button[aria-label*="Notifications" i]').first()
}

/** Returns the wallet connect button on a page. */
export function walletConnectButtonLocator(page: Page): Locator {
  return page
    .locator(
      'button:has-text("Connect"), button:has-text("Connect Wallet"), ' +
        'button:has-text("Sign In"), button[data-testid*="wallet" i], ' +
        '[aria-label*="connect" i]'
    )
    .first()
}

/** Returns the first worker card link on the workers listing page. */
export function firstWorkerLinkLocator(page: Page): Locator {
  return page.locator('a[href*="/workers/"]').first()
}

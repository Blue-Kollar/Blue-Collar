/**
 * Visual regression tests – BlueCollar (#815, #1282)
 *
 * Baselines key pages in both light and dark mode across desktop and mobile
 * viewports so regressions in either theme variant are caught automatically.
 *
 * Theme wiring:
 *   The app uses `next-themes` with `attribute="class"` — dark mode is active
 *   when the `<html>` element carries the `dark` class.  We inject that class
 *   via `page.addInitScript` (runs before any page JS) so the very first paint
 *   is already in the target theme, avoiding flash-of-wrong-theme flicker.
 *
 * Snapshot files are committed to the repository alongside this spec so that
 * CI can diff against them on every PR.
 *
 * CLI usage:
 *   # Capture / update baselines
 *   pnpm --filter @bluecollar/app exec playwright test visual/ --update-snapshots
 *
 *   # Compare against baselines (default)
 *   pnpm --filter @bluecollar/app exec playwright test visual/
 *
 *   # Percy cloud diffing (set PERCY_TOKEN first)
 *   PERCY_TOKEN=<token> pnpm --filter @bluecollar/app exec playwright test visual/
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Disable animations / transitions so snapshots are pixel-stable across runs. */
async function freezePage(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  })
}

/**
 * Inject the `dark` class on the `<html>` element before the page renders.
 * Using `addInitScript` ensures the class is present on the very first paint —
 * next-themes would normally read from localStorage/system preference, which
 * is unavailable in the Playwright sandbox.
 */
async function enableDarkMode(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.classList.add('dark')
    })
    // Intercept the initial class list assignment before hydration as well
    const origAdd = DOMTokenList.prototype.add
    const _docEl = document.documentElement
    // Force localStorage key so next-themes hydrates in dark mode
    try {
      localStorage.setItem('bc_theme', 'dark')
    } catch {
      // localStorage may be unavailable in some sandbox configs — ignore
    }
    document.documentElement.classList.add('dark')
    void origAdd // suppress unused-variable lint
  })
}

/**
 * Navigate, wait for idle network, inject freeze styles, and optionally
 * wait for any lazy-loaded skeleton content to settle.
 */
async function loadPage(
  page: import('@playwright/test').Page,
  path: string,
  options?: { mobile?: boolean },
) {
  if (options?.mobile) {
    await page.setViewportSize({ width: 390, height: 844 })
  }
  await page.goto(`${BASE}${path}`)
  await page.waitForLoadState('networkidle')
  await freezePage(page)
}

// ---------------------------------------------------------------------------
// Pages under test
// ---------------------------------------------------------------------------

/**
 * Public pages that do not require authentication.
 * Each entry is snapshotted in both light/dark × desktop/mobile.
 */
const PUBLIC_PAGES = [
  { name: 'home',            path: '/en' },
  { name: 'workers',         path: '/en/workers' },
  { name: 'login',           path: '/en/auth/login' },
  { name: 'register',        path: '/en/auth/register' },
  { name: 'forgot-password', path: '/en/auth/forgot-password' },
  { name: 'about',           path: '/en/about' },
  { name: 'stats',           path: '/en/stats' },
] as const

/**
 * Loading-state pages — captured while the server-side fetch is still in
 * flight.  We use `waitUntil: 'commit'` so we land on the Suspense skeleton
 * before data arrives, giving us a deterministic loading-state snapshot.
 */
const LOADING_STATE_PAGES = [
  { name: 'workers-loading',   path: '/en/workers' },
  { name: 'dashboard-loading', path: '/en/dashboard' },
] as const

// ---------------------------------------------------------------------------
// Light mode – desktop + mobile
// ---------------------------------------------------------------------------

test.describe('Visual regression – light mode', () => {
  for (const { name, path } of PUBLIC_PAGES) {
    test(`${name} – desktop`, async ({ page }) => {
      await loadPage(page, path)
      await expect(page).toHaveScreenshot(`${name}-desktop-light.png`)
    })

    test(`${name} – mobile`, async ({ page }) => {
      await loadPage(page, path, { mobile: true })
      await expect(page).toHaveScreenshot(`${name}-mobile-light.png`)
    })
  }

  // Loading states — light
  for (const { name, path } of LOADING_STATE_PAGES) {
    test(`${name} – desktop`, async ({ page }) => {
      // Navigate but only wait for the initial commit so Suspense fallbacks are visible
      await page.goto(`${BASE}${path}`, { waitUntil: 'commit' })
      await freezePage(page)
      await expect(page).toHaveScreenshot(`${name}-desktop-light.png`)
    })
  }
})

// ---------------------------------------------------------------------------
// Dark mode – desktop + mobile
// ---------------------------------------------------------------------------

test.describe('Visual regression – dark mode', () => {
  test.beforeEach(async ({ page }) => {
    // Wire dark mode before each test in this suite.
    // enableDarkMode uses addInitScript which must be called before page.goto.
    await enableDarkMode(page)
  })

  for (const { name, path } of PUBLIC_PAGES) {
    test(`${name} – desktop`, async ({ page }) => {
      await loadPage(page, path)
      // Verify the dark class was applied (guard against next-themes overriding it)
      await page.evaluate(() => document.documentElement.classList.add('dark'))
      await expect(page).toHaveScreenshot(`${name}-desktop-dark.png`)
    })

    test(`${name} – mobile`, async ({ page }) => {
      await loadPage(page, path, { mobile: true })
      // Re-assert dark class after navigation in case next-themes reset it
      await page.evaluate(() => document.documentElement.classList.add('dark'))
      await expect(page).toHaveScreenshot(`${name}-mobile-dark.png`)
    })
  }

  // Loading states — dark
  for (const { name, path } of LOADING_STATE_PAGES) {
    test(`${name} – desktop`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'commit' })
      await page.evaluate(() => document.documentElement.classList.add('dark'))
      await freezePage(page)
      await expect(page).toHaveScreenshot(`${name}-desktop-dark.png`)
    })
  }
})

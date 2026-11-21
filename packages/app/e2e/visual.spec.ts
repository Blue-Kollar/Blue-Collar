import { test, expect, type Page } from '@playwright/test'
import percySnapshot from '@percy/playwright'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

/**
 * Visual regression tests using Playwright's built-in screenshot comparison
 * plus optional Percy uploads when `PERCY_TOKEN` is available.
 *
 * Snapshots are made deterministic by:
 *  - disabling animations/transitions and the text caret,
 *  - waiting for webfonts and all images to finish loading,
 *  - pinning locale/timezone/colour-scheme in playwright.config.ts,
 *  - using fixed Percy widths instead of the device's DPR-scaled width,
 *  - running the visual suite serially to avoid resource contention.
 *
 * Local: Run `pnpm test:e2e --update-snapshots` to update baseline screenshots.
 */
test.describe.configure({ mode: 'serial' })

// Fixed clock for deterministic timestamps in visual snapshots
test.use({
  clock: { install: true, time: new Date('2024-01-01T00:00:00Z') },
})

const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  html { scroll-behavior: auto !important; }
`

const SCREENSHOT_OPTIONS = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  scale: 'css' as const,
}

async function prepare(page: Page) {
  await page.addStyleTag({ content: FREEZE_CSS })
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map((img) => new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        })),
    )
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle')
}

function percyOptions(width: number) {
  return {
    widths: [width],
    percyCSS: FREEZE_CSS,
    minHeight: 1024,
  }
}

test.describe('Visual regression', () => {
  test('home page matches snapshot (desktop)', async ({ page }) => {
    await page.goto(`${BASE}/en`)
    await prepare(page)

    await expect(page).toHaveScreenshot('home.desktop.png', SCREENSHOT_OPTIONS)

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Home Page - Desktop', percyOptions(1280))
    }
  })

  test('home page matches snapshot (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/en`)
    await prepare(page)

    await expect(page).toHaveScreenshot('home.mobile.png', SCREENSHOT_OPTIONS)

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Home Page - Mobile', percyOptions(390))
    }
  })

  test('workers listing page matches snapshot', async ({ page }) => {
    await page.goto(`${BASE}/en/workers`)
    await prepare(page)

    await expect(page).toHaveScreenshot('workers-list.png', SCREENSHOT_OPTIONS)

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Workers Listing', percyOptions(1280))
    }
  })

  test('worker profile page matches snapshot', async ({ page }) => {
    await page.goto(`${BASE}/en/workers/test-worker-1`)
    await prepare(page)

    await expect(page).toHaveScreenshot('worker-profile.png', SCREENSHOT_OPTIONS)

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Worker Profile', percyOptions(1280))
    }
  })

  test('auth pages match snapshots', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/login`)
    await prepare(page)
    await expect(page).toHaveScreenshot('login.png', SCREENSHOT_OPTIONS)

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Login Page', percyOptions(1280))
    }

    await page.goto(`${BASE}/en/auth/register`)
    await prepare(page)
    await expect(page).toHaveScreenshot('register.png', SCREENSHOT_OPTIONS)

    if (process.env.PERCY_TOKEN) {
      await percySnapshot(page, 'Register Page', percyOptions(1280))
    }
  })
})

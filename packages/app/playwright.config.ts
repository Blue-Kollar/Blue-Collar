import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    headless: true,
    // Pin rendering inputs so screenshots are reproducible across machines.
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    // sensible defaults for visual comparisons
    screenshotOptions: { fullPage: true },
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /visual\.spec\.ts/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /visual\.spec\.ts/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /visual\.spec\.ts/ },
    // Mobile viewports
    { name: 'Mobile Chrome (Pixel 5)', use: { ...devices['Pixel 5'] }, testIgnore: /visual\.spec\.ts/ },
    { name: 'Mobile Safari (iPhone 12)', use: { ...devices['iPhone 12'] }, testIgnore: /visual\.spec\.ts/ },
    // Visual snapshots run once on a pinned Chromium configuration instead of
    // once per browser/device, which caused cross-project snapshot drift.
    { name: 'visual', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  // helpful when running locally: start the dev server unless CI provides one
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3001',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})

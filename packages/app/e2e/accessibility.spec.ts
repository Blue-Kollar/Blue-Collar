/**
 * Full-page accessibility tests using @axe-core/playwright.
 * Scans rendered pages for WCAG 2.1 AA violations.
 * Generates accessibility report as CI artifact.
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'fs'
import path from 'path'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

const PAGES = [
  { name: 'Home', path: '/en' },
  { name: 'Workers listing', path: '/en/workers' },
  { name: 'Login', path: '/en/auth/login' },
  { name: 'Register', path: '/en/auth/register' },
  { name: 'Forgot password', path: '/en/auth/forgot-password' },
]

const a11yReports: Array<{
  page: string
  path: string
  violations: number
  passes: number
  timestamp: string
}> = []

for (const { name, path: pagePath } of PAGES) {
  test(`${name} page has no critical WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(`${BASE}${pagePath}`)
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    // Filter to critical and serious violations only (skip minor/moderate in CI)
    const critical = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact ?? ''),
    )

    a11yReports.push({
      page: name,
      path: pagePath,
      violations: critical.length,
      passes: results.passes.length,
      timestamp: new Date().toISOString(),
    })

    if (critical.length > 0) {
      const summary = critical
        .map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.description}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`,
        )
        .join('\n\n')
      throw new Error(`Accessibility violations on "${name}":\n\n${summary}`)
    }

    expect(critical).toHaveLength(0)
  })
}

test.afterAll(async () => {
  const reportDir = path.join(process.cwd(), 'a11y-reports')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  const reportPath = path.join(reportDir, `a11y-report-${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(a11yReports, null, 2))
})

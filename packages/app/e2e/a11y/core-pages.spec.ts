/**
 * Accessibility tests – BlueCollar (#814)
 *
 * Uses @axe-core/playwright to assert zero critical/serious WCAG 2.1 AA
 * violations on all core pages. Generates a JSON report as a CI artifact.
 *
 * Run:
 *   pnpm --filter @bluecollar/app exec playwright test e2e/a11y/
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'fs'
import path from 'path'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

/** Core pages that must have zero critical/serious violations. */
const PAGES = [
  { name: 'Home',            path: '/en' },
  { name: 'Workers listing', path: '/en/workers' },
  { name: 'Login',           path: '/en/auth/login' },
  { name: 'Register',        path: '/en/auth/register' },
  { name: 'Forgot password', path: '/en/auth/forgot-password' },
]

type Report = {
  page: string
  path: string
  violations: number
  critical: number
  serious: number
  passes: number
  timestamp: string
}
const report: Report[] = []

for (const { name, path: pagePath } of PAGES) {
  test(`${name} – no critical/serious WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(`${BASE}${pagePath}`)
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter((v) => v.impact === 'critical')
    const serious  = results.violations.filter((v) => v.impact === 'serious')
    const blocking = [...critical, ...serious]

    report.push({
      page:      name,
      path:      pagePath,
      violations: results.violations.length,
      critical:  critical.length,
      serious:   serious.length,
      passes:    results.passes.length,
      timestamp: new Date().toISOString(),
    })

    if (blocking.length > 0) {
      const summary = blocking
        .map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.description}\n  Nodes: ${v.nodes
              .slice(0, 3)
              .map((n) => n.html)
              .join('\n  ')}`,
        )
        .join('\n\n')
      throw new Error(`Accessibility violations on "${name}" (${pagePath}):\n\n${summary}`)
    }

    expect(blocking).toHaveLength(0)
  })
}

test.afterAll(async () => {
  const dir = path.join(process.cwd(), 'a11y-reports')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `a11y-${Date.now()}.json`),
    JSON.stringify(report, null, 2),
  )
})

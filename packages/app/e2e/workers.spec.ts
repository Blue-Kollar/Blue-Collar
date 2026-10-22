import { test, expect } from '@playwright/test'
import {
  goToWorkers,
  goToHome,
  searchInputLocator,
  firstWorkerLinkLocator,
  expectNoServerError,
} from './helpers'

test.describe('Worker search and discovery', () => {
  test('workers listing page loads', async ({ page }) => {
    await goToWorkers(page)
    await expect(page).toHaveURL(/workers/)
    await expectNoServerError(page)
  })

  test('workers page has search or filter UI', async ({ page }) => {
    await goToWorkers(page)
    const searchOrFilter = page.locator(
      'input[type="search"], input[placeholder*="search" i], select, [role="combobox"]'
    )
    await expect(searchOrFilter.first()).toBeVisible({ timeout: 10_000 })
  })

  test('worker detail page loads for a valid id pattern', async ({ page }) => {
    await goToWorkers(page)
    const workerLink = firstWorkerLinkLocator(page)
    const count = await workerLink.count()
    if (count > 0) {
      await workerLink.click()
      await expect(page).toHaveURL(/workers\//)
      await expectNoServerError(page)
    } else {
      // No workers seeded — just verify the page renders without crashing
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('home page renders without errors', async ({ page }) => {
    await goToHome(page)
    await expectNoServerError(page)
  })

  test('dashboard segment error shows a retry fallback and navigation still works', async ({ page }) => {
    const errorLogs: string[] = []
    page.on('console', message => errorLogs.push(message.text()))

    await goToWorkers(page)
    await page.goto(new URL('/en/dashboard/e2e-error-test', page.url()).toString())

    await expect(page.getByRole('heading', { name: "Couldn't load dashboard" })).toBeVisible()
    await expect(page.getByTestId('route-error-retry')).toBeVisible()
    await expect.poll(() => errorLogs.some(message =>
      message.includes('[App Router error]') && message.includes('dashboard')
    )).toBe(true)

    await page.goBack()
    await expect(page).toHaveURL(/\/en\/workers/)
    await expect(page.locator('body')).toBeVisible()
  })
})

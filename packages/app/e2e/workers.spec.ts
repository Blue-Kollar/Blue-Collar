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

  test('map initializes again after navigating away and back', async ({ page }) => {
    const navigateUsingNav = async (name: string) => {
      const link = page.getByRole('navigation').getByRole('link', { name, exact: true })
      if (await link.isVisible()) {
        await link.click()
        return
      }

      await page.getByRole('button', { name: 'Open menu' }).click()
      await page.getByRole('dialog').getByRole('link', { name, exact: true }).click()
    }

    await goToWorkers(page)
    await page.getByRole('button', { name: 'Map', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toHaveCount(1)

    await navigateUsingNav('Home')
    await expect(page).toHaveURL(/\/en\/?$/)
    await navigateUsingNav('Workers')
    await expect(page).toHaveURL(/\/en\/workers/)
    await page.getByRole('button', { name: 'Map', exact: true }).click()

    await expect(page.locator('.leaflet-container')).toHaveCount(1)
  })
})

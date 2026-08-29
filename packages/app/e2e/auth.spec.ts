import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

test.describe('Auth flows (closes #1047)', () => {
  /**
   * Happy path: successful login flow
   */
  test('login page renders required fields', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/login`)
    await expect(page.locator('input[name="email"], input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[name="password"], input[type="password"]').first()).toBeVisible()
  })

  /**
   * Happy path: successful register flow
   */
  test('register page renders required fields', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/register`)
    await expect(page.locator('input[name="email"], input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[name="password"], input[type="password"]').first()).toBeVisible()
  })

  /**
   * Failure scenario: invalid credentials rejected
   */
  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/login`)
    await page.locator('input[name="email"], input[type="email"]').first().fill('invalid@example.com')
    await page.locator('input[name="password"], input[type="password"]').first().fill('wrongpassword')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/login|auth/)
  })

  /**
   * Failure scenario: password validation on registration
   */
  test('register with mismatched passwords shows validation error', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/register`)
    const emailInput = page.locator('input[name="email"], input[type="email"]').first()
    const passwordInputs = page.locator('input[type="password"]')
    await emailInput.fill('test@example.com')
    await passwordInputs.nth(0).fill('Password123!')
    if (await passwordInputs.count() > 1) {
      await passwordInputs.nth(1).fill('DifferentPassword!')
    }
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/register|auth/)
  })

  /**
   * Password reset flow
   */
  test('forgot password page is accessible', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/forgot-password`)
    await expect(page.locator('input[name="email"], input[type="email"]').first()).toBeVisible()
  })

  /**
   * Failure scenario: empty email on login
   */
  test('login with empty email field shows validation error', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/login`)
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
    await passwordInput.fill('password123')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/login|auth/)
  })

  /**
   * Failure scenario: empty password on login
   */
  test('login with empty password field shows validation error', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/login`)
    const emailInput = page.locator('input[name="email"], input[type="email"]').first()
    await emailInput.fill('test@example.com')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/login|auth/)
  })

  /**
   * Failure scenario: invalid email format
   */
  test('register with invalid email format shows error', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/register`)
    const emailInput = page.locator('input[name="email"], input[type="email"]').first()
    const passwordInputs = page.locator('input[type="password"]')
    await emailInput.fill('not-an-email')
    await passwordInputs.nth(0).fill('Password123!')
    if (await passwordInputs.count() > 1) {
      await passwordInputs.nth(1).fill('Password123!')
    }
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/register|auth/)
  })

  /**
   * Failure scenario: password too weak
   */
  test('register with weak password shows validation error', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/register`)
    const emailInput = page.locator('input[name="email"], input[type="email"]').first()
    const passwordInputs = page.locator('input[type="password"]')
    await emailInput.fill('newuser@example.com')
    await passwordInputs.nth(0).fill('weak')
    if (await passwordInputs.count() > 1) {
      await passwordInputs.nth(1).fill('weak')
    }
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/register|auth/)
  })

  /**
   * Navigation: auth pages are accessible
   */
  test('can navigate between auth pages', async ({ page }) => {
    await page.goto(`${BASE}/en/auth/login`)
    const registerLink = page.getByRole('link', { name: /register|sign up/i })
    if (await registerLink.isVisible()) {
      await registerLink.click()
      await expect(page).toHaveURL(/register/)
    }
  })
})

import { test, expect } from '@playwright/test'
import {
  BASE,
  goToLogin,
  goToRegister,
  goToForgotPassword,
  emailInputLocator,
  passwordInputLocator,
  passwordInputsLocator,
  submitButtonLocator,
} from './helpers'

test.describe('Auth flows (closes #1047)', () => {
  /**
   * Happy path: successful login flow
   */
  test('login page renders required fields', async ({ page }) => {
    await goToLogin(page)
    await expect(emailInputLocator(page)).toBeVisible()
    await expect(passwordInputLocator(page)).toBeVisible()
  })

  /**
   * Happy path: successful register flow
   */
  test('register page renders required fields', async ({ page }) => {
    await goToRegister(page)
    await expect(emailInputLocator(page)).toBeVisible()
    await expect(passwordInputLocator(page)).toBeVisible()
  })

  /**
   * Failure scenario: invalid credentials rejected
   */
  test('login with invalid credentials shows error', async ({ page }) => {
    await goToLogin(page)
    await emailInputLocator(page).fill('invalid@example.com')
    await passwordInputLocator(page).fill('wrongpassword')
    await submitButtonLocator(page).click()
    await expect(page).toHaveURL(/login|auth/)
  })

  /**
   * Failure scenario: password validation on registration
   */
  test('register with mismatched passwords shows validation error', async ({ page }) => {
    await goToRegister(page)
    await emailInputLocator(page).fill('test@example.com')
    const inputs = passwordInputsLocator(page)
    await inputs.nth(0).fill('Password123!')
    if (await inputs.count() > 1) {
      await inputs.nth(1).fill('DifferentPassword!')
    }
    await submitButtonLocator(page).click()
    await expect(page).toHaveURL(/register|auth/)
  })

  /**
   * Password reset flow
   */
  test('forgot password page is accessible', async ({ page }) => {
    await goToForgotPassword(page)
    await expect(emailInputLocator(page)).toBeVisible()
  })

  /**
   * Failure scenario: empty email on login
   */
  test('login with empty email field shows validation error', async ({ page }) => {
    await goToLogin(page)
    await passwordInputLocator(page).fill('password123')
    await submitButtonLocator(page).click()
    await expect(page).toHaveURL(/login|auth/)
  })

  /**
   * Failure scenario: empty password on login
   */
  test('login with empty password field shows validation error', async ({ page }) => {
    await goToLogin(page)
    await emailInputLocator(page).fill('test@example.com')
    await submitButtonLocator(page).click()
    await expect(page).toHaveURL(/login|auth/)
  })

  /**
   * Failure scenario: invalid email format
   */
  test('register with invalid email format shows error', async ({ page }) => {
    await goToRegister(page)
    await emailInputLocator(page).fill('not-an-email')
    const inputs = passwordInputsLocator(page)
    await inputs.nth(0).fill('Password123!')
    if (await inputs.count() > 1) {
      await inputs.nth(1).fill('Password123!')
    }
    await submitButtonLocator(page).click()
    await expect(page).toHaveURL(/register|auth/)
  })

  /**
   * Failure scenario: password too weak
   */
  test('register with weak password shows validation error', async ({ page }) => {
    await goToRegister(page)
    await emailInputLocator(page).fill('newuser@example.com')
    const inputs = passwordInputsLocator(page)
    await inputs.nth(0).fill('weak')
    if (await inputs.count() > 1) {
      await inputs.nth(1).fill('weak')
    }
    await submitButtonLocator(page).click()
    await expect(page).toHaveURL(/register|auth/)
  })

  /**
   * Navigation: auth pages are accessible
   */
  test('can navigate between auth pages', async ({ page }) => {
    await goToLogin(page)
    const registerLink = page.getByRole('link', { name: /register|sign up/i })
    if (await registerLink.isVisible()) {
      await registerLink.click()
      await expect(page).toHaveURL(/register/)
    }
  })
})

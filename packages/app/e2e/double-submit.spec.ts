import { test, expect, Page } from '@playwright/test';

/**
 * E2E test for double-submit protection.
 *
 * Covers issue #1801 acceptance criterion: "Test double-click".
 *
 * The test opens the contact modal, double-clicks the submit button, and
 * asserts that:
 *   1. Only one network request is issued to the contact endpoint.
 *   2. The submit button is disabled while the submission is in flight.
 */

const CONTACT_ENDPOINT = '**/api/contact';

/**
 * Opens the contact modal from the landing page.
 * Adjust the selector below to match the actual trigger in the app.
 */
async function openContactModal(page: Page): Promise<void> {
  await page.goto('/');

  // The button/link that opens the contact modal.
  const openButton = page.getByRole('button', { name: /contact/i });
  await expect(openButton).toBeVisible();
  await openButton.click();

  // Wait for the modal to be visible before interacting with the form.
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
}

/**
 * Fills the contact form with valid data.
 * Adjust field selectors to match the actual form markup.
 */
async function fillContactForm(page: Page): Promise<void> {
  const modal = page.getByRole('dialog');

  await modal.getByLabel(/name/i).fill('Jane Doe');
  await modal.getByLabel(/email/i).fill('jane.doe@example.com');
  await modal.getByLabel(/message/i).fill('Hello, this is a test message.');
}

test.describe('Contact form double-submit protection', () => {
  test('double-clicking submit issues only one request and disables the button', async ({
    page,
  }) => {
    let requestCount = 0;

    // Intercept the contact endpoint. We count requests and delay the
    // response so the in-flight (disabled) state is observable.
    await page.route(CONTACT_ENDPOINT, async (route) => {
      requestCount += 1;
      // Simulate network latency so the button stays disabled long enough
      // for the assertion below to run reliably.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await openContactModal(page);
    await fillContactForm(page);

    const modal = page.getByRole('dialog');
    const submitButton = modal.getByRole('button', { name: /submit|send/i });
    await expect(submitButton).toBeEnabled();

    // Double-click the submit button. Playwright's dblclick dispatches two
    // click events in quick succession, reproducing the double-submit bug.
    await submitButton.dblclick();

    // The submit guard should disable the button immediately after the first
    // click, while the request is still in flight.
    await expect(submitButton).toBeDisabled();

    // Wait for the submission to complete (success state or modal close).
    await expect
      .poll(() => requestCount, {
        message: 'Expected exactly one contact request after double-click',
        timeout: 5000,
      })
      .toBe(1);

    // Give any stray second request a chance to fire before the final check.
    await page.waitForTimeout(500);

    // Final assertion: only a single network request was issued.
    expect(requestCount).toBe(1);
  });

  test('submit button is re-enabled after a failed submission', async ({ page }) => {
    let requestCount = 0;

    await page.route(CONTACT_ENDPOINT, async (route) => {
      requestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    await openContactModal(page);
    await fillContactForm(page);

    const modal = page.getByRole('dialog');
    const submitButton = modal.getByRole('button', { name: /submit|send/i });

    await submitButton.click();

    // Button should be disabled while in flight.
    await expect(submitButton).toBeDisabled();

    // After the failed request resolves, the guard should release so the
    // user can retry.
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    expect(requestCount).toBe(1);
  });
});
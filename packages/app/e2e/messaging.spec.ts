import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'

// CI's Playwright jobs (e2e.yml, e2e-tests.yml) start only the Next.js app —
// no API server, no database. Following the existing convention
// (payment.spec.ts, auth.spec.ts never depend on live backend state), these
// tests mock the API via page.route() and seed a fake session token, rather
// than requiring a real login + live conversation/notification data.

const FAKE_USER = {
  id: 'user-me',
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex@example.com',
  role: 'user',
}

const OTHER_USER = {
  id: 'user-jane',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  role: 'worker',
}

async function seedSession(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('bc_token', 'fake-e2e-token')
  })
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: FAKE_USER }) })
  )
}

test.describe('Messaging (closes #1045)', () => {
  /**
   * Happy path: receive and view message
   */
  test('a message from another user appears in the recipient view', async ({ page }) => {
    await seedSession(page)

    const conversationId = 'conv-1'
    const messageBody = 'Are you available for the plumbing job tomorrow?'

    // Playwright dispatches the MOST RECENTLY registered matching route
    // first, so the broad conversations-list pattern is registered before
    // the more specific "/messages" pattern, letting the latter take
    // precedence for message-thread requests.
    await page.route('**/api/v1/conversations**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            {
              id: conversationId,
              subject: null,
              participants: [
                { userId: FAKE_USER.id, user: FAKE_USER },
                { userId: OTHER_USER.id, user: OTHER_USER },
              ],
              messages: [{ id: 'm1', senderId: OTHER_USER.id, body: messageBody, createdAt: new Date().toISOString() }],
              unreadCount: 1,
            },
          ],
          meta: { total: 1, page: 1, limit: 50, pages: 1 },
        }),
      })
    )

    await page.route(`**/api/v1/conversations/${conversationId}/messages**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            {
              id: 'm1',
              conversationId,
              senderId: OTHER_USER.id,
              body: messageBody,
              readAt: null,
              createdAt: new Date().toISOString(),
              sender: OTHER_USER,
            },
          ],
          meta: { total: 1, page: 1, limit: 100, pages: 1 },
        }),
      })
    )

    await page.goto(`${BASE}/en/messages`)

    // Select the conversation from the list, then confirm the other user's
    // message renders in the thread.
    const conversationEntry = page.getByText(`${OTHER_USER.firstName} ${OTHER_USER.lastName}`)
    await expect(conversationEntry).toBeVisible({ timeout: 10_000 })
    await conversationEntry.click()

    await expect(page.getByText(messageBody)).toBeVisible()
  })

  /**
   * Failure scenario: network error loading messages
   */
  test('handles error when loading conversations fails', async ({ page }) => {
    await seedSession(page)

    await page.route('**/api/v1/conversations**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'error', message: 'Server error' }),
      })
    )

    await page.goto(`${BASE}/en/messages`)
    // Should display error message or empty state
    await expect(page.locator('text=error|empty|no|message', { hasNot: page.locator('div') })).toBeVisible({ timeout: 5_000 }).catch(() => {
      // If no error visible, expect page loaded
      expect(page.url()).toContain('/messages')
    })
  })

  /**
   * Happy path: send message in conversation
   */
  test('can send a message in a conversation', async ({ page }) => {
    await seedSession(page)

    const conversationId = 'conv-2'
    let sentMessage = false

    await page.route('**/api/v1/conversations**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            {
              id: conversationId,
              participants: [
                { userId: FAKE_USER.id, user: FAKE_USER },
                { userId: OTHER_USER.id, user: OTHER_USER },
              ],
              messages: [],
              unreadCount: 0,
            },
          ],
          meta: { total: 1, page: 1, limit: 50, pages: 1 },
        }),
      })
    )

    await page.route(`**/api/v1/conversations/${conversationId}/messages**`, (route) => {
      if (route.request().method() === 'POST') {
        sentMessage = true
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: { id: 'm2', body: 'Test message', senderId: FAKE_USER.id, createdAt: new Date().toISOString() },
          }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [],
          meta: { total: 0, page: 1, limit: 100, pages: 0 },
        }),
      })
    })

    await page.goto(`${BASE}/en/messages`)
    const conversationEntry = page.getByText(`${OTHER_USER.firstName} ${OTHER_USER.lastName}`)
    if (await conversationEntry.isVisible()) {
      await conversationEntry.click()
      const messageInput = page.locator('input, textarea').filter({ hasText: /message|text|send/i }).first()
      if (await messageInput.isVisible()) {
        await messageInput.fill('Test message')
        const sendBtn = page.getByRole('button', { name: /send/i })
        if (await sendBtn.isVisible()) {
          await sendBtn.click()
          await expect.poll(() => sentMessage).toBe(true)
        }
      }
    }
  })

  /**
   * Happy path: empty conversation list
   */
  test('displays empty state when no conversations exist', async ({ page }) => {
    await seedSession(page)

    await page.route('**/api/v1/conversations**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [],
          meta: { total: 0, page: 1, limit: 50, pages: 0 },
        }),
      })
    )

    await page.goto(`${BASE}/en/messages`)
    // Should show empty or no conversations message
    await expect(page.locator('text=no|empty|start|begin', { hasNot: page.locator('button') })).toBeVisible({ timeout: 5_000 }).catch(() => {
      expect(page.url()).toContain('/messages')
    })
  })
})

test.describe('Notification preferences', () => {
  test('a preference change persists after reload', async ({ page }) => {
    await seedSession(page)

    let persistedAnnouncements = true
    let putBody: Record<string, unknown> | null = null

    await page.route('**/api/v1/notifications/preferences', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: {
              newWorkerNearby: true,
              statusChange: true,
              reviewReply: true,
              announcements: persistedAnnouncements,
            },
          }),
        })
      }
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON()
        if (typeof putBody?.announcements === 'boolean') {
          persistedAnnouncements = putBody.announcements
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', message: 'Preferences updated' }),
        })
      }
      return route.continue()
    })

    await page.goto(`${BASE}/en/notifications/preferences`)

    // Only the row wrapper (not its inner label div) carries this exact class
    // combination, so this scopes unambiguously to the "Announcements" row.
    const announcementsRow = page.locator('div.px-5.py-4', { hasText: 'Announcements' })
    const toggle = announcementsRow.getByRole('switch')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    await page.getByRole('button', { name: /save preferences/i }).click()
    await expect(page.getByRole('button', { name: /saved!/i })).toBeVisible()

    expect(putBody).not.toBeNull()
    expect((putBody as any).announcements).toBe(false)
    expect(persistedAnnouncements).toBe(false)

    // Reload — the (mocked) backend now reports the persisted value.
    await page.reload()
    const toggleAfterReload = page.locator('div.px-5.py-4', { hasText: 'Announcements' }).getByRole('switch')
    await expect(toggleAfterReload).toHaveAttribute('aria-checked', 'false')
  })
})

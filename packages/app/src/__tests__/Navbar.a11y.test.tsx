/**
 * Accessibility regression tests for the navigation header (Navbar).
 *
 * axe covers the static markup in both the desktop bar and the open mobile
 * drawer; the rest covers what axe cannot see — the drawer's modal semantics,
 * its focus trap, focus restoration, Escape handling, and current-page state.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axe from 'axe-core'
import React from 'react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mockPush = vi.fn()
const mockPathname = vi.fn(() => '/workers')
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Return the key, with interpolated params appended, so tests can assert on
// the dynamic half of a label without hard-coding English copy.
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(' ')}` : key,
  useMessages: () => ({}),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))

const mockUser = vi.fn(() => null as { id: string; firstName: string; role: string } | null)
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser(), logout: vi.fn() }),
}))

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    publicKey: null,
    network: null,
    isConnecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

vi.mock('@/context/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    clearAll: vi.fn(),
  }),
}))

import Navbar from '@/components/Navbar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function runAxe(container: Element) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    },
  })
  return results.violations
}

function formatViolations(violations: axe.Result[]): string {
  return violations
    .map((v) => `[${v.impact}] ${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`)
    .join('\n')
}

const menuButton = () => screen.getByRole('button', { name: 'openMenu' })
const drawer = () => screen.getByRole('dialog', { name: 'mobileMenu' })

/** Open the mobile drawer and return it. */
async function openDrawer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(menuButton())
  return drawer()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser.mockReturnValue(null)
  mockPathname.mockReturnValue('/workers')
})

// ─── axe ──────────────────────────────────────────────────────────────────────

describe('Navbar — axe (WCAG 2.1 AA)', () => {
  it('has no violations when logged out', async () => {
    const { container } = render(<Navbar />)
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('has no violations when logged in', async () => {
    mockUser.mockReturnValue({ id: 'u1', firstName: 'Ada', role: 'admin' })
    const { container } = render(<Navbar />)
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('has no violations with the mobile drawer open', async () => {
    const user = userEvent.setup()
    const { container } = render(<Navbar />)
    await openDrawer(user)
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

// ─── Landmarks, roles and labels ──────────────────────────────────────────────

describe('Navbar — ARIA roles and labels', () => {
  it('labels the nav landmark, so it is distinguishable from BottomNav', () => {
    render(<Navbar />)
    expect(screen.getByRole('navigation', { name: 'primaryNavigation' })).toBeInTheDocument()
  })

  it('exposes the primary links as a list', () => {
    render(<Navbar />)
    const nav = screen.getByRole('navigation', { name: 'primaryNavigation' })
    // Desktop bar; the drawer list only exists while the drawer is open.
    expect(within(nav).getAllByRole('listitem')).toHaveLength(3)
  })

  it('marks the active link with aria-current="page"', () => {
    mockPathname.mockReturnValue('/workers')
    render(<Navbar />)
    expect(screen.getByRole('link', { name: 'workers' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'home' })).not.toHaveAttribute('aria-current')
  })

  it('does not mark any link current on an unrelated route', () => {
    mockPathname.mockReturnValue('/settings')
    render(<Navbar />)
    for (const name of ['home', 'workers', 'about']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('names the language trigger with the current language', () => {
    render(<Navbar />)
    expect(
      screen.getByRole('button', { name: 'changeLanguage English' }),
    ).toBeInTheDocument()
  })

  it('names the account trigger with the signed-in user', () => {
    mockUser.mockReturnValue({ id: 'u1', firstName: 'Ada', role: 'user' })
    render(<Navbar />)
    expect(screen.getByRole('button', { name: 'accountMenu Ada' })).toBeInTheDocument()
  })

  it('describes the menu button as a collapsed dialog trigger', async () => {
    const user = userEvent.setup()
    render(<Navbar />)

    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton()).toHaveAttribute('aria-haspopup', 'dialog')

    await openDrawer(user)
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
    // aria-controls must point at the element that actually exists.
    const controls = menuButton().getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    expect(document.getElementById(controls!)).toBe(drawer())
  })
})

// ─── Mobile drawer: modal semantics ───────────────────────────────────────────

describe('Navbar — mobile drawer semantics', () => {
  it('exposes the drawer as a labelled modal dialog', async () => {
    const user = userEvent.setup()
    render(<Navbar />)
    const panel = await openDrawer(user)
    expect(panel).toHaveAttribute('aria-modal', 'true')
    expect(panel).toHaveAttribute('aria-label', 'mobileMenu')
  })

  it('hides the click-to-dismiss backdrop from assistive tech', async () => {
    const user = userEvent.setup()
    const { container } = render(<Navbar />)
    await openDrawer(user)
    // The backdrop is mouse-only; Escape and the close button serve keyboard
    // users, so it must not appear as a phantom element in the a11y tree.
    const backdrop = container.querySelector('.fixed.inset-0')
    expect(backdrop).toHaveAttribute('aria-hidden', 'true')
  })

  it('marks the active link current inside the drawer too', async () => {
    const user = userEvent.setup()
    mockPathname.mockReturnValue('/workers')
    render(<Navbar />)
    const panel = await openDrawer(user)
    expect(within(panel).getByRole('link', { name: 'workers' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('groups the drawer language switcher and marks the current locale', async () => {
    const user = userEvent.setup()
    render(<Navbar />)
    const panel = await openDrawer(user)

    const group = within(panel).getByRole('group', { name: 'language' })
    expect(within(group).getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(group).getByRole('button', { name: 'Français' })).not.toHaveAttribute(
      'aria-current',
    )
  })
})

// ─── Mobile drawer: keyboard and focus ────────────────────────────────────────

describe('Navbar — drawer keyboard navigation and focus management', () => {
  it('does not steal focus on mount', () => {
    // Focus restoration must be scoped to closing the drawer; if it runs on
    // mount it hijacks the page's initial focus and breaks the tab order.
    render(<Navbar />)
    expect(document.activeElement).toBe(document.body)
  })

  it('moves focus into the drawer when it opens', async () => {
    const user = userEvent.setup()
    render(<Navbar />)
    await openDrawer(user)
    expect(screen.getByRole('button', { name: 'closeMenu' })).toHaveFocus()
  })

  it('closes on Escape and restores focus to the menu button', async () => {
    const user = userEvent.setup()
    render(<Navbar />)
    await openDrawer(user)

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(menuButton()).toHaveFocus()
  })

  it('closes via the close button and restores focus to the menu button', async () => {
    const user = userEvent.setup()
    render(<Navbar />)
    await openDrawer(user)

    await user.click(screen.getByRole('button', { name: 'closeMenu' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Focus must not be left on a button that no longer exists.
    expect(menuButton()).toHaveFocus()
  })

  it('traps Tab inside the drawer, wrapping from the last element to the first', async () => {
    const user = userEvent.setup()
    render(<Navbar />)
    const panel = await openDrawer(user)

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    )
    expect(focusable.length).toBeGreaterThan(1)

    const last = focusable[focusable.length - 1]!
    last.focus()
    await user.tab()

    expect(focusable[0]!).toHaveFocus()
  })

  it('traps Shift+Tab, wrapping from the first element to the last', async () => {
    const user = userEvent.setup()
    render(<Navbar />)
    const panel = await openDrawer(user)

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    )
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!

    first.focus()
    await user.tab({ shift: true })

    expect(last).toHaveFocus()
  })

  it('keeps focus inside the drawer across a full Tab cycle', async () => {
    const user = userEvent.setup()
    render(<Navbar />)
    const panel = await openDrawer(user)

    const count = panel.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ).length

    // One extra Tab past the end proves the trap wraps rather than escaping
    // into the page content behind the overlay.
    for (let i = 0; i <= count; i++) {
      await user.tab()
      expect(panel.contains(document.activeElement)).toBe(true)
    }
  })
})

/**
 * Automated accessibility tests using axe-core (WCAG 2.1 AA compliance),
 * plus keyboard-navigation and focus-management checks.
 *
 * Tests render each key component/page fragment and run axe against it.
 * Any axe violation causes the test to fail with a descriptive message.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import axe from 'axe-core'
import React from 'react'

// ─── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, params?: any) => {
    // Return meaningful values for commonly tested keys
    if (key === 'title' && params?.name) return `Contact ${params.name}`
    if (key === 'ariaClose') return 'Close dialog'
    return key
  },
  useMessages: () => ({}),
}))

vi.mock('next-intl/server', () => ({
  getTranslations: () => (key: string, params?: any) => {
    if (key === 'title' && params?.name) return `Contact ${params.name}`
    if (key === 'ariaClose') return 'Close dialog'
    return key
  },
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}))

// Mock every lucide icon as a decorative (aria-hidden) span via a Proxy, so we
// never have to enumerate icon names. Icons given an explicit aria-label keep it.
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const Icon = ({ 'aria-label': label, 'aria-hidden': hidden }: any) =>
    label ? <span aria-label={label} role="img" /> : <span aria-hidden={hidden ?? 'true'} />
  // Replace every real lucide export with a decorative icon so we keep all
  // named exports (vitest validates named imports against the mock).
  const mock: Record<string, unknown> = {}
  for (const key of Object.keys(actual)) {
    mock[key] = typeof (actual as any)[key] === 'function' ? Icon : (actual as any)[key]
  }
  return mock
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    logout: vi.fn(),
    token: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
  })),
}))

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({ address: null, connecting: false, connect: vi.fn() }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuthContext: vi.fn(() => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}))

vi.mock('@/lib/api', () => ({
  sendContactRequest: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/context/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    addNotification: vi.fn(),
    clearAll: vi.fn(),
  }),
}))

// jsdom has no canvas; stub getContext so chart/qr components don't throw noise.
beforeAll(() => {
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = vi.fn() as any
  }
})

// ─── axe helper ───────────────────────────────────────────────────────────────

/** Run axe on the rendered container (WCAG 2.1 AA) and return violations. */
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
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.description}\n  Nodes: ${v.nodes.map((n) => n.html).join(', ')}`,
    )
    .join('\n')
}

/** Render a component and assert it has zero axe violations. */
async function expectNoViolations(ui: React.ReactElement) {
  const { container } = render(ui)
  const violations = await runAxe(container)
  expect(violations, formatViolations(violations)).toHaveLength(0)
}

// ─── Component axe tests ────────────────────────────────────────────────────

describe('Accessibility (WCAG 2.1 AA)', () => {
  it('WorkerCard has no violations', async () => {
    const { default: WorkerCard } = await import('@/components/WorkerCard')
    const { CompareProvider } = await import('@/context/CompareContext')
    await expectNoViolations(
      <CompareProvider>
        <WorkerCard
          worker={{
            id: 'w1',
            name: 'Jane Doe',
            isVerified: true,
            category: { id: 'c1', name: 'Plumber' },
            bio: 'Expert plumber',
            location: 'Lagos, Nigeria',
          }}
        />
      </CompareProvider>,
    )
  })

  it('Navbar (logged out) has no violations', async () => {
    const { default: Navbar } = await import('@/components/Navbar')
    await expectNoViolations(<Navbar />)
  })

  it('EmptyState has no violations', async () => {
    const { default: EmptyState } = await import('@/components/EmptyState')
    await expectNoViolations(<EmptyState variant="no-workers" />)
  })

  it('StarRating has no violations and exposes an accessible label', async () => {
    const { default: StarRating } = await import('@/components/StarRating')
    const { container } = render(<StarRating rating={4} />)
    expect(screen.getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument()
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('FormField has no violations', async () => {
    const { default: FormField } = await import('@/components/FormField')
    await expectNoViolations(<FormField label="Email address" name="email" type="email" />)
  })

  it('PasswordStrength has no violations', async () => {
    const { default: PasswordStrength } = await import('@/components/PasswordStrength')
    await expectNoViolations(<PasswordStrength password="Test123!" />)
  })

  it('ReviewCard has no violations', async () => {
    const { default: ReviewCard } = await import('@/components/ReviewCard')
    await expectNoViolations(
      <ReviewCard
        review={{
          id: 'r1',
          rating: 5,
          comment: 'Excellent work!',
          workerId: 'w1',
          authorId: 'a1',
          createdAt: '2024-01-01T00:00:00Z',
          author: { id: 'a1', firstName: 'Alice', lastName: 'Smith' },
        }}
      />,
    )
  })

  it('IconButton has no violations', async () => {
    const { IconButton } = await import('@/components/IconButton')
    await expectNoViolations(
      <IconButton aria-label="Open menu">
        <span aria-hidden="true" />
      </IconButton>,
    )
  })

  it('CategoryBadge has no violations', async () => {
    const { CategoryBadge } = await import('@/components/CategoryBadge')
    await expectNoViolations(<CategoryBadge slug="plumbing" />)
  })

  it('BottomNav (logged in) has no violations', async () => {
    const { useAuth } = await import('@/hooks/useAuth')
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', firstName: 'Sam', lastName: 'Doe', email: 's@e.com' },
      logout: vi.fn(),
      token: 't',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
    } as any)
    const { default: BottomNav } = await import('@/components/BottomNav')
    await expectNoViolations(<BottomNav />)
  })

  it('ContactModal trigger has no violations', async () => {
    const { default: ContactModal } = await import('@/components/ContactModal')
    await expectNoViolations(<ContactModal workerId="w1" workerName="Jane Doe" />)
  })

  it('EscrowStatus has no violations in every status', async () => {
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')
    const statuses = ['pending', 'funded', 'released', 'disputed', 'cancelled'] as const
    for (const status of statuses) {
      const { container, unmount } = render(
        <EscrowStatus
          escrow={{ ...ESCROW, status }}
          onRelease={vi.fn()}
          onDispute={vi.fn()}
        />,
      )
      const violations = await runAxe(container)
      expect(violations, `status=${status}\n${formatViolations(violations)}`).toHaveLength(0)
      unmount()
    }
  })
})

// ─── EscrowStatus semantics ───────────────────────────────────────────────────

const ESCROW = {
  id: 'escrow-1730000000000-1',
  amount: '250.5',
  token: 'XLM',
  counterparty: 'GCKFBEIYTKP6RCZX6LRJLPWLZBQK3RGZDVQBVQXAHXQ7VQXAHXQ7VQXA',
  terms: 'Fix the kitchen sink and replace the shut-off valve before Friday.',
  status: 'funded' as const,
  createdAt: '2026-07-01T10:00:00Z',
  expiresAt: '2026-07-08T10:00:00Z',
  txHash: 'abc123def456',
}

describe('EscrowStatus accessibility', () => {
  it('exposes the card as a named region and the amount as its heading', async () => {
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')
    render(<EscrowStatus escrow={ESCROW} onRelease={vi.fn()} onDispute={vi.fn()} />)

    // article + aria-labelledby -> an "article" landmark named by the amount.
    expect(screen.getByRole('article', { name: /250\.5 XLM/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /250\.5 XLM/ })).toBeInTheDocument()
  })

  it('announces the status through a live region', async () => {
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')
    const { rerender } = render(
      <EscrowStatus escrow={ESCROW} onRelease={vi.fn()} onDispute={vi.fn()} />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/Status:\s*Funded/)

    rerender(
      <EscrowStatus
        escrow={{ ...ESCROW, status: 'released' }}
        onRelease={vi.fn()}
        onDispute={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Status:\s*Released/)
  })

  it('marks timeline progress with aria-current and per-step state text', async () => {
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')
    render(<EscrowStatus escrow={ESCROW} onRelease={vi.fn()} onDispute={vi.fn()} />)

    const timeline = screen.getByRole('list', { name: 'Escrow progress' })
    const steps = within(timeline).getAllByRole('listitem')
    expect(steps).toHaveLength(3)

    expect(steps[0]).toHaveTextContent(/Pending\s*\(completed\)/)
    expect(steps[1]).toHaveTextContent(/Funded\s*\(current step\)/)
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(steps[2]).toHaveTextContent(/Released\s*\(not started\)/)
    expect(steps[0]).not.toHaveAttribute('aria-current')
  })

  it('hides the timeline for terminal statuses', async () => {
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')
    render(
      <EscrowStatus
        escrow={{ ...ESCROW, status: 'disputed' }}
        onRelease={vi.fn()}
        onDispute={vi.fn()}
      />,
    )
    expect(screen.queryByRole('list', { name: 'Escrow progress' })).not.toBeInTheDocument()
  })

  it('gives each action an unambiguous accessible name', async () => {
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')
    render(<EscrowStatus escrow={ESCROW} onRelease={vi.fn()} onDispute={vi.fn()} />)

    // Generic "Release"/"Dispute" would be indistinguishable across a list of cards.
    expect(
      screen.getByRole('button', { name: `Release 250.5 XLM to ${ESCROW.counterparty}` }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Dispute 250.5 XLM escrow with ${ESCROW.counterparty}` }),
    ).toBeInTheDocument()
  })

  it('warns that the explorer link opens in a new tab', async () => {
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')
    render(<EscrowStatus escrow={ESCROW} onRelease={vi.fn()} onDispute={vi.fn()} />)

    const link = screen.getByRole('link', { name: /opens in a new tab/i })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('marks the actions busy and announces work while loading', async () => {
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')
    render(<EscrowStatus escrow={ESCROW} onRelease={vi.fn()} onDispute={vi.fn()} isLoading />)

    const release = screen.getByRole('button', { name: /^Release/ })
    expect(release).toBeDisabled()
    expect(release).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText(/submitting escrow action/i)).toBeInTheDocument()
  })

  it('reaches both actions by keyboard and fires them with Enter', async () => {
    const user = userEvent.setup()
    const onRelease = vi.fn()
    const onDispute = vi.fn()
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')
    render(<EscrowStatus escrow={ESCROW} onRelease={onRelease} onDispute={onDispute} />)

    const release = screen.getByRole('button', { name: /^Release/ })
    const dispute = screen.getByRole('button', { name: /^Dispute/ })

    // The status line is tabIndex={-1}: a focus target, but not in the tab order.
    // Tab order should run link -> Release -> Dispute, in visual order.
    await user.tab()
    expect(screen.getByRole('link', { name: /opens in a new tab/i })).toHaveFocus()
    await user.tab()
    expect(release).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onRelease).toHaveBeenCalledTimes(1)

    await user.tab()
    expect(dispute).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onDispute).toHaveBeenCalledTimes(1)
  })

  it('keeps focus in the card when the action row unmounts after release', async () => {
    const user = userEvent.setup()
    const { default: EscrowStatus } = await import('@/components/Escrow/EscrowStatus')

    function Harness() {
      const [status, setStatus] = React.useState<'funded' | 'released'>('funded')
      return (
        <EscrowStatus
          escrow={{ ...ESCROW, status }}
          onRelease={() => setStatus('released')}
          onDispute={vi.fn()}
        />
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /^Release/ }))

    // Buttons are gone; focus must not have fallen back to <body>.
    expect(screen.queryByRole('button', { name: /^Release/ })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus())
  })
})

// ─── Keyboard navigation ──────────────────────────────────────────────────────

describe('Keyboard navigation', () => {
  it('IconButton is focusable and activates with Enter and Space', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { IconButton } = await import('@/components/IconButton')
    render(
      <IconButton aria-label="Refresh" onClick={onClick}>
        <span aria-hidden="true" />
      </IconButton>,
    )

    const button = screen.getByRole('button', { name: 'Refresh' })
    await user.tab()
    expect(button).toHaveFocus()

    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('Navbar links are reachable in tab order', async () => {
    const user = userEvent.setup()
    const { default: Navbar } = await import('@/components/Navbar')
    render(<Navbar />)
    // Tabbing should land on a focusable element (a link or button), not be trapped.
    await user.tab()
    expect(document.activeElement).not.toBe(document.body)
  })
})

// ─── Focus management for dynamic content ───────────────────────────────────────

describe('Focus management', () => {
  it('ContactModal moves focus into the dialog when opened and labels its close button', async () => {
    const user = userEvent.setup()
    const { default: ContactModal } = await import('@/components/ContactModal')
    render(<ContactModal workerId="w1" workerName="Jane Doe" />)

    await user.click(screen.getByRole('button', { name: /contact/i }))

    // Radix moves focus into the dialog and exposes it as role="dialog".
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    // The icon-only close control has an accessible name.
    expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument()

    // Opened dialog itself is free of axe violations.
    const violations = await runAxe(dialog)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

/**
 * Accessibility regression tests for the reviews panel (ReviewsSection and the
 * components it renders: ReviewSortFilter, RatingBreakdown, ReviewForm,
 * ReviewCard, ReviewHelpfulButton).
 *
 * axe covers the static markup; the rest of the file covers what axe cannot
 * see — keyboard operation, focus order, focus management across state
 * changes, and live-region announcements.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axe from 'axe-core'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/workers/w1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
  useMessages: () => ({}),
}))

const mockUser = vi.fn(() => null as { id: string } | null)
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser() }),
}))

const getWorkerReviews = vi.fn()
const createReview = vi.fn()
const toggleReviewHelpful = vi.fn()
vi.mock('@/lib/api', () => ({
  getWorkerReviews: (...args: unknown[]) => getWorkerReviews(...args),
  createReview: (...args: unknown[]) => createReview(...args),
  toggleReviewHelpful: (...args: unknown[]) => toggleReviewHelpful(...args),
}))

import ReviewsSection from '@/components/ReviewsSection'
import type { Review } from '@/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeReview(n: number, rating = 5): Review {
  return {
    id: `r${n}`,
    rating,
    comment: `Review number ${n}`,
    createdAt: `2026-01-${String(n).padStart(2, '0')}T10:00:00.000Z`,
    authorId: `a${n}`,
    author: { id: `a${n}`, firstName: `First${n}`, lastName: `Last${n}`, avatar: null },
  } as unknown as Review
}

const DISTRIBUTION = [
  { rating: 5, count: 4, percentage: 67 },
  { rating: 4, count: 1, percentage: 17 },
  { rating: 3, count: 1, percentage: 17 },
  { rating: 2, count: 0, percentage: 0 },
  { rating: 1, count: 0, percentage: 0 },
]

/** Fresh per-test client — a shared one would leak cached filter results across tests. */
function newTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function withQueryClient(children: React.ReactNode) {
  return <QueryClientProvider client={newTestQueryClient()}>{children}</QueryClientProvider>
}

function renderPanel(reviews: Review[] = [makeReview(1), makeReview(2, 3)]) {
  return render(
    withQueryClient(
      <ReviewsSection
        workerId="w1"
        initialReviews={reviews}
        reviewCount={reviews.length}
        averageRating={4.2}
        distribution={DISTRIBUTION as any}
      />,
    ),
  )
}

// ─── axe helper ───────────────────────────────────────────────────────────────

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

/**
 * Flush the pending filter request and its state update inside act(), so the
 * async work a click kicked off doesn't land after the assertion.
 */
async function settled() {
  await act(async () => {
    await Promise.resolve()
  })
}

/** The star-picker radio at 1-based position `n`. */
function star(n: number): HTMLElement {
  return screen.getByRole('radio', { name: `Rate ${n} star${n > 1 ? 's' : ''}` })
}

/** The panel's polite live region. */
function liveRegion(container: Element): HTMLElement {
  const el = container.querySelector<HTMLElement>('[aria-live="polite"]')
  if (!el) throw new Error('ReviewsSection rendered no polite live region')
  return el
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser.mockReturnValue(null)
  getWorkerReviews.mockResolvedValue({ data: [makeReview(9, 5)] })
  createReview.mockResolvedValue({ data: makeReview(99, 4) })
  toggleReviewHelpful.mockResolvedValue({ data: { helpful: true, count: 1 } })
})

// ─── axe ──────────────────────────────────────────────────────────────────────

describe('ReviewsSection — axe (WCAG 2.1 AA)', () => {
  it('has no violations with reviews present', async () => {
    const { container } = renderPanel()
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('has no violations in the empty state', async () => {
    const { container } = render(
      withQueryClient(
        <ReviewsSection
          workerId="w1"
          initialReviews={[]}
          reviewCount={0}
          averageRating={null}
          distribution={[] as any}
        />,
      ),
    )
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('has no violations once a rating filter is applied', async () => {
    const user = userEvent.setup()
    const { container } = renderPanel()
    await user.click(screen.getByRole('button', { name: /Filter by 5 stars/ }))
    await settled()
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('has no violations when the review form shows a validation error', async () => {
    const user = userEvent.setup()
    const { container } = renderPanel()
    await user.click(screen.getByRole('button', { name: 'Submit Review' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please select a rating.')
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

// ─── Roles, labels and structure ──────────────────────────────────────────────

describe('ReviewsSection — ARIA roles and labels', () => {
  it('exposes the panel as a region labelled by its heading', () => {
    renderPanel()
    const heading = screen.getByRole('heading', { level: 2, name: /Reviews/ })
    const region = screen.getByRole('region', { name: /Reviews/ })
    expect(region).toBeInTheDocument()
    expect(heading.id).toBeTruthy()
    expect(region).toHaveAttribute('aria-labelledby', heading.id)
  })

  it('exposes the reviews as a list so assistive tech announces the item count', () => {
    renderPanel([makeReview(1), makeReview(2), makeReview(3)])
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
  })

  it('gives each review an article role labelled with its author', () => {
    renderPanel([makeReview(1)])
    expect(screen.getByRole('article', { name: 'Review by First1 Last1' })).toBeInTheDocument()
  })

  it('gives the sort control an accessible name', () => {
    renderPanel()
    expect(screen.getByRole('combobox', { name: 'Sort reviews' })).toBeInTheDocument()
  })

  it('groups the rating filters and labels each with its count and percentage', () => {
    renderPanel()
    const group = screen.getByRole('group', { name: 'Filter reviews by rating' })
    expect(
      within(group).getByRole('button', { name: 'Filter by 5 stars: 4 reviews, 67%' }),
    ).toBeInTheDocument()
    expect(
      within(group).getByRole('button', { name: 'Filter by 4 stars: 1 review, 17%' }),
    ).toBeInTheDocument()
  })

  it('reflects filter state via aria-pressed', async () => {
    const user = userEvent.setup()
    renderPanel()
    const filter = screen.getByRole('button', { name: /Filter by 5 stars/ })
    expect(filter).toHaveAttribute('aria-pressed', 'false')
    await user.click(filter)
    await waitFor(() => expect(filter).toHaveAttribute('aria-pressed', 'true'))
    await settled()
  })

  it('exposes the average rating as a single labelled image', () => {
    renderPanel()
    expect(
      screen.getByRole('img', { name: 'Average rating 4.2 out of 5 stars, from 2 reviews' }),
    ).toBeInTheDocument()
  })

  it('describes the load-more button with the remaining count', () => {
    renderPanel(Array.from({ length: 8 }, (_, i) => makeReview(i + 1)))
    expect(
      screen.getByRole('button', { name: 'Load more reviews, 3 remaining' }),
    ).toBeInTheDocument()
  })

  it('marks the helpful toggle as a pressable button carrying its count', () => {
    renderPanel([makeReview(1)])
    expect(
      screen.getByRole('button', { name: 'Mark as helpful (0 so far)' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders the review date as a machine-readable time element', () => {
    const { container } = renderPanel([makeReview(1)])
    const time = container.querySelector('time')
    expect(time).toHaveAttribute('dateTime', '2026-01-01T10:00:00.000Z')
  })

  it('provides the #review-form target that the empty-state CTA links to', () => {
    const { container } = render(
      withQueryClient(
        <ReviewsSection
          workerId="w1"
          initialReviews={[]}
          reviewCount={0}
          averageRating={null}
          distribution={[] as any}
        />,
      ),
    )
    const cta = screen.getByRole('link', { name: /Write a Review/i })
    expect(cta).toHaveAttribute('href', '#review-form')
    // Without this element the CTA is a dead link.
    expect(container.querySelector('#review-form')).toBeInTheDocument()
  })
})

// ─── Keyboard navigation and focus order ──────────────────────────────────────

describe('ReviewsSection — keyboard navigation', () => {
  it('reaches the sort control, rating filters and review form by Tab alone', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.tab()
    expect(screen.getByRole('combobox', { name: 'Sort reviews' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: /Filter by 5 stars/ })).toHaveFocus()

    // Four remaining rating filters, then the star picker's single tab stop.
    for (let i = 0; i < 4; i++) await user.tab()
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Rate 1 star' })).toHaveFocus()
  })

  it('treats the star picker as one tab stop (roving tabindex)', async () => {
    const user = userEvent.setup()
    renderPanel()

    const stars = screen.getAllByRole('radio')
    expect(stars).toHaveLength(5)
    // Only the active star is tabbable; the rest are reachable via arrow keys.
    expect(stars.filter((s) => s.getAttribute('tabindex') === '0')).toHaveLength(1)

    star(1).focus()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Your review (optional)' })).toHaveFocus()
  })

  it('moves between stars with arrow keys and wraps at both ends', async () => {
    const user = userEvent.setup()
    renderPanel()

    star(1).focus()
    await user.keyboard('{ArrowRight}')
    expect(star(2)).toHaveFocus()
    expect(star(2)).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(star(1)).toHaveFocus()

    // Wrap backwards from the first star to the last.
    await user.keyboard('{ArrowLeft}')
    expect(star(5)).toHaveFocus()
    // And forwards from the last back to the first.
    await user.keyboard('{ArrowRight}')
    expect(star(1)).toHaveFocus()
  })

  it('supports Home and End within the star picker', async () => {
    const user = userEvent.setup()
    renderPanel()

    star(1).focus()
    await user.keyboard('{End}')
    expect(star(5)).toHaveFocus()
    expect(star(5)).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{Home}')
    expect(star(1)).toHaveFocus()
    expect(star(1)).toHaveAttribute('aria-checked', 'true')
  })

  it('marks exactly one star as checked at a time', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(star(4))
    const checked = screen.getAllByRole('radio').filter(
      (s) => s.getAttribute('aria-checked') === 'true',
    )
    expect(checked).toHaveLength(1)
    expect(star(4)).toHaveAttribute('aria-checked', 'true')
  })

  it('operates the rating filter with the keyboard', async () => {
    const user = userEvent.setup()
    renderPanel()

    const filter = screen.getByRole('button', { name: /Filter by 3 stars/ })
    filter.focus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(getWorkerReviews).toHaveBeenCalledWith('w1', { rating: '3', limit: '50' }),
    )
    await settled()
  })
})

// ─── Focus management ─────────────────────────────────────────────────────────

describe('ReviewsSection — focus management', () => {
  it('moves focus to the first newly revealed review after Load more', async () => {
    const user = userEvent.setup()
    // 8 reviews, page size 5 — the 6th is the first revealed by Load more.
    renderPanel(Array.from({ length: 8 }, (_, i) => makeReview(i + 1)))

    await user.click(screen.getByRole('button', { name: /Load more reviews/ }))

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(8)
    // Without this, focus would stay on a button that has moved down the page.
    expect(items[5]).toHaveFocus()
  })

  it('returns focus to the star picker when submitting without a rating', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Submit Review' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please select a rating.')
    expect(star(1)).toHaveFocus()
    expect(createReview).not.toHaveBeenCalled()
  })

  it('keeps focus on the chosen star after clicking it', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(star(3))
    expect(star(3)).toHaveFocus()
  })
})

// ─── Live regions ─────────────────────────────────────────────────────────────

describe('ReviewsSection — live announcements', () => {
  it('announces the result count when a rating filter is applied', async () => {
    const user = userEvent.setup()
    getWorkerReviews.mockResolvedValue({ data: [makeReview(9, 5), makeReview(10, 5)] })
    const { container } = renderPanel()

    await user.click(screen.getByRole('button', { name: /Filter by 5 stars/ }))

    await waitFor(() =>
      expect(liveRegion(container)).toHaveTextContent('Showing 2 5-star reviews.'),
    )
  })

  it('announces when the filter is cleared', async () => {
    const user = userEvent.setup()
    const { container } = renderPanel()

    const filter = screen.getByRole('button', { name: /Filter by 5 stars/ })
    await user.click(filter)
    await waitFor(() => expect(getWorkerReviews).toHaveBeenCalled())
    await settled()
    await user.click(filter)

    await waitFor(() =>
      expect(liveRegion(container)).toHaveTextContent('Rating filter cleared. Showing all reviews.'),
    )
  })

  it('announces a sort change', async () => {
    const user = userEvent.setup()
    const { container } = renderPanel()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort reviews' }), 'highest')

    await waitFor(() =>
      expect(liveRegion(container)).toHaveTextContent('Reviews sorted by highest rated first.'),
    )
  })

  it('announces a failed filter request instead of failing silently', async () => {
    const user = userEvent.setup()
    getWorkerReviews.mockRejectedValue(new Error('network'))
    const { container } = renderPanel()

    await user.click(screen.getByRole('button', { name: /Filter by 5 stars/ }))

    await waitFor(() =>
      expect(liveRegion(container)).toHaveTextContent(
        'Could not load filtered reviews. Showing all reviews.',
      ),
    )
  })

  it('announces a successfully posted review', async () => {
    const user = userEvent.setup()
    const { container } = renderPanel()

    await user.click(star(5))
    await user.click(screen.getByRole('button', { name: 'Submit Review' }))

    await waitFor(() => expect(liveRegion(container)).toHaveTextContent('Your review was posted.'))
  })

  it('exposes the filter loading state as a status region', async () => {
    const user = userEvent.setup()
    let resolve: (v: unknown) => void = () => {}
    getWorkerReviews.mockReturnValue(new Promise((r) => { resolve = r }))
    renderPanel()

    await user.click(screen.getByRole('button', { name: /Filter by 5 stars/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Loading reviews…')

    // Settle the request; react-query notifies observers a tick after the
    // promise resolves, so wait rather than asserting immediately.
    resolve({ data: [] })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})

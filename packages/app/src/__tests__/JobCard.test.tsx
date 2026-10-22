/**
 * JobCard — accessibility regression tests.
 *
 * Runs axe-core (WCAG 2.1 AA + best-practice) over the card in several shapes,
 * and asserts the keyboard/focus and screen-reader affordances added for #971.
 *
 * Note: axe's colour-contrast rule cannot run under jsdom — no layout, and
 * vitest is configured with `css: false` so the Tailwind classes never resolve.
 * The contrast fixes in this component are verified by the Playwright a11y
 * suite (`e2e/a11y/`), which runs against a real browser.
 *
 * Closes #971
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import axe from 'axe-core'
import JobCard, { URGENCY_LABEL } from '@/components/JobCard'
import type { Job } from '@/types'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Replace every lucide export with a decorative icon, keeping the real export
// names so vitest can validate the named imports.
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const Icon = ({ 'aria-hidden': hidden }: React.AriaAttributes) => (
    <span aria-hidden={hidden ?? true} />
  )
  const mock: Record<string, unknown> = {}
  for (const key of Object.keys(actual)) {
    mock[key] = typeof actual[key] === 'function' ? Icon : actual[key]
  }
  return mock
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const IN_TEN_DAYS = new Date(Date.now() + 10 * 86_400_000).toISOString()

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    title: 'Fix a leaking kitchen sink',
    description: 'Kitchen sink has been dripping for a week and needs a new washer.',
    budget: 25000,
    skills: ['Plumbing', 'Pipe fitting'],
    urgency: 'urgent',
    status: 'open',
    expiresAt: IN_TEN_DAYS,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    category: { id: 'c1', name: 'Plumbing' },
    postedBy: { id: 'u1', firstName: 'Ada', lastName: 'Obi' },
    _count: { applications: 3, messages: 0 },
    ...overrides,
  } as Job
}

// jsdom has no canvas; axe probes it while attempting colour-contrast checks.
beforeAll(() => {
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = vi.fn() as unknown as typeof HTMLCanvasElement.prototype.getContext
  }
})

// ─── axe helpers ──────────────────────────────────────────────────────────────

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

async function expectNoViolations(ui: React.ReactElement) {
  const { container } = render(ui)
  const violations = await runAxe(container)
  expect(violations, formatViolations(violations)).toHaveLength(0)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('JobCard — axe', () => {
  it('has no violations for a fully populated job', async () => {
    await expectNoViolations(<JobCard job={makeJob()} />)
  })

  it('has no violations when budget, skills and expiry are absent', async () => {
    await expectNoViolations(
      <JobCard job={makeJob({ budget: null, skills: [], expiresAt: null, _count: undefined })} />,
    )
  })

  it('has no violations when the skill list overflows', async () => {
    await expectNoViolations(
      <JobCard
        job={makeJob({ skills: ['Plumbing', 'Welding', 'Tiling', 'Painting', 'Roofing', 'Wiring'] })}
      />,
    )
  })

  it('has no violations inside the list wrapper the jobs page renders', async () => {
    await expectNoViolations(
      <ul aria-label="Job listings">
        <li>
          <JobCard job={makeJob()} />
        </li>
        <li>
          <JobCard job={makeJob({ id: 'j2', title: 'Rewire a bedroom', urgency: 'low' })} />
        </li>
      </ul>,
    )
  })
})

describe('JobCard — semantics and ARIA', () => {
  it('exposes the card as an article named by its heading', () => {
    render(<JobCard job={makeJob()} />)
    const article = screen.getByRole('article', { name: 'Fix a leaking kitchen sink' })
    expect(within(article).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Fix a leaking kitchen sink',
    )
  })

  it('links to the job detail page', () => {
    render(<JobCard job={makeJob()} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/jobs/j1')
  })

  it('renders the skills as a labelled list', () => {
    render(<JobCard job={makeJob()} />)
    const list = screen.getByRole('list', { name: 'Skills required' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })

  it('announces overflowing skills instead of a bare "+N"', () => {
    render(
      <JobCard
        job={makeJob({ skills: ['Plumbing', 'Welding', 'Tiling', 'Painting', 'Roofing', 'Wiring'] })}
      />,
    )
    const list = screen.getByRole('list', { name: 'Skills required' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(within(list).getByText('and 2 more')).toBeInTheDocument()
  })

  it('gives the urgency chip and byline screen-reader context', () => {
    render(<JobCard job={makeJob()} />)
    const article = screen.getByRole('article')
    expect(article).toHaveTextContent('Urgency: Urgent')
    expect(article).toHaveTextContent('Posted by Ada Obi')
    expect(article).toHaveTextContent('in Plumbing')
  })

  it('labels the numeric budget', () => {
    render(<JobCard job={makeJob()} />)
    expect(screen.getByRole('article')).toHaveTextContent('Budget: 25,000')
  })

  it('pluralises the applicant count', () => {
    const { unmount } = render(<JobCard job={makeJob({ _count: { applications: 1, messages: 0 } })} />)
    expect(screen.getByRole('article')).toHaveTextContent('1 applicant')
    unmount()

    render(<JobCard job={makeJob({ _count: undefined })} />)
    expect(screen.getByRole('article')).toHaveTextContent('0 applicants')
  })

  it('renders every decorative icon as aria-hidden', () => {
    const { container } = render(<JobCard job={makeJob()} />)
    const spans = container.querySelectorAll('span[aria-hidden]')
    expect(spans.length).toBeGreaterThan(0)
    for (const span of spans) expect(span).toHaveAttribute('aria-hidden', 'true')
  })

  it('falls back to the default urgency style for unknown values', () => {
    render(<JobCard job={makeJob({ urgency: 'whenever' as Job['urgency'] })} />)
    expect(screen.getByRole('article')).toHaveTextContent('Urgency: Normal')
    expect(URGENCY_LABEL.normal?.label).toBe('Normal')
  })
})

describe('JobCard — keyboard navigation and focus', () => {
  it('reaches the card link with a single Tab and shows a focus ring', async () => {
    const user = userEvent.setup()
    render(<JobCard job={makeJob()} />)

    await user.tab()

    const link = screen.getByRole('link')
    expect(link).toHaveFocus()
    expect(link.className).toContain('focus-visible:ring-2')
  })

  it('exposes exactly one tab stop per card, in DOM order', async () => {
    const user = userEvent.setup()
    render(
      <ul aria-label="Job listings">
        <li>
          <JobCard job={makeJob()} />
        </li>
        <li>
          <JobCard job={makeJob({ id: 'j2', title: 'Rewire a bedroom' })} />
        </li>
      </ul>,
    )

    const [first, second] = screen.getAllByRole('link')

    await user.tab()
    expect(first).toHaveFocus()
    await user.tab()
    expect(second).toHaveFocus()
    await user.tab()
    expect(document.body).toHaveFocus()
  })

  it('does not add non-interactive elements to the tab order', () => {
    const { container } = render(<JobCard job={makeJob()} />)
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0)
  })
})

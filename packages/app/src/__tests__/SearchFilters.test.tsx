/**
 * Unit tests for the search-filters surface:
 *   - Filters/FilterPanel      (category + location controls, reset, loading)
 *   - Filters/ActiveFilters    (chips for the currently applied filters)
 *   - Filters/MobileFilterSheet(the < lg breakpoint sheet wrapping FilterPanel)
 *   - Search/SearchInput       (the query box the filters sit next to)
 *
 * Plus an integration pass over WorkersDiscovery with `@/lib/api` mocked, which
 * exercises the loading / error / empty / populated states the filters render
 * inside.
 *
 * Closes #970
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import messages from '@/messages/en.json'
import FilterPanel, { EMPTY_FILTERS, type FilterValues } from '@/components/Filters/FilterPanel'
import ActiveFilters from '@/components/Filters/ActiveFilters'
import MobileFilterSheet from '@/components/Filters/MobileFilterSheet'
import SearchInput from '@/components/Search/SearchInput'
import type { Category } from '@/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Resolve real copy from the en locale so assertions match what users see.
// ICU plural strings (e.g. workersDiscovery.resultsFound) are returned raw and
// are deliberately not asserted on.
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const raw: string =
      (messages as Record<string, Record<string, string>>)[namespace]?.[key] ??
      `${namespace}.${key}`
    if (!params) return raw
    return Object.entries(params).reduce(
      (acc, [name, value]) => acc.split(`{${name}}`).join(String(value)),
      raw,
    )
  },
}))

// Replace every lucide export with a decorative icon, keeping the real export
// names so vitest can validate the named imports.
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const Icon = () => <span aria-hidden="true" />
  const mock: Record<string, unknown> = {}
  for (const key of Object.keys(actual)) {
    mock[key] = typeof actual[key] === 'function' ? Icon : actual[key]
  }
  return mock
})

const mockReplace = vi.fn()
// Stable identities: WorkersDiscovery memoises on `router`, so a fresh object
// per call would re-fire its fetch effect on every render.
const mockRouter = { replace: mockReplace, push: vi.fn(), prefetch: vi.fn() }
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}))

const mockGetWorkers = vi.fn()
const mockGetCategories = vi.fn()
vi.mock('@/lib/api', () => ({
  getWorkers: (...args: unknown[]) => mockGetWorkers(...args),
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Plumbing', slug: 'plumbing' } as Category,
  { id: 'c2', name: 'Electrical', slug: 'electrical' } as Category,
]

const APPLIED: FilterValues = { category: 'c1', city: 'Lagos', state: 'Lagos State' }

function renderPanel(overrides: Partial<React.ComponentProps<typeof FilterPanel>> = {}) {
  const props = {
    filters: EMPTY_FILTERS,
    categories: CATEGORIES,
    onChange: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  }
  return { ...render(<FilterPanel {...props} />), props }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── FilterPanel ──────────────────────────────────────────────────────────────

describe('FilterPanel', () => {
  it('renders the heading and both fieldset legends', () => {
    renderPanel()
    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
  })

  it('renders an "All categories" option plus one radio per category', () => {
    renderPanel()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(CATEGORIES.length + 1)
    expect(screen.getByRole('radio', { name: 'All categories' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Plumbing' })).not.toBeChecked()
  })

  it('renders the empty state when no categories have loaded yet', () => {
    renderPanel({ categories: [] })
    expect(screen.getAllByRole('radio')).toHaveLength(1)
    expect(screen.getByRole('radio', { name: 'All categories' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'Plumbing' })).not.toBeInTheDocument()
  })

  it('marks the selected category as checked', () => {
    renderPanel({ filters: { ...EMPTY_FILTERS, category: 'c2' } })
    expect(screen.getByRole('radio', { name: 'Electrical' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'All categories' })).not.toBeChecked()
  })

  it('emits the full filter object when a category is picked', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel({ filters: { ...EMPTY_FILTERS, city: 'Abuja' } })

    await user.click(screen.getByRole('radio', { name: 'Plumbing' }))

    expect(props.onChange).toHaveBeenCalledWith({ category: 'c1', city: 'Abuja', state: '' })
  })

  it('emits a cleared category when "All categories" is picked', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel({ filters: { ...EMPTY_FILTERS, category: 'c1' } })

    await user.click(screen.getByRole('radio', { name: 'All categories' }))

    expect(props.onChange).toHaveBeenCalledWith({ category: '', city: '', state: '' })
  })

  it('emits on each keystroke in the city and state inputs', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel()

    await user.type(screen.getByPlaceholderText('City...'), 'A')
    await user.type(screen.getByPlaceholderText('State / Region...'), 'B')

    expect(props.onChange).toHaveBeenNthCalledWith(1, { category: '', city: 'A', state: '' })
    expect(props.onChange).toHaveBeenNthCalledWith(2, { category: '', city: '', state: 'B' })
  })

  it('reflects the city and state values it is given', () => {
    renderPanel({ filters: APPLIED })
    expect(screen.getByPlaceholderText('City...')).toHaveValue('Lagos')
    expect(screen.getByPlaceholderText('State / Region...')).toHaveValue('Lagos State')
  })

  it('hides "Clear all" until at least one filter is active', () => {
    const { unmount } = renderPanel()
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument()
    unmount()

    renderPanel({ filters: { ...EMPTY_FILTERS, state: 'Kano' } })
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument()
  })

  it('calls onReset when "Clear all" is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel({ filters: APPLIED })

    await user.click(screen.getByRole('button', { name: 'Clear all' }))

    expect(props.onReset).toHaveBeenCalledOnce()
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it('disables every control while loading', () => {
    renderPanel({ loading: true })
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.getByPlaceholderText('City...')).toBeDisabled()
    expect(screen.getByPlaceholderText('State / Region...')).toBeDisabled()
  })

  it('leaves controls enabled when loading is false or omitted', () => {
    renderPanel({ loading: false })
    expect(screen.getByRole('radio', { name: 'All categories' })).toBeEnabled()
    expect(screen.getByPlaceholderText('City...')).toBeEnabled()
  })

  it('exports EMPTY_FILTERS with every key blank', () => {
    expect(EMPTY_FILTERS).toEqual({ category: '', city: '', state: '' })
  })
})

// ─── ActiveFilters ────────────────────────────────────────────────────────────

describe('ActiveFilters', () => {
  const baseProps = {
    filters: EMPTY_FILTERS,
    search: '',
    categories: CATEGORIES,
    onRemoveFilter: vi.fn(),
    onClearSearch: vi.fn(),
  }

  it('renders nothing when no filter or search is applied', () => {
    const { container } = render(<ActiveFilters {...baseProps} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one chip per applied filter plus the search term', () => {
    render(<ActiveFilters {...baseProps} filters={APPLIED} search="welder" />)

    expect(screen.getByText('Search: "welder"')).toBeInTheDocument()
    expect(screen.getByText('Category: Plumbing')).toBeInTheDocument()
    expect(screen.getByText('City: Lagos')).toBeInTheDocument()
    expect(screen.getByText('State: Lagos State')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('falls back to the raw id when the category is not in the list', () => {
    render(<ActiveFilters {...baseProps} filters={{ ...EMPTY_FILTERS, category: 'unknown-id' }} />)
    expect(screen.getByText('Category: unknown-id')).toBeInTheDocument()
  })

  it('gives every remove control an accessible name', () => {
    render(<ActiveFilters {...baseProps} filters={{ ...EMPTY_FILTERS, city: 'Lagos' }} />)
    expect(
      screen.getByRole('button', { name: 'Remove filter: City: Lagos' }),
    ).toBeInTheDocument()
  })

  it('routes each chip to the right handler', async () => {
    const user = userEvent.setup()
    const onRemoveFilter = vi.fn()
    const onClearSearch = vi.fn()
    render(
      <ActiveFilters
        {...baseProps}
        filters={APPLIED}
        search="welder"
        onRemoveFilter={onRemoveFilter}
        onClearSearch={onClearSearch}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Remove filter: Search: "welder"' }))
    await user.click(screen.getByRole('button', { name: 'Remove filter: Category: Plumbing' }))
    await user.click(screen.getByRole('button', { name: 'Remove filter: City: Lagos' }))
    await user.click(screen.getByRole('button', { name: 'Remove filter: State: Lagos State' }))

    expect(onClearSearch).toHaveBeenCalledOnce()
    expect(onRemoveFilter.mock.calls).toEqual([['category'], ['city'], ['state']])
  })
})

// ─── MobileFilterSheet ────────────────────────────────────────────────────────

describe('MobileFilterSheet', () => {
  const baseProps = {
    filters: EMPTY_FILTERS,
    categories: CATEGORIES,
    onChange: vi.fn(),
    onReset: vi.fn(),
  }

  it('renders a trigger with no badge when nothing is applied', () => {
    render(<MobileFilterSheet {...baseProps} />)
    const trigger = screen.getByRole('button', { name: /filters/i })
    expect(trigger).toBeInTheDocument()
    expect(trigger).not.toHaveTextContent(/\d/)
  })

  it('badges the trigger with the number of applied filters', () => {
    render(<MobileFilterSheet {...baseProps} filters={APPLIED} />)
    expect(screen.getByRole('button', { name: /filters/i })).toHaveTextContent('3')
  })

  it('opens a labelled dialog containing the filter panel', async () => {
    const user = userEvent.setup()
    render(<MobileFilterSheet {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /filters/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Filter Workers')).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'Plumbing' })).toBeInTheDocument()
  })

  it('forwards the loading prop down to the panel', async () => {
    const user = userEvent.setup()
    render(<MobileFilterSheet {...baseProps} loading />)

    await user.click(screen.getByRole('button', { name: /filters/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: 'All categories' })).toBeDisabled()
  })

  it('forwards panel changes to onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MobileFilterSheet {...baseProps} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /filters/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: 'Electrical' }))

    expect(onChange).toHaveBeenCalledWith({ category: 'c2', city: '', state: '' })
  })

  it('closes when "Show Results" is pressed', async () => {
    const user = userEvent.setup()
    render(<MobileFilterSheet {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /filters/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Show Results' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

// ─── SearchInput ──────────────────────────────────────────────────────────────

describe('SearchInput', () => {
  it('renders a labelled search box with the default placeholder', () => {
    render(<SearchInput value="" onChange={vi.fn()} />)
    const input = screen.getByRole('searchbox', { name: 'Search workers' })
    expect(input).toHaveAttribute('placeholder', 'Search workers by name or skill...')
  })

  it('prefers an explicit placeholder over the translated default', () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Find a welder" />)
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Find a welder')
  })

  it('emits each keystroke', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} />)

    await user.type(screen.getByRole('searchbox'), 'we')

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('e')
  })

  it('shows the clear button only when there is a value, and clears on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { unmount } = render(<SearchInput value="" onChange={onChange} />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    unmount()

    render(<SearchInput value="welder" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})

// ─── Integration: filters against mocked API responses ────────────────────────

describe('Search filters against mocked API responses', () => {
  async function renderDiscovery() {
    const { default: WorkersDiscovery } = await import('@/components/WorkersDiscovery')
    return render(<WorkersDiscovery />)
  }

  it('shows the loading state while workers are in flight', async () => {
    mockGetCategories.mockResolvedValue({ data: CATEGORIES })
    mockGetWorkers.mockReturnValue(new Promise(() => {}))

    const { container } = await renderDiscovery()

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    // Filters stay mounted but disabled while results load.
    await waitFor(() =>
      expect(screen.getAllByRole('radio', { name: 'All categories' })[0]).toBeDisabled(),
    )
  })

  it('renders the empty state when the API returns no workers', async () => {
    mockGetCategories.mockResolvedValue({ data: CATEGORIES })
    mockGetWorkers.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pages: 0, limit: 20 } })

    await renderDiscovery()

    expect(await screen.findByText('No workers found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument()
  })

  it('renders the error state when the API rejects', async () => {
    mockGetCategories.mockResolvedValue({ data: CATEGORIES })
    mockGetWorkers.mockRejectedValue(new Error('Network down'))

    await renderDiscovery()

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Network down')).toBeInTheDocument()
  })

  it('populates the category filter from the mocked categories response', async () => {
    mockGetCategories.mockResolvedValue({ data: CATEGORIES })
    mockGetWorkers.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pages: 0, limit: 20 } })

    await renderDiscovery()

    expect(await screen.findByRole('radio', { name: 'Plumbing' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Electrical' })).toBeInTheDocument()
  })

  it('re-queries the API and shows a chip when a category is selected', async () => {
    const user = userEvent.setup()
    mockGetCategories.mockResolvedValue({ data: CATEGORIES })
    mockGetWorkers.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pages: 0, limit: 20 } })

    await renderDiscovery()

    await user.click(await screen.findByRole('radio', { name: 'Plumbing' }))

    await waitFor(() =>
      expect(mockGetWorkers).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'c1', page: '1', limit: '20' }),
      ),
    )
    expect(await screen.findByText('Category: Plumbing')).toBeInTheDocument()
  })

  it('drops the category param again when the chip is removed', async () => {
    const user = userEvent.setup()
    mockGetCategories.mockResolvedValue({ data: CATEGORIES })
    mockGetWorkers.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pages: 0, limit: 20 } })

    await renderDiscovery()

    await user.click(await screen.findByRole('radio', { name: 'Plumbing' }))
    await screen.findByText('Category: Plumbing')

    await user.click(screen.getByRole('button', { name: 'Remove filter: Category: Plumbing' }))

    await waitFor(() =>
      expect(mockGetWorkers).toHaveBeenLastCalledWith({ page: '1', limit: '20' }),
    )
  })

  it('survives a failed categories request and still renders the panel', async () => {
    mockGetCategories.mockRejectedValue(new Error('categories unavailable'))
    mockGetWorkers.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pages: 0, limit: 20 } })

    await renderDiscovery()

    expect(await screen.findByText('No workers found')).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { name: 'All categories' })[0]).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Plumbing' })).not.toBeInTheDocument()
  })
})

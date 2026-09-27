/**
 * DiscoveryScreen unit tests (#1040)
 *
 * Covers:
 * - Initial loading state
 * - Successful data render
 * - Error state (no cache)
 * - Cache indicator display (isFromCache)
 * - Refreshing indicator
 * - Empty worker list
 * - Worker card field rendering (name, category, location, rating)
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

// ── Mock StaleWhileRevalidate hook ──────────────────────────────────────────
jest.mock('../../../cache', () => ({
  useStaleWhileRevalidate: jest.fn(),
}))

// ── Mock API ────────────────────────────────────────────────────────────────
jest.mock('../../../lib/api', () => ({
  workersApi: {
    getAll: jest.fn(),
  },
}))

// ── Mock expo modules ───────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

const { useStaleWhileRevalidate } = require('../../../cache')

// Default factory — renders happy-path state
function mockHook(overrides: Partial<ReturnType<typeof useStaleWhileRevalidate>> = {}) {
  ;(useStaleWhileRevalidate as jest.Mock).mockReturnValue({
    data: null,
    isLoading: false,
    isFromCache: false,
    isRefreshing: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isStale: false,
    ...overrides,
  })
}

// Import after mocks are set up
let DiscoveryScreen: React.ComponentType
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DiscoveryScreen = require('../index').default
})

const sampleWorkers = [
  {
    id: 'w1',
    name: 'Alice Smith',
    category: 'Plumber',
    location: 'Lagos',
    rating: 4.7,
    reviewCount: 23,
  },
  {
    id: 'w2',
    name: 'Bob Jones',
    category: 'Electrician',
    location: 'Abuja',
    rating: 4.2,
    reviewCount: 8,
  },
]

describe('DiscoveryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHook()
  })

  // ─── Loading state ────────────────────────────────────────────────────────
  it('renders a loading spinner when isLoading and no cache', () => {
    mockHook({ isLoading: true, isFromCache: false })
    const { getByText, UNSAFE_getByType } = render(<DiscoveryScreen />)
    const ActivityIndicator = require('react-native').ActivityIndicator
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
    expect(getByText(/Loading workers/)).toBeTruthy()
  })

  it('does not render loading spinner when data comes from cache (stale-while-revalidate)', () => {
    mockHook({ isLoading: true, isFromCache: true, data: sampleWorkers })
    const { queryByText } = render(<DiscoveryScreen />)
    expect(queryByText(/Loading workers/)).toBeNull()
  })

  // ─── Error state ──────────────────────────────────────────────────────────
  it('shows an error message when fetch fails and there is no cached data', () => {
    mockHook({ isError: true, data: null, error: new Error('Network timeout') })
    const { getByText } = render(<DiscoveryScreen />)
    expect(getByText(/Network timeout/)).toBeTruthy()
  })

  it('does not show error UI when there is stale cached data despite an error', () => {
    mockHook({ isError: true, data: sampleWorkers, error: new Error('Stale error') })
    const { queryByText } = render(<DiscoveryScreen />)
    expect(queryByText(/Stale error/)).toBeNull()
  })

  // ─── Success / worker list ────────────────────────────────────────────────
  it('renders all worker cards with correct names', async () => {
    mockHook({ data: sampleWorkers })
    const { findAllByText, getByText } = render(<DiscoveryScreen />)
    await waitFor(() => {
      expect(getByText('Alice Smith')).toBeTruthy()
      expect(getByText('Bob Jones')).toBeTruthy()
    })
    const cards = await findAllByText(/Plumber|Electrician/)
    expect(cards.length).toBeGreaterThanOrEqual(2)
  })

  it('displays category, location, rating, and review count for each card', async () => {
    mockHook({ data: [sampleWorkers[0]] })
    const { getByText } = render(<DiscoveryScreen />)
    await waitFor(() => {
      expect(getByText(/Plumber.*Lagos|Lagos.*Plumber/)).toBeTruthy()
      expect(getByText(/4\.7/)).toBeTruthy()
      expect(getByText(/23/)).toBeTruthy()
    })
  })

  it('renders "Discover Workers" title', () => {
    mockHook({ data: sampleWorkers })
    const { getByText } = render(<DiscoveryScreen />)
    expect(getByText('Discover Workers')).toBeTruthy()
  })

  it('renders an empty FlatList without crashing when data is an empty array', () => {
    mockHook({ data: [] })
    const { getByText, queryByText } = render(<DiscoveryScreen />)
    expect(getByText('Discover Workers')).toBeTruthy()
    expect(queryByText(/Loading workers/)).toBeNull()
    expect(queryByText(/Error:/)).toBeNull()
  })

  // ─── Cache indicator ──────────────────────────────────────────────────────
  it('shows "From cache" badge when data comes from cache and is not refreshing', () => {
    mockHook({ data: sampleWorkers, isFromCache: true, isRefreshing: false })
    const { getByText } = render(<DiscoveryScreen />)
    expect(getByText(/From cache/i)).toBeTruthy()
  })

  it('shows "Updating…" badge when data is from cache and actively refreshing', () => {
    mockHook({ data: sampleWorkers, isFromCache: true, isRefreshing: true })
    const { getByText } = render(<DiscoveryScreen />)
    expect(getByText(/Updating/i)).toBeTruthy()
  })

  it('does not show cache badge when data is fresh', () => {
    mockHook({ data: sampleWorkers, isFromCache: false })
    const { queryByText } = render(<DiscoveryScreen />)
    expect(queryByText(/From cache/i)).toBeNull()
    expect(queryByText(/Updating/i)).toBeNull()
  })

  // ─── Null / undefined data ────────────────────────────────────────────────
  it('renders without crashing when data is null (initial state before load)', () => {
    mockHook({ data: null, isLoading: false })
    const { getByText } = render(<DiscoveryScreen />)
    expect(getByText('Discover Workers')).toBeTruthy()
  })
})

/**
 * HomeScreen unit tests (#1040)
 *
 * Covers:
 * - Greeting renders user's first name
 * - Quick-action tiles are present and pressable
 * - Workers loading state
 * - Workers error state
 * - Workers empty state
 * - Workers list render
 * - Pending requests badge
 * - Unauthenticated fallback greeting
 */
import React from 'react'
import { render, waitFor, fireEvent } from '@testing-library/react-native'

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../../cache', () => ({
  useStaleWhileRevalidate: jest.fn(),
}))

jest.mock('../../../lib/api', () => ({
  workersApi: { getAll: jest.fn() },
  contactRequestsApi: { getMyRequests: jest.fn() },
}))

const { useAuth } = require('../../../context/AuthContext')
const { useStaleWhileRevalidate } = require('../../../cache')

// ── Helpers ────────────────────────────────────────────────────────────────────
const defaultUser = {
  id: 'u1',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  role: 'user',
}

const sampleWorkers = [
  { id: 'w1', name: 'Alice Smith', category: 'Plumber', location: 'Lagos' },
  { id: 'w2', name: 'Bob Jones', category: 'Electrician', location: 'Abuja' },
]

function mockHook(workers: object, requests: object) {
  let callCount = 0
  ;(useStaleWhileRevalidate as jest.Mock).mockImplementation(() => {
    callCount++
    return callCount === 1 ? workers : requests
  })
}

const defaultWorkers = { data: sampleWorkers, isLoading: false, isError: false }
const defaultRequests = { data: [], isLoading: false }

let HomeScreen: React.ComponentType<any>

beforeAll(() => {
  HomeScreen = require('../HomeScreen').default
})

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({ user: defaultUser })
    mockHook(defaultWorkers, defaultRequests)
  })

  // ── Greeting ─────────────────────────────────────────────────────────────
  it('renders personalised greeting with the user first name', () => {
    const { getByTestId } = render(<HomeScreen />)
    expect(getByTestId('greeting-text').props.children).toContain('Jane')
  })

  it('falls back to "there" when user is null', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ user: null })
    const { getByTestId } = render(<HomeScreen />)
    expect(getByTestId('greeting-text').props.children).toContain('there')
  })

  // ── Quick actions ─────────────────────────────────────────────────────────
  it('renders all three quick-action tiles', () => {
    const { getByTestId } = render(<HomeScreen />)
    expect(getByTestId('discover-tile')).toBeTruthy()
    expect(getByTestId('profile-tile')).toBeTruthy()
    expect(getByTestId('wallet-tile')).toBeTruthy()
  })

  it('calls onNavigateToDiscovery when the Discover tile is pressed', () => {
    const onDiscover = jest.fn()
    const { getByTestId } = render(<HomeScreen onNavigateToDiscovery={onDiscover} />)
    fireEvent.press(getByTestId('discover-tile'))
    expect(onDiscover).toHaveBeenCalledTimes(1)
  })

  it('calls onNavigateToProfile when the Profile tile is pressed', () => {
    const onProfile = jest.fn()
    const { getByTestId } = render(<HomeScreen onNavigateToProfile={onProfile} />)
    fireEvent.press(getByTestId('profile-tile'))
    expect(onProfile).toHaveBeenCalledTimes(1)
  })

  it('calls onNavigateToWallet when the Wallet tile is pressed', () => {
    const onWallet = jest.fn()
    const { getByTestId } = render(<HomeScreen onNavigateToWallet={onWallet} />)
    fireEvent.press(getByTestId('wallet-tile'))
    expect(onWallet).toHaveBeenCalledTimes(1)
  })

  // ── Workers loading ───────────────────────────────────────────────────────
  it('shows a loading spinner while workers are being fetched', () => {
    mockHook({ data: null, isLoading: true, isError: false }, defaultRequests)
    const { getByTestId } = render(<HomeScreen />)
    expect(getByTestId('workers-loading')).toBeTruthy()
  })

  // ── Workers error ─────────────────────────────────────────────────────────
  it('shows an error message when workers fetch fails', async () => {
    mockHook({ data: null, isLoading: false, isError: true }, defaultRequests)
    const { getByTestId } = render(<HomeScreen />)
    await waitFor(() => expect(getByTestId('workers-error')).toBeTruthy())
  })

  // ── Workers empty ─────────────────────────────────────────────────────────
  it('shows empty-state when worker list is empty', async () => {
    mockHook({ data: [], isLoading: false, isError: false }, defaultRequests)
    const { getByTestId } = render(<HomeScreen />)
    await waitFor(() => expect(getByTestId('workers-empty')).toBeTruthy())
  })

  // ── Workers list ──────────────────────────────────────────────────────────
  it('renders worker names in the list', async () => {
    const { getByText } = render(<HomeScreen />)
    await waitFor(() => {
      expect(getByText('Alice Smith')).toBeTruthy()
      expect(getByText('Bob Jones')).toBeTruthy()
    })
  })

  it('renders worker row testIDs for each worker', () => {
    const { getByTestId } = render(<HomeScreen />)
    expect(getByTestId('worker-row-w1')).toBeTruthy()
    expect(getByTestId('worker-row-w2')).toBeTruthy()
  })

  // ── Pending requests badge ────────────────────────────────────────────────
  it('shows pending-requests badge when there are open requests', async () => {
    mockHook(defaultWorkers, { data: [{ id: 'r1' }, { id: 'r2' }], isLoading: false })
    const { getByTestId } = render(<HomeScreen />)
    await waitFor(() => expect(getByTestId('pending-requests')).toBeTruthy())
  })

  it('does not show pending-requests badge when requests list is empty', () => {
    const { queryByTestId } = render(<HomeScreen />)
    expect(queryByTestId('pending-requests')).toBeNull()
  })

  // ── Home screen container ─────────────────────────────────────────────────
  it('renders the home-screen root testID', () => {
    const { getByTestId } = render(<HomeScreen />)
    expect(getByTestId('home-screen')).toBeTruthy()
  })
})

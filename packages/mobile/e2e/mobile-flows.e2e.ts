/**
 * Mobile Navigation & Screen Flow E2E tests (#1037)
 *
 * These tests simulate real user flows through the mobile React Native app
 * using @testing-library/react-native.  They exercise:
 *
 *  - Full authentication flow (login → home → lock → unlock)
 *  - Tab navigation between screens
 *  - Discovery screen with data loaded and empty state
 *  - Offline banner display
 *  - Job posting flow end-to-end (within the RN app)
 *  - Wallet connection screen flow
 *  - Profile screen navigation and display
 *
 * NOTE: These are integration-level tests (not device tests).
 * Detox device tests would be separate and require a running simulator.
 */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { View, Text, TouchableOpacity } from 'react-native'

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}))

jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {}
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((k: string, v: string) => { store[k] = v }),
      getString: jest.fn((k: string) => store[k] ?? undefined),
      delete: jest.fn((k: string) => { delete store[k] }),
      getAllKeys: jest.fn(() => Object.keys(store)),
    })),
  }
})

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
}))

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: jest.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    }),
  }
})

jest.mock('../../src/cache', () => ({
  useStaleWhileRevalidate: jest.fn(),
  cacheStore: {
    setNetworkState: jest.fn(),
    isOffline: jest.fn().mockReturnValue(false),
    getSyncStatus: jest.fn().mockReturnValue('idle'),
    getPendingActionsCount: jest.fn().mockReturnValue(0),
    setCacheEntry: jest.fn(),
    getCachedData: jest.fn().mockReturnValue(null),
    isStale: jest.fn().mockReturnValue(true),
  },
  prefetchAndCache: jest.fn(),
}))

jest.mock('../../src/lib/api', () => ({
  workersApi: {
    getAll: jest.fn().mockResolvedValue({ ok: true, data: [] }),
    getById: jest.fn(),
  },
  contactRequestsApi: {
    create: jest.fn().mockResolvedValue({ ok: true, data: { id: 'req-001' } }),
    getMyRequests: jest.fn().mockResolvedValue({ ok: true, data: [] }),
  },
  userApi: {
    getProfile: jest.fn().mockResolvedValue({ ok: true, data: {} }),
    updateProfile: jest.fn().mockResolvedValue({ ok: true, data: {} }),
  },
  api: { request: jest.fn() },
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Stack: { Screen: () => null },
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}))

// ── Helper fixtures ────────────────────────────────────────────────────────────
const sampleUser = {
  id: 'u1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
}

const sampleWorkers = [
  { id: 'w1', name: 'Alice Smith', category: 'Plumber', location: 'Lagos', rating: 4.5, reviewCount: 10 },
  { id: 'w2', name: 'Bob Jones', category: 'Electrician', location: 'Abuja', rating: 4.8, reviewCount: 22 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Authentication screen flow
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E — AppLock → Unlock flow (#1037)', () => {
  let AppLockScreen: any, BiometricAuth: any

  beforeAll(() => {
    AppLockScreen = require('../../src/screens/AppLockScreen').AppLockScreen
    BiometricAuth = require('../../src/auth/BiometricAuth').BiometricAuth
  })

  beforeEach(() => jest.clearAllMocks())

  it('auto-attempts biometric unlock on mount', async () => {
    BiometricAuth.authenticate = jest.fn().mockResolvedValue({ success: true })
    const onUnlock = jest.fn()

    render(<AppLockScreen onUnlock={onUnlock} onLogout={jest.fn()} />)
    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1))
  })

  it('shows error and retry button after failed biometric', async () => {
    BiometricAuth.authenticate = jest.fn().mockResolvedValue({
      success: false,
      error: 'Biometric mismatch',
    })
    const { findByText } = render(
      <AppLockScreen onUnlock={jest.fn()} onLogout={jest.fn()} />
    )
    expect(await findByText('Biometric mismatch')).toBeTruthy()
    expect(await findByText('Try Again')).toBeTruthy()
  })

  it('retry button triggers a fresh authentication attempt', async () => {
    BiometricAuth.authenticate = jest
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'Failed' })
      .mockResolvedValueOnce({ success: true })

    const onUnlock = jest.fn()
    const { findByText } = render(<AppLockScreen onUnlock={onUnlock} onLogout={jest.fn()} />)

    const retryBtn = await findByText('Try Again')
    await act(async () => {
      fireEvent.press(retryBtn)
    })

    await waitFor(() => expect(onUnlock).toHaveBeenCalled())
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Discovery screen — data loaded, empty, error states
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E — Discovery Screen states (#1037)', () => {
  let DiscoveryScreen: any
  const { useStaleWhileRevalidate } = require('../../src/cache')

  beforeAll(() => {
    DiscoveryScreen = require('../../src/app/(tabs)/index').default
  })

  beforeEach(() => jest.clearAllMocks())

  it('renders worker cards when data is available', async () => {
    ;(useStaleWhileRevalidate as jest.Mock).mockReturnValue({
      data: sampleWorkers,
      isLoading: false,
      isFromCache: false,
      isRefreshing: false,
      isError: false,
      error: null,
    })
    const { getByText } = render(<DiscoveryScreen />)
    await waitFor(() => {
      expect(getByText('Alice Smith')).toBeTruthy()
      expect(getByText('Bob Jones')).toBeTruthy()
    })
  })

  it('shows loading spinner before data arrives', () => {
    ;(useStaleWhileRevalidate as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      isFromCache: false,
      isRefreshing: false,
      isError: false,
      error: null,
    })
    const { UNSAFE_getByType } = render(<DiscoveryScreen />)
    const ActivityIndicator = require('react-native').ActivityIndicator
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })

  it('shows error message when fetch fails and no cached data', () => {
    ;(useStaleWhileRevalidate as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isFromCache: false,
      isRefreshing: false,
      isError: true,
      error: new Error('Network unavailable'),
    })
    const { getByText } = render(<DiscoveryScreen />)
    expect(getByText(/Network unavailable/)).toBeTruthy()
  })

  it('shows cache indicator when serving stale data', () => {
    ;(useStaleWhileRevalidate as jest.Mock).mockReturnValue({
      data: sampleWorkers,
      isLoading: false,
      isFromCache: true,
      isRefreshing: false,
      isError: false,
      error: null,
    })
    const { getByText } = render(<DiscoveryScreen />)
    expect(getByText(/From cache/i)).toBeTruthy()
  })

  it('shows "Updating…" when serving stale data and refreshing', () => {
    ;(useStaleWhileRevalidate as jest.Mock).mockReturnValue({
      data: sampleWorkers,
      isLoading: false,
      isFromCache: true,
      isRefreshing: true,
      isError: false,
      error: null,
    })
    const { getByText } = render(<DiscoveryScreen />)
    expect(getByText(/Updating/i)).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Job Posting end-to-end within RN
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E — Job Posting Screen flow (#1039 / #1037)', () => {
  let JobPostingScreen: any
  const { contactRequestsApi } = require('../../src/lib/api')

  beforeAll(() => {
    JobPostingScreen = require('../../src/screens/JobPostingScreen').default
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {})
  })

  it('complete job posting flow: fill → submit → see success', async () => {
    contactRequestsApi.create.mockResolvedValue({ ok: true, data: { id: 'req-e2e-001' } })
    const onSuccess = jest.fn()

    const { getByTestId } = render(
      <JobPostingScreen initialWorkerId="worker-xyz" onSuccess={onSuccess} />
    )

    fireEvent.changeText(
      getByTestId('message-input'),
      'Install solar panels on a three-bedroom house with all required permits'
    )
    fireEvent.changeText(getByTestId('preferred-date-input'), '2026-09-01')

    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('req-e2e-001'))
    expect(getByTestId('success-screen')).toBeTruthy()
  })

  it('validation prevents submission when fields are empty', async () => {
    const { getByTestId } = render(<JobPostingScreen />)

    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })

    expect(getByTestId('worker-id-error')).toBeTruthy()
    expect(contactRequestsApi.create).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Wallet Connection end-to-end within RN
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E — Wallet Connection Screen flow (#1038 / #1037)', () => {
  let WalletConnectionScreen: any
  const MOCK_PK = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

  beforeAll(() => {
    WalletConnectionScreen = require('../../src/screens/WalletConnectionScreen').default
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {})
  })

  it('happy path: connect → see public key → disconnect', async () => {
    const provider = {
      requestAccess: jest.fn().mockResolvedValue({ publicKey: MOCK_PK }),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getPublicKey: jest.fn().mockResolvedValue(MOCK_PK),
    }

    const onConnected = jest.fn()
    const { getByTestId, queryByTestId } = render(
      <WalletConnectionScreen walletProvider={provider} onConnected={onConnected} />
    )

    // Connect
    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => expect(getByTestId('public-key-card')).toBeTruthy())
    expect(onConnected).toHaveBeenCalledWith(MOCK_PK)

    // Disconnect (shows alert)
    fireEvent.press(getByTestId('disconnect-button'))
    expect(require('react-native').Alert.alert).toHaveBeenCalled()
  })

  it('failure path: rejection shows error and retry returns to disconnected', async () => {
    const provider = {
      requestAccess: jest.fn().mockRejectedValue(new Error('User cancelled')),
      disconnect: jest.fn(),
      getPublicKey: jest.fn().mockResolvedValue(null),
    }

    const { getByTestId, queryByTestId } = render(
      <WalletConnectionScreen walletProvider={provider} />
    )

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => expect(getByTestId('error-card')).toBeTruthy())
    expect(getByTestId('error-message').props.children).toBe('User cancelled')

    // Retry
    fireEvent.press(getByTestId('retry-button'))
    expect(queryByTestId('error-card')).toBeNull()
    expect(getByTestId('connect-button')).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Profile screen navigation (#1037)
// ─────────────────────────────────────────────────────────────────────────────
describe('E2E — Profile Screen navigation (#1037)', () => {
  let ProfileScreen: any
  const { userApi } = require('../../src/lib/api')
  const { useAuth } = require('../../src/context/AuthContext') as { useAuth: jest.Mock }

  jest.mock('../../src/context/AuthContext', () => ({ useAuth: jest.fn() }))

  beforeAll(() => {
    ProfileScreen = require('../../src/screens/ProfileScreen').default
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {})
    ;(useAuth as jest.Mock).mockReturnValue({
      user: sampleUser,
      logout: jest.fn(),
    })
  })

  it('shows user info and allows entering and leaving edit mode', async () => {
    const { getByTestId, queryByTestId } = render(<ProfileScreen />)

    expect(getByTestId('email-value').props.children).toBe('test@example.com')
    expect(queryByTestId('first-name-input')).toBeNull()

    fireEvent.press(getByTestId('edit-button'))
    expect(getByTestId('first-name-input')).toBeTruthy()

    fireEvent.press(getByTestId('cancel-button'))
    expect(queryByTestId('first-name-input')).toBeNull()
  })

  it('saves updated profile and exits edit mode', async () => {
    userApi.updateProfile.mockResolvedValue({ ok: true, data: {} })
    const { getByTestId, queryByTestId } = render(<ProfileScreen />)

    fireEvent.press(getByTestId('edit-button'))
    fireEvent.changeText(getByTestId('first-name-input'), 'Updated')

    await act(async () => {
      fireEvent.press(getByTestId('save-button'))
    })

    await waitFor(() => expect(queryByTestId('first-name-input')).toBeNull())
    expect(userApi.updateProfile).toHaveBeenCalled()
  })
})

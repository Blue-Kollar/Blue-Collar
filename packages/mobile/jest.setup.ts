/**
 * Jest global setup for @bluecollar/mobile
 *
 * Runs after the test framework is installed (setupFilesAfterFramework).
 * Provides blanket mocks for all native Expo modules so unit tests
 * never depend on a real device / simulator.
 */

import '@testing-library/react-native/extend-expect'

// ─────────────────────────────────────────────────────────────────────────────
// expo-secure-store
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

// ─────────────────────────────────────────────────────────────────────────────
// expo-local-authentication
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]), // FINGERPRINT
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// react-native-mmkv
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {}
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((key: string, value: string) => { store[key] = value }),
      getString: jest.fn((key: string) => store[key] ?? undefined),
      delete: jest.fn((key: string) => { delete store[key] }),
      getAllKeys: jest.fn(() => Object.keys(store)),
    })),
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// @react-native-community/netinfo
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// @tanstack/react-query — keep functional but suppress background refetches
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query')
  return {
    ...actual,
    // Prevent real network requests in tests
    useQuery: jest.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    }),
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// expo-router
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: () => null,
  },
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// Global fetch stub (react-native provides it, jest doesn't)
// ─────────────────────────────────────────────────────────────────────────────
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue(''),
  headers: { get: jest.fn().mockReturnValue('application/json') },
})

// ─────────────────────────────────────────────────────────────────────────────
// Silence noisy console.error in test output (still let console.warn show)
// ─────────────────────────────────────────────────────────────────────────────
const originalError = console.error
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    // Allow React "act()" warnings through so tests aren't silently broken
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
      originalError(...args)
    }
  })
})
afterAll(() => {
  jest.restoreAllMocks()
})

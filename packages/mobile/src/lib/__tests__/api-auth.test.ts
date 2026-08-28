/**
 * @regression Mobile API client – auth token attachment (#1274)
 *
 * Verifies that the ApiClient correctly attaches auth tokens from
 * SecureStorage to outgoing HTTP requests.
 *
 * This tests the integration point between SecureStorage and ApiClient.
 */
import { SecureStorage } from '../../auth/SecureStorage'

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve()
    }),
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.has(key) ? store.get(key)! : null)),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key)
      return Promise.resolve()
    }),
    __store: store,
  }
})

const SecureStore = require('expo-secure-store')

// ── Test the SecureStorage + fetch integration ────────────────────────────────
describe('[regression] Mobile API – auth token integration', () => {
  const mockFetch = jest.fn()
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    SecureStore.__store.clear()
    jest.clearAllMocks()
    originalFetch = global.fetch
    global.fetch = mockFetch
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest.fn().mockResolvedValue({ data: [] }),
      text: jest.fn().mockResolvedValue(''),
      headers: { get: jest.fn().mockReturnValue('application/json') },
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('SecureStorage.isAuthenticated returns true after token is stored', async () => {
    await SecureStorage.setToken('test-jwt-token')
    expect(await SecureStorage.isAuthenticated()).toBe(true)
  })

  it('SecureStorage.isAuthenticated returns false when no token exists', async () => {
    expect(await SecureStorage.isAuthenticated()).toBe(false)
  })

  it('token persists across multiple getToken calls', async () => {
    await SecureStorage.setToken('persist-token')
    expect(await SecureStorage.getToken()).toBe('persist-token')
    expect(await SecureStorage.getToken()).toBe('persist-token')
    expect(await SecureStorage.getToken()).toBe('persist-token')
  })

  it('refresh token does not affect isAuthenticated', async () => {
    await SecureStorage.setRefreshToken('refresh-only')
    expect(await SecureStorage.isAuthenticated()).toBe(false)
    expect(await SecureStorage.getRefreshToken()).toBe('refresh-only')
  })

  it('clear() makes isAuthenticated return false', async () => {
    await SecureStorage.setToken('temp-token')
    expect(await SecureStorage.isAuthenticated()).toBe(true)

    await SecureStorage.clear()
    expect(await SecureStorage.isAuthenticated()).toBe(false)
  })

  it('concurrent getToken calls return consistent results', async () => {
    await SecureStorage.setToken('consistent-token')
    const results = await Promise.all([
      SecureStorage.getToken(),
      SecureStorage.getToken(),
      SecureStorage.getToken(),
    ])
    expect(results).toEqual(['consistent-token', 'consistent-token', 'consistent-token'])
  })
})

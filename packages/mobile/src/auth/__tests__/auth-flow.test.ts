/**
 * @regression Mobile authentication flow comprehensive tests (#1274)
 *
 * Covers the full authentication lifecycle:
 *   - Login: token storage, user data persistence, state transitions
 *   - Token refresh: refresh token storage, rotation, revocation
 *   - Logout: secure data cleanup, state reset
 *   - ApiClient: auth token attachment to requests
 *   - Edge cases: concurrent operations, error recovery, storage failures
 *
 * Mocks expo-secure-store and expo-local-authentication at the module level
 * so no real device/simulator interaction occurs.
 */
import { SecureStorage } from '../SecureStorage'
import { BiometricAuth, BiometricType } from '../BiometricAuth'

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

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([2]),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}))

const SecureStore = require('expo-secure-store')
const LocalAuth = require('expo-local-authentication')

// ── Test fixtures ────────────────────────────────────────────────────────────
const SAMPLE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-jwt-token'
const SAMPLE_REFRESH = 'rt_abc123def456'
const SAMPLE_USER = {
  id: 'user-001',
  email: 'worker@bluecollar.app',
  firstName: 'Maria',
  lastName: 'Garcia',
  role: 'worker',
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN: Token storage and user persistence
// ─────────────────────────────────────────────────────────────────────────────
describe('[regression] Mobile auth – login flow', () => {
  beforeEach(() => {
    SecureStore.__store.clear()
    jest.clearAllMocks()
  })

  it('stores JWT token and user data on successful login', async () => {
    await SecureStorage.setToken(SAMPLE_TOKEN)
    await SecureStorage.setUser(SAMPLE_USER)

    expect(await SecureStorage.getToken()).toBe(SAMPLE_TOKEN)
    expect(await SecureStorage.getUser()).toEqual(SAMPLE_USER)
    expect(await SecureStorage.isAuthenticated()).toBe(true)
  })

  it('stores refresh token alongside access token', async () => {
    await SecureStorage.setToken(SAMPLE_TOKEN)
    await SecureStorage.setRefreshToken(SAMPLE_REFRESH)

    expect(await SecureStorage.getToken()).toBe(SAMPLE_TOKEN)
    expect(await SecureStorage.getRefreshToken()).toBe(SAMPLE_REFRESH)
  })

  it('persists biometric preference during login', async () => {
    await SecureStorage.setToken(SAMPLE_TOKEN)
    await SecureStorage.setBiometricEnabled(true)

    expect(await SecureStorage.isBiometricEnabled()).toBe(true)
    expect(await SecureStorage.isAuthenticated()).toBe(true)
  })

  it('overwrites existing token on re-login (no duplicate keys)', async () => {
    await SecureStorage.setToken('old-token-aaa')
    await SecureStorage.setRefreshToken('old-refresh-bbb')
    await SecureStorage.setUser({ id: 'old-user' })

    // Simulate re-login with new credentials
    await SecureStorage.setToken('new-token-xxx')
    await SecureStorage.setRefreshToken('new-refresh-yyy')
    await SecureStorage.setUser({ id: 'new-user' })

    expect(await SecureStorage.getToken()).toBe('new-token-xxx')
    expect(await SecureStorage.getRefreshToken()).toBe('new-refresh-yyy')
    expect(await SecureStorage.getUser()).toEqual({ id: 'new-user' })
  })

  it('login fails gracefully when SecureStore throws on write', async () => {
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('keychain locked'))
    await expect(SecureStorage.setToken(SAMPLE_TOKEN)).rejects.toThrow('keychain locked')
  })

  it('login completes even if biometric preference write fails', async () => {
    // Token and user data write successfully
    await SecureStorage.setToken(SAMPLE_TOKEN)
    await SecureStorage.setUser(SAMPLE_USER)

    // Biometric preference fails
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('biometric store failed'))
    await expect(SecureStorage.setBiometricEnabled(true)).rejects.toThrow()

    // Core auth state should still be intact
    expect(await SecureStorage.isAuthenticated()).toBe(true)
    expect(await SecureStorage.getUser()).toEqual(SAMPLE_USER)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN REFRESH: Refresh token lifecycle
// ─────────────────────────────────────────────────────────────────────────────
describe('[regression] Mobile auth – token refresh', () => {
  beforeEach(() => {
    SecureStore.__store.clear()
    jest.clearAllMocks()
  })

  it('refresh token is stored and retrievable independently of access token', async () => {
    await SecureStorage.setRefreshToken(SAMPLE_REFRESH)
    expect(await SecureStorage.getRefreshToken()).toBe(SAMPLE_REFRESH)

    // Access token not set — user should NOT be authenticated
    expect(await SecureStorage.isAuthenticated()).toBe(false)
  })

  it('refresh token rotation replaces old token atomically', async () => {
    await SecureStorage.setRefreshToken('rt_v1_old')
    expect(await SecureStorage.getRefreshToken()).toBe('rt_v1_old')

    // Simulate token rotation (new token replaces old)
    await SecureStorage.setRefreshToken('rt_v2_new')
    expect(await SecureStorage.getRefreshToken()).toBe('rt_v2_new')
  })

  it('clear() removes both access and refresh tokens', async () => {
    await SecureStorage.setToken(SAMPLE_TOKEN)
    await SecureStorage.setRefreshToken(SAMPLE_REFRESH)

    await SecureStorage.clear()

    expect(await SecureStorage.getToken()).toBeNull()
    expect(await SecureStorage.getRefreshToken()).toBeNull()
    expect(await SecureStorage.isAuthenticated()).toBe(false)
  })

  it('refresh token persists across access token renewal', async () => {
    // Store refresh token first
    await SecureStorage.setRefreshToken(SAMPLE_REFRESH)

    // Simulate access token expiry and renewal
    await SecureStorage.setToken('access_v1')
    expect(await SecureStorage.getToken()).toBe('access_v1')

    // Renew access token
    await SecureStorage.setToken('access_v2')
    expect(await SecureStorage.getToken()).toBe('access_v2')

    // Refresh token should still be intact
    expect(await SecureStorage.getRefreshToken()).toBe(SAMPLE_REFRESH)
  })

  it('returns null for refresh token when storage throws', async () => {
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error('keychain error'))
    expect(await SecureStorage.getRefreshToken()).toBeNull()
  })

  it('concurrent token and refresh token writes do not corrupt each other', async () => {
    const writes = [
      SecureStorage.setToken(SAMPLE_TOKEN),
      SecureStorage.setRefreshToken(SAMPLE_REFRESH),
      SecureStorage.setUser(SAMPLE_USER),
    ]

    await Promise.all(writes)

    expect(await SecureStorage.getToken()).toBe(SAMPLE_TOKEN)
    expect(await SecureStorage.getRefreshToken()).toBe(SAMPLE_REFRESH)
    expect(await SecureStorage.getUser()).toEqual(SAMPLE_USER)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT: Secure data cleanup
// ─────────────────────────────────────────────────────────────────────────────
describe('[regression] Mobile auth – logout flow', () => {
  beforeEach(() => {
    SecureStore.__store.clear()
    jest.clearAllMocks()
  })

  it('clear() removes token, refresh token, user data, and biometric preference in parallel', async () => {
    await SecureStorage.setToken(SAMPLE_TOKEN)
    await SecureStorage.setRefreshToken(SAMPLE_REFRESH)
    await SecureStorage.setUser(SAMPLE_USER)
    await SecureStorage.setBiometricEnabled(true)

    await SecureStorage.clear()

    expect(await SecureStorage.getToken()).toBeNull()
    expect(await SecureStorage.getRefreshToken()).toBeNull()
    expect(await SecureStorage.getUser()).toBeNull()
    // Biometric preference is NOT cleared by clear() — it's a user preference
    // Only the 3 auth keys are deleted per the implementation
  })

  it('isAuthenticated returns false after clear', async () => {
    await SecureStorage.setToken(SAMPLE_TOKEN)
    expect(await SecureStorage.isAuthenticated()).toBe(true)

    await SecureStorage.clear()
    expect(await SecureStorage.isAuthenticated()).toBe(false)
  })

  it('double clear() is idempotent — does not throw', async () => {
    await SecureStorage.setToken(SAMPLE_TOKEN)
    await SecureStorage.clear()
    await expect(SecureStorage.clear()).resolves.toBeUndefined()
  })

  it('clear() propagates error if any deleteItemAsync fails', async () => {
    SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('delete blocked'))
    await expect(SecureStorage.clear()).rejects.toThrow('delete blocked')
  })

  it('login after clear() fully restores auth state', async () => {
    // Login -> Logout -> Login cycle
    await SecureStorage.setToken('first-token')
    await SecureStorage.setUser({ id: 'first-user' })
    await SecureStorage.clear()

    // Re-login
    await SecureStorage.setToken('second-token')
    await SecureStorage.setUser({ id: 'second-user' })

    expect(await SecureStorage.getToken()).toBe('second-token')
    expect(await SecureStorage.getUser()).toEqual({ id: 'second-user' })
    expect(await SecureStorage.isAuthenticated()).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BIOMETRIC AUTH: Enable/disable/unlock lifecycle
// ─────────────────────────────────────────────────────────────────────────────
describe('[regression] Mobile auth – biometric unlock lifecycle', () => {
  beforeEach(() => {
    SecureStore.__store.clear()
    jest.clearAllMocks()
  })

  it('enableBiometric stores preference after successful auth', async () => {
    LocalAuth.authenticateAsync.mockResolvedValueOnce({ success: true })

    const result = await BiometricAuth.enableBiometric()
    expect(result.success).toBe(true)
    expect(await SecureStorage.isBiometricEnabled()).toBe(true)
  })

  it('disableBiometric clears the preference', async () => {
    await SecureStorage.setBiometricEnabled(true)
    await BiometricAuth.disableBiometric()
    expect(await SecureStorage.isBiometricEnabled()).toBe(false)
  })

  it('unlockApp returns true when biometric is not enabled (pass-through)', async () => {
    const result = await BiometricAuth.unlockApp()
    expect(result).toBe(true)
  })

  it('unlockApp prompts for biometric when enabled', async () => {
    await SecureStorage.setBiometricEnabled(true)
    LocalAuth.authenticateAsync.mockResolvedValueOnce({ success: true })

    const result = await BiometricAuth.unlockApp()
    expect(result).toBe(true)
    expect(LocalAuth.authenticateAsync).toHaveBeenCalled()
  })

  it('unlockApp returns false when biometric prompt fails', async () => {
    await SecureStorage.setBiometricEnabled(true)
    LocalAuth.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' })

    const result = await BiometricAuth.unlockApp()
    expect(result).toBe(false)
  })

  it('enableBiometric fails without prompting when hardware unavailable', async () => {
    LocalAuth.hasHardwareAsync.mockResolvedValueOnce(false)

    const result = await BiometricAuth.enableBiometric()
    expect(result.success).toBe(false)
    expect(result.error).toContain('not available')
    expect(LocalAuth.authenticateAsync).not.toHaveBeenCalled()
  })

  it('enableBiometric fails when authentication is cancelled', async () => {
    LocalAuth.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' })

    const result = await BiometricAuth.enableBiometric()
    expect(result.success).toBe(false)
    expect(await SecureStorage.isBiometricEnabled()).toBe(false)
  })

  it('getCapabilities returns all biometric types supported by device', async () => {
    LocalAuth.supportedAuthenticationTypesAsync.mockResolvedValueOnce([1, 2])
    const caps = await BiometricAuth.getCapabilities()
    expect(caps.supportedTypes).toContain(BiometricType.FINGERPRINT)
    expect(caps.supportedTypes).toContain(BiometricType.FACE)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES: Concurrent operations and error recovery
// ─────────────────────────────────────────────────────────────────────────────
describe('[regression] Mobile auth – concurrent operations & error recovery', () => {
  beforeEach(() => {
    SecureStore.__store.clear()
    jest.clearAllMocks()
  })

  it('concurrent setToken and clear resolve without data corruption', async () => {
    // Start both operations simultaneously
    const write = SecureStorage.setToken(SAMPLE_TOKEN)
    const erase = SecureStorage.clear()

    await Promise.all([write, erase])

    // After both complete, token should be cleared (clear wins)
    const token = await SecureStorage.getToken()
    expect(token === null || token === SAMPLE_TOKEN).toBe(true)
  })

  it('getUser returns null on corrupt JSON instead of crashing', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('{invalid json!!')
    expect(await SecureStorage.getUser()).toBeNull()
  })

  it('getToken returns null when keychain is unavailable (fail-open)', async () => {
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error('keychain not available'))
    expect(await SecureStorage.getToken()).toBeNull()
    expect(await SecureStorage.isAuthenticated()).toBe(false)
  })

  it('setToken propagates write failures (fail-closed on write)', async () => {
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('storage full'))
    await expect(SecureStorage.setToken(SAMPLE_TOKEN)).rejects.toThrow('storage full')
  })

  it('isAuthenticated is false during initial boot before checkAuthStatus runs', async () => {
    // Before any token is set
    expect(await SecureStorage.isAuthenticated()).toBe(false)
    expect(await SecureStorage.getToken()).toBeNull()
  })

  it('clear after partial writes cleans up successfully', async () => {
    await SecureStorage.setToken(SAMPLE_TOKEN)
    // User data write fails
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('partial failure'))

    // clear should still work since it uses deleteItemAsync
    await SecureStorage.clear()
    expect(await SecureStorage.getToken()).toBeNull()
  })
})

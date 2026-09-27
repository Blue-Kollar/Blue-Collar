import { SecureStorage } from '../SecureStorage'

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

describe('SecureStorage', () => {
  beforeEach(() => {
    SecureStore.__store.clear()
    jest.clearAllMocks()
  })

  describe('token round-trip', () => {
    it('saves and retrieves a token', async () => {
      await SecureStorage.setToken('token-123')
      expect(await SecureStorage.getToken()).toBe('token-123')
    })

    it('returns null (not an error) when nothing is stored', async () => {
      await expect(SecureStorage.getToken()).resolves.toBeNull()
    })

    it('returns null when the underlying store throws', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('keychain unavailable'))
      await expect(SecureStorage.getToken()).resolves.toBeNull()
    })

    it('propagates errors when saving fails', async () => {
      SecureStore.setItemAsync.mockRejectedValueOnce(new Error('write failed'))
      await expect(SecureStorage.setToken('t')).rejects.toThrow('write failed')
    })
  })

  describe('refresh token round-trip', () => {
    it('saves and retrieves a refresh token', async () => {
      await SecureStorage.setRefreshToken('refresh-abc')
      expect(await SecureStorage.getRefreshToken()).toBe('refresh-abc')
    })

    it('returns null when nothing is stored', async () => {
      await expect(SecureStorage.getRefreshToken()).resolves.toBeNull()
    })
  })

  describe('user data', () => {
    it('saves and retrieves user data as an object', async () => {
      const user = { id: '1', email: 'a@b.com' }
      await SecureStorage.setUser(user)
      expect(await SecureStorage.getUser()).toEqual(user)
    })

    it('returns null when nothing is stored', async () => {
      await expect(SecureStorage.getUser()).resolves.toBeNull()
    })

    it('returns null instead of throwing on corrupt JSON', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce('{not-json')
      await expect(SecureStorage.getUser()).resolves.toBeNull()
    })
  })

  describe('biometric preference', () => {
    it('defaults to false when unset', async () => {
      expect(await SecureStorage.isBiometricEnabled()).toBe(false)
    })

    it('persists true/false correctly', async () => {
      await SecureStorage.setBiometricEnabled(true)
      expect(await SecureStorage.isBiometricEnabled()).toBe(true)
      await SecureStorage.setBiometricEnabled(false)
      expect(await SecureStorage.isBiometricEnabled()).toBe(false)
    })

    it('fails closed (false) when the store throws', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('boom'))
      expect(await SecureStorage.isBiometricEnabled()).toBe(false)
    })
  })

  describe('clear (logout)', () => {
    it('actually removes the token, refresh token, and user data', async () => {
      await SecureStorage.setToken('t')
      await SecureStorage.setRefreshToken('r')
      await SecureStorage.setUser({ id: '1' })

      await SecureStorage.clear()

      expect(await SecureStorage.getToken()).toBeNull()
      expect(await SecureStorage.getRefreshToken()).toBeNull()
      expect(await SecureStorage.getUser()).toBeNull()
    })

    it('propagates errors when deletion fails', async () => {
      SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('delete failed'))
      await expect(SecureStorage.clear()).rejects.toThrow('delete failed')
    })
  })

  describe('isAuthenticated', () => {
    it('is true when a token is present', async () => {
      await SecureStorage.setToken('t')
      expect(await SecureStorage.isAuthenticated()).toBe(true)
    })

    it('is false when no token is present', async () => {
      expect(await SecureStorage.isAuthenticated()).toBe(false)
    })

    it('is false after clear() removes the token', async () => {
      await SecureStorage.setToken('t')
      await SecureStorage.clear()
      expect(await SecureStorage.isAuthenticated()).toBe(false)
    })
  })
})

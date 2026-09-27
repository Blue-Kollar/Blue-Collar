import { BiometricAuth, BiometricType } from '../BiometricAuth'
import { SecureStorage } from '../SecureStorage'

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}))

jest.mock('../SecureStorage', () => ({
  SecureStorage: {
    setBiometricEnabled: jest.fn(),
    isBiometricEnabled: jest.fn(),
  },
}))

const LocalAuthentication = require('expo-local-authentication')

function mockAvailable(overrides: Partial<{ hasHardware: boolean; isEnrolled: boolean; types: number[] }> = {}) {
  LocalAuthentication.hasHardwareAsync.mockResolvedValue(overrides.hasHardware ?? true)
  LocalAuthentication.isEnrolledAsync.mockResolvedValue(overrides.isEnrolled ?? true)
  LocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue(
    overrides.types ?? [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]
  )
}

describe('BiometricAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCapabilities', () => {
    it('reports available when hardware present and enrolled', async () => {
      mockAvailable()
      const caps = await BiometricAuth.getCapabilities()
      expect(caps.isAvailable).toBe(true)
      expect(caps.supportedTypes).toContain(BiometricType.FACE)
    })

    it('reports unavailable when no hardware', async () => {
      mockAvailable({ hasHardware: false })
      const caps = await BiometricAuth.getCapabilities()
      expect(caps.isAvailable).toBe(false)
    })

    it('reports unavailable when hardware present but not enrolled', async () => {
      mockAvailable({ isEnrolled: false })
      const caps = await BiometricAuth.getCapabilities()
      expect(caps.isAvailable).toBe(false)
    })

    it('fails closed (unavailable) when the native API throws', async () => {
      LocalAuthentication.hasHardwareAsync.mockRejectedValue(new Error('native error'))
      const caps = await BiometricAuth.getCapabilities()
      expect(caps.isAvailable).toBe(false)
      expect(caps.supportedTypes).toEqual([])
    })
  })

  describe('authenticate', () => {
    it('denies access when biometrics are unavailable, without prompting', async () => {
      mockAvailable({ hasHardware: false })
      const result = await BiometricAuth.authenticate()
      expect(result.success).toBe(false)
      expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled()
    })

    it('grants access on a successful prompt', async () => {
      mockAvailable()
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: true })
      const result = await BiometricAuth.authenticate()
      expect(result.success).toBe(true)
    })

    it('denies access on a failed prompt', async () => {
      mockAvailable()
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' })
      const result = await BiometricAuth.authenticate()
      expect(result.success).toBe(false)
      expect(result.error).toBe('user_cancel')
    })

    it('denies access on a cancelled prompt', async () => {
      mockAvailable()
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' })
      const result = await BiometricAuth.authenticate()
      expect(result.success).toBe(false)
    })

    it('fails closed when the native prompt throws', async () => {
      mockAvailable()
      LocalAuthentication.authenticateAsync.mockRejectedValue(new Error('native crash'))
      const result = await BiometricAuth.authenticate()
      expect(result.success).toBe(false)
    })

    it('leaves the device fallback (PIN/passcode) enabled, not silently disabled', async () => {
      mockAvailable()
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: true })
      await BiometricAuth.authenticate()
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ disableDeviceFallback: false })
      )
    })
  })

  describe('enableBiometric', () => {
    it('requires a successful authentication before persisting the preference', async () => {
      mockAvailable()
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: false, error: 'failed' })
      const result = await BiometricAuth.enableBiometric()
      expect(result.success).toBe(false)
      expect(SecureStorage.setBiometricEnabled).not.toHaveBeenCalled()
    })

    it('persists the preference after a successful authentication', async () => {
      mockAvailable()
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: true })
      const result = await BiometricAuth.enableBiometric()
      expect(result.success).toBe(true)
      expect(SecureStorage.setBiometricEnabled).toHaveBeenCalledWith(true)
    })

    it('refuses to enable when biometrics are unavailable', async () => {
      mockAvailable({ hasHardware: false })
      const result = await BiometricAuth.enableBiometric()
      expect(result.success).toBe(false)
      expect(SecureStorage.setBiometricEnabled).not.toHaveBeenCalled()
    })
  })

  describe('disableBiometric / isEnabled', () => {
    it('disables by clearing the stored preference', async () => {
      await BiometricAuth.disableBiometric()
      expect(SecureStorage.setBiometricEnabled).toHaveBeenCalledWith(false)
    })

    it('reflects the stored preference', async () => {
      ;(SecureStorage.isBiometricEnabled as jest.Mock).mockResolvedValue(true)
      expect(await BiometricAuth.isEnabled()).toBe(true)
    })
  })

  describe('unlockApp', () => {
    it('allows access when biometric unlock is not enabled', async () => {
      ;(SecureStorage.isBiometricEnabled as jest.Mock).mockResolvedValue(false)
      expect(await BiometricAuth.unlockApp()).toBe(true)
      expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled()
    })

    it('requires a successful prompt when biometric unlock is enabled', async () => {
      ;(SecureStorage.isBiometricEnabled as jest.Mock).mockResolvedValue(true)
      mockAvailable()
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: true })
      expect(await BiometricAuth.unlockApp()).toBe(true)
    })

    it('denies access when biometric unlock is enabled but the prompt fails', async () => {
      ;(SecureStorage.isBiometricEnabled as jest.Mock).mockResolvedValue(true)
      mockAvailable()
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: false, error: 'failed' })
      expect(await BiometricAuth.unlockApp()).toBe(false)
    })
  })
})

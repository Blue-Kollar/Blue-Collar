import * as LocalAuthentication from 'expo-local-authentication'
import { SecureStorage } from './SecureStorage'

export enum BiometricType {
  FINGERPRINT = 'fingerprint',
  FACE = 'face',
  IRIS = 'iris',
  NONE = 'none',
}

export interface BiometricCapabilities {
  isAvailable: boolean
  supportedTypes: BiometricType[]
  isEnrolled: boolean
}

export class BiometricAuth {
  /**
   * Check if device supports biometric authentication
   */
  static async getCapabilities(): Promise<BiometricCapabilities> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync()
      const isEnrolled = await LocalAuthentication.isEnrolledAsync()
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync()

      const types: BiometricType[] = supportedTypes.map((type) => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return BiometricType.FINGERPRINT
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return BiometricType.FACE
          case LocalAuthentication.AuthenticationType.IRIS:
            return BiometricType.IRIS
          default:
            return BiometricType.NONE
        }
      })

      return {
        isAvailable: hasHardware && isEnrolled,
        supportedTypes: types,
        isEnrolled,
      }
    } catch (error) {
      console.error('Failed to check biometric capabilities:', error)
      return {
        isAvailable: false,
        supportedTypes: [],
        isEnrolled: false,
      }
    }
  }

  /**
   * Authenticate user with biometrics
   */
  static async authenticate(
    promptMessage: string = 'Authenticate to continue'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const capabilities = await this.getCapabilities()

      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device',
        }
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      })

      if (result.success) {
        return { success: true }
      } else {
        return {
          success: false,
          error: result.error || 'Authentication failed',
        }
      }
    } catch (error) {
      console.error('Biometric authentication error:', error)
      return {
        success: false,
        error: 'An error occurred during authentication',
      }
    }
  }

  /**
   * Enable biometric unlock (requires successful authentication first)
   */
  static async enableBiometric(): Promise<{ success: boolean; error?: string }> {
    const capabilities = await this.getCapabilities()

    if (!capabilities.isAvailable) {
      return {
        success: false,
        error: 'Biometric authentication is not available',
      }
    }

    const authResult = await this.authenticate('Enable biometric unlock')

    if (!authResult.success) {
      return authResult
    }

    try {
      await SecureStorage.setBiometricEnabled(true)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to enable biometric unlock',
      }
    }
  }

  /**
   * Disable biometric unlock
   */
  static async disableBiometric(): Promise<void> {
    await SecureStorage.setBiometricEnabled(false)
  }

  /**
   * Check if biometric unlock is enabled
   */
  static async isEnabled(): Promise<boolean> {
    return await SecureStorage.isBiometricEnabled()
  }

  /**
   * Unlock app with biometric authentication
   * Returns true if authentication succeeds or biometric is not enabled
   */
  static async unlockApp(): Promise<boolean> {
    const isEnabled = await this.isEnabled()

    if (!isEnabled) {
      return true // Biometric not enabled, allow access
    }

    const result = await this.authenticate('Unlock BlueCollar')
    return result.success
  }
}

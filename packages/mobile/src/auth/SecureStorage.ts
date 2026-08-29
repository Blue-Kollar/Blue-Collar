import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_KEY = 'user_data'
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'

export class SecureStorage {
  /**
   * Store authentication token securely in Keychain (iOS) / Keystore (Android)
   */
  static async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token)
    } catch (error) {
      console.error('Failed to store token:', error)
      throw error
    }
  }

  /**
   * Retrieve authentication token
   */
  static async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY)
    } catch (error) {
      console.error('Failed to retrieve token:', error)
      return null
    }
  }

  /**
   * Store refresh token
   */
  static async setRefreshToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token)
    } catch (error) {
      console.error('Failed to store refresh token:', error)
      throw error
    }
  }

  /**
   * Retrieve refresh token
   */
  static async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
    } catch (error) {
      console.error('Failed to retrieve refresh token:', error)
      return null
    }
  }

  /**
   * Store user data (non-sensitive metadata)
   */
  static async setUser(user: any): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
    } catch (error) {
      console.error('Failed to store user data:', error)
      throw error
    }
  }

  /**
   * Retrieve user data
   */
  static async getUser(): Promise<any | null> {
    try {
      const data = await SecureStore.getItemAsync(USER_KEY)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Failed to retrieve user data:', error)
      return null
    }
  }

  /**
   * Check if biometric unlock is enabled
   */
  static async isBiometricEnabled(): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)
      return value === 'true'
    } catch (error) {
      return false
    }
  }

  /**
   * Enable or disable biometric unlock
   */
  static async setBiometricEnabled(enabled: boolean): Promise<void> {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled.toString())
    } catch (error) {
      console.error('Failed to set biometric preference:', error)
      throw error
    }
  }

  /**
   * Clear all stored data (logout)
   */
  static async clear(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
      ])
    } catch (error) {
      console.error('Failed to clear storage:', error)
      throw error
    }
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken()
    return token !== null
  }
}

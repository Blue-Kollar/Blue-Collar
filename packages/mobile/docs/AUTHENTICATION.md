# Mobile Authentication Guide

This guide covers secure authentication and biometric unlock for the BlueCollar mobile app.

## Overview

The mobile app uses **Expo SecureStore** for token storage and **Expo LocalAuthentication** for biometric unlock. All tokens are stored in the device's secure hardware:

- **iOS**: Keychain
- **Android**: Keystore

## SecureStorage API

### Storing Authentication Tokens

```typescript
import { SecureStorage } from '@/auth/SecureStorage'

// Store JWT token
await SecureStorage.setToken(jwtToken)

// Store refresh token
await SecureStorage.setRefreshToken(refreshToken)

// Store user metadata
await SecureStorage.setUser({ id: '123', email: 'user@example.com' })
```

### Retrieving Tokens

```typescript
// Get JWT token
const token = await SecureStorage.getToken()

// Get refresh token
const refreshToken = await SecureStorage.getRefreshToken()

// Get user metadata
const user = await SecureStorage.getUser()
```

### Checking Authentication State

```typescript
const isAuthenticated = await SecureStorage.isAuthenticated()
```

### Clearing Storage (Logout)

```typescript
await SecureStorage.clear()
```

## Biometric Authentication

### Checking Device Capabilities

```typescript
import { BiometricAuth, BiometricType } from '@/auth/BiometricAuth'

const capabilities = await BiometricAuth.getCapabilities()

console.log(capabilities.isAvailable) // true if biometrics available
console.log(capabilities.supportedTypes) // ['fingerprint', 'face', etc.]
console.log(capabilities.isEnrolled) // true if user has enrolled biometrics
```

### Authenticating with Biometrics

```typescript
const result = await BiometricAuth.authenticate('Verify your identity')

if (result.success) {
  console.log('Authentication successful')
} else {
  console.error('Authentication failed:', result.error)
}
```

### Enabling Biometric Unlock

```typescript
const result = await BiometricAuth.enableBiometric()

if (result.success) {
  console.log('Biometric unlock enabled')
} else {
  console.error('Failed to enable:', result.error)
}
```

### Disabling Biometric Unlock

```typescript
await BiometricAuth.disableBiometric()
```

### Unlocking the App

```typescript
const unlocked = await BiometricAuth.unlockApp()

if (unlocked) {
  // Proceed to app
} else {
  // Show lock screen
}
```

## Integration Example

### Login Flow

```typescript
import { SecureStorage } from '@/auth/SecureStorage'
import { BiometricAuth } from '@/auth/BiometricAuth'

async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const { token, data } = await response.json()

  // Store tokens securely
  await SecureStorage.setToken(token)
  await SecureStorage.setUser(data)

  // Prompt to enable biometrics
  const capabilities = await BiometricAuth.getCapabilities()
  if (capabilities.isAvailable) {
    const enableBio = await promptUserToEnableBiometrics()
    if (enableBio) {
      await BiometricAuth.enableBiometric()
    }
  }
}
```

### App Launch Flow

```typescript
import { SecureStorage } from '@/auth/SecureStorage'
import { BiometricAuth } from '@/auth/BiometricAuth'

async function onAppLaunch() {
  const isAuthenticated = await SecureStorage.isAuthenticated()

  if (!isAuthenticated) {
    // Show login screen
    return navigateToLogin()
  }

  // Check if biometric unlock is enabled
  const biometricEnabled = await BiometricAuth.isEnabled()

  if (biometricEnabled) {
    const unlocked = await BiometricAuth.unlockApp()
    if (!unlocked) {
      // Show lock screen or logout
      await SecureStorage.clear()
      return navigateToLogin()
    }
  }

  // Proceed to app
  navigateToHome()
}
```

### Logout Flow

```typescript
import { SecureStorage } from '@/auth/SecureStorage'

async function logout() {
  // Call logout endpoint
  await fetch('/api/auth/logout', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${await SecureStorage.getToken()}`,
    },
  })

  // Clear local storage
  await SecureStorage.clear()

  // Navigate to login
  navigateToLogin()
}
```

## Security Considerations

### Token Storage
- Tokens are never stored in AsyncStorage or plain localStorage
- SecureStore uses hardware-backed encryption on supported devices
- Tokens are automatically cleared on app uninstall

### Biometric Authentication
- Biometric unlock is opt-in only
- Fallback to device passcode is always available
- Biometric state is stored securely alongside tokens

### Token Refresh
- Implement automatic token refresh before expiry
- Store refresh tokens separately from access tokens
- Clear both tokens on logout

### Network Security
- Always use HTTPS for API communication
- Implement certificate pinning for production
- Validate SSL certificates

## Platform-Specific Notes

### iOS
- Keychain data persists across app reinstalls if iCloud Keychain is enabled
- Face ID requires `NSFaceIDUsageDescription` in Info.plist
- Touch ID requires `NSUserAuthenticationUsageDescription`

### Android
- Keystore data is cleared on app uninstall
- Biometric prompts require `android.permission.USE_BIOMETRIC` permission
- Devices below Android 6.0 do not support hardware-backed Keystore

## Testing

Unit/integration coverage for this package lives alongside the source:
`src/auth/__tests__/SecureStorage.test.ts`, `src/auth/__tests__/BiometricAuth.test.ts`,
`src/context/__tests__/AuthContext.test.tsx`, `src/screens/__tests__/AppLockScreen.test.tsx`,
and `src/screens/__tests__/BiometricSettingsScreen.test.tsx`. These mock `expo-secure-store`
and `expo-local-authentication` and run under `jest-expo` — no on-device runtime is required.

On-device e2e (Detox/Maestro) for the auth flow is out of scope here since no mobile e2e
infrastructure exists yet in this repo; tracked as a follow-up.

### Testing SecureStorage

```typescript
import { SecureStorage } from '@/auth/SecureStorage'

describe('SecureStorage', () => {
  beforeEach(async () => {
    await SecureStorage.clear()
  })

  it('should store and retrieve token', async () => {
    await SecureStorage.setToken('test-token')
    const token = await SecureStorage.getToken()
    expect(token).toBe('test-token')
  })

  it('should check authentication state', async () => {
    expect(await SecureStorage.isAuthenticated()).toBe(false)
    await SecureStorage.setToken('test-token')
    expect(await SecureStorage.isAuthenticated()).toBe(true)
  })
})
```

### Testing BiometricAuth

```typescript
import { BiometricAuth } from '@/auth/BiometricAuth'

describe('BiometricAuth', () => {
  it('should check device capabilities', async () => {
    const capabilities = await BiometricAuth.getCapabilities()
    expect(capabilities).toHaveProperty('isAvailable')
    expect(capabilities).toHaveProperty('supportedTypes')
  })

  it('should handle unavailable biometrics gracefully', async () => {
    // Mock device without biometrics
    const result = await BiometricAuth.authenticate()
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
```

## Troubleshooting

### "Biometric authentication not available"
- Ensure device has biometric hardware (fingerprint sensor, Face ID)
- Verify user has enrolled biometrics in device settings
- Check app permissions

### "Failed to store token"
- Verify SecureStore is properly installed
- Check device storage is not full
- Ensure app has not been tampered with (Android)

### "Authentication canceled by user"
- User canceled biometric prompt
- Implement fallback to manual login

## References

- [Expo SecureStore Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo LocalAuthentication Documentation](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- [iOS Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Android Keystore System](https://developer.android.com/training/articles/keystore)

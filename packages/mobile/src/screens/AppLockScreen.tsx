import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { BiometricAuth } from '../auth/BiometricAuth'
import { SecureStorage } from '../auth/SecureStorage'

interface AppLockScreenProps {
  onUnlock: () => void
  onLogout: () => void
}

export function AppLockScreen({ onUnlock, onLogout }: AppLockScreenProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    attemptBiometricUnlock()
  }, [])

  async function attemptBiometricUnlock() {
    setLoading(true)
    setError('')

    const result = await BiometricAuth.authenticate('Unlock BlueCollar')

    if (result.success) {
      onUnlock()
    } else {
      setError(result.error || 'Authentication failed')
      setLoading(false)
    }
  }

  async function handleLogout() {
    await SecureStorage.clear()
    onLogout()
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>BlueCollar</Text>
        <Text style={styles.subtitle}>Unlock to continue</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.spinner} />
        ) : (
          <>
            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={styles.button}
              onPress={attemptBiometricUnlock}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.logoutButton]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '80%',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 32,
  },
  spinner: {
    marginVertical: 24,
  },
  error: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
})

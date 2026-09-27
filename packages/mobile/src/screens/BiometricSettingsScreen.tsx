import React, { useState, useEffect } from 'react'
import { View, Text, Switch, StyleSheet, Alert } from 'react-native'
import { BiometricAuth, BiometricType } from '../auth/BiometricAuth'

export function BiometricSettingsScreen() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isAvailable, setIsAvailable] = useState(false)
  const [biometricType, setBiometricType] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkBiometricStatus()
  }, [])

  async function checkBiometricStatus() {
    const capabilities = await BiometricAuth.getCapabilities()
    const enabled = await BiometricAuth.isEnabled()

    setIsAvailable(capabilities.isAvailable)
    setIsEnabled(enabled)

    // Set display name based on supported type
    if (capabilities.supportedTypes.includes(BiometricType.FACE)) {
      setBiometricType('Face ID')
    } else if (capabilities.supportedTypes.includes(BiometricType.FINGERPRINT)) {
      setBiometricType('Fingerprint')
    } else if (capabilities.supportedTypes.includes(BiometricType.IRIS)) {
      setBiometricType('Iris')
    }

    setLoading(false)
  }

  async function toggleBiometric(value: boolean) {
    if (value) {
      const result = await BiometricAuth.enableBiometric()
      if (result.success) {
        setIsEnabled(true)
        Alert.alert('Success', `${biometricType} unlock enabled`)
      } else {
        Alert.alert('Error', result.error || 'Failed to enable biometric unlock')
      }
    } else {
      await BiometricAuth.disableBiometric()
      setIsEnabled(false)
      Alert.alert('Success', `${biometricType} unlock disabled`)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    )
  }

  if (!isAvailable) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Biometric Unlock</Text>
        <Text style={styles.unavailable}>
          Biometric authentication is not available on this device. Please ensure you have enrolled
          biometrics in your device settings.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Biometric Unlock</Text>
      <View style={styles.row}>
        <View style={styles.textContainer}>
          <Text style={styles.label}>Unlock with {biometricType}</Text>
          <Text style={styles.description}>
            Use {biometricType} to quickly unlock the app
          </Text>
        </View>
        <Switch value={isEnabled} onValueChange={toggleBiometric} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
  unavailable: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
})

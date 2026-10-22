/**
 * OnboardingScreen — first-run onboarding flow for the BlueCollar mobile app.
 *
 * Guides a new user through:
 *   1. Welcome
 *   2. Connect a Stellar wallet (delegates to an injected WalletProvider)
 *   3. Secure the account (biometric / PIN toggle)
 *   4. Completion
 *
 * The wallet provider is injected so E2E tests can drive the flow with a
 * deterministic mock (issue #1275).  Never performs real network calls here.
 */
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import type { WalletProvider } from './WalletConnectionScreen'

export type OnboardingStep = 'welcome' | 'connect' | 'secure' | 'done'

export interface OnboardingScreenProps {
  walletProvider?: WalletProvider
  /** Called once onboarding completes successfully with the connected public key. */
  onComplete?: (publicKey: string) => void
  /** Skip straight to the connect step (useful for resuming partial onboarding). */
  startStep?: OnboardingStep
}

const MOCK_PK = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

const defaultProvider: WalletProvider = {
  requestAccess: async () => ({ publicKey: MOCK_PK }),
  disconnect: async () => {},
  getPublicKey: async () => MOCK_PK,
}

export default function OnboardingScreen({
  walletProvider = defaultProvider,
  onComplete,
  startStep = 'welcome',
}: OnboardingScreenProps) {
  const [step, setStep] = useState<OnboardingStep>(startStep)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(true)
  const [copied, setCopied] = useState(false)

  async function handleConnect() {
    setConnecting(true)
    setErrorMessage('')
    try {
      const result = await walletProvider.requestAccess()
      setPublicKey(result.publicKey)
      setStep('secure')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Wallet connection failed')
    } finally {
      setConnecting(false)
    }
  }

  function handleFinish() {
    if (!publicKey) {
      setErrorMessage('No wallet connected')
      return
    }
    onComplete?.(publicKey)
    setStep('done')
  }

  function handleRetry() {
    setErrorMessage('')
    void handleConnect()
  }

  return (
    <View style={styles.container} testID="onboarding-screen">
      {step === 'welcome' && (
        <View style={styles.step} testID="step-welcome">
          <Text style={styles.title}>Welcome to BlueCollar</Text>
          <Text style={styles.subtitle}>
            Find skilled local workers and pay them directly on Stellar.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setStep('connect')}
            testID="get-started-button"
            accessibilityLabel="Get started"
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'connect' && (
        <View style={styles.step} testID="step-connect">
          <Text style={styles.title}>Connect your wallet</Text>
          <Text style={styles.subtitle}>
            Connect a Stellar wallet to send tips and payments.
          </Text>
          {connecting && (
            <ActivityIndicator size="large" color="#007AFF" style={styles.spinner} testID="connecting-indicator" />
          )}
          {!connecting && !errorMessage && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void handleConnect()}
              testID="connect-button"
              accessibilityLabel="Connect wallet"
            >
              <Text style={styles.primaryButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
          )}
          {errorMessage ? (
            <View style={styles.errorCard} testID="error-card">
              <Text style={styles.errorText} testID="error-message">{errorMessage}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry} testID="retry-button">
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('welcome')} testID="back-button">
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'secure' && publicKey && (
        <View style={styles.step} testID="step-secure">
          <Text style={styles.title}>Secure your account</Text>
          <Text style={styles.subtitle}>Biometric unlock is recommended for fast, safe access.</Text>
          <View style={styles.keyCard} testID="public-key-card">
            <Text style={styles.keyLabel}>Connected wallet</Text>
            <Text style={styles.keyValue} testID="public-key-value">{publicKey}</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, biometricEnabled && styles.toggleOn]}
            onPress={() => setBiometricEnabled((v) => !v)}
            testID="biometric-toggle"
            accessibilityLabel="Toggle biometric"
          >
            <Text style={styles.toggleText}>
              {biometricEnabled ? 'Biometric unlock: ON' : 'Biometric unlock: OFF'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleFinish} testID="finish-button">
            <Text style={styles.primaryButtonText}>Finish</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.step} testID="step-done">
          <Text style={styles.title}>You're all set! 🎉</Text>
          <Text style={styles.subtitle}>Onboarding complete.</Text>
          {publicKey && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setCopied(true)
              }}
              testID="copy-key-button"
            >
              <Text style={styles.secondaryButtonText}>
                {copied ? 'Copied!' : 'Copy wallet address'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 16, justifyContent: 'center' },
  step: { alignItems: 'stretch' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  primaryButton: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: { marginTop: 12, alignItems: 'center', padding: 10 },
  secondaryButtonText: { color: '#007AFF', fontWeight: '600' },
  spinner: { marginVertical: 24 },
  errorCard: { backgroundColor: '#FFF0F0', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { color: '#D32F2F', fontSize: 14, marginBottom: 12 },
  retryButton: { backgroundColor: '#FF3B30', borderRadius: 8, padding: 10, alignItems: 'center' },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  keyCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, elevation: 2 },
  keyLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  keyValue: { fontSize: 12, color: '#333', fontFamily: 'monospace' },
  toggle: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 16 },
  toggleOn: { borderColor: '#007AFF', backgroundColor: '#E3F2FD' },
  toggleText: { color: '#333', fontWeight: '600' },
})

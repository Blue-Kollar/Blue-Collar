/**
 * WalletConnectionScreen — Stellar / WalletConnect wallet pairing UI.
 *
 * Guides the user through:
 *  1. Requesting wallet access (Freighter or WalletConnect)
 *  2. Displaying the connected public key
 *  3. Allowing disconnection
 *
 * The actual Stellar SDK calls are injected via a `walletProvider` prop so
 * unit tests can swap in a deterministic mock.
 */
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'

export type WalletStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export interface WalletProvider {
  requestAccess(): Promise<{ publicKey: string }>
  disconnect(): Promise<void>
  getPublicKey(): Promise<string | null>
}

export interface WalletConnectionScreenProps {
  walletProvider?: WalletProvider
  onConnected?: (publicKey: string) => void
  onDisconnected?: () => void
}

/** Default no-op provider shown when no real wallet SDK is injected */
const defaultProvider: WalletProvider = {
  requestAccess: async () => {
    throw new Error('No wallet provider configured')
  },
  disconnect: async () => {},
  getPublicKey: async () => null,
}

export default function WalletConnectionScreen({
  walletProvider = defaultProvider,
  onConnected,
  onDisconnected,
}: WalletConnectionScreenProps) {
  const [status, setStatus] = useState<WalletStatus>('disconnected')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleConnect() {
    setStatus('connecting')
    setErrorMessage('')
    try {
      const result = await walletProvider.requestAccess()
      setPublicKey(result.publicKey)
      setStatus('connected')
      onConnected?.(result.publicKey)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Wallet connection failed'
      setErrorMessage(msg)
      setStatus('error')
    }
  }

  async function handleDisconnect() {
    Alert.alert('Disconnect Wallet', 'Are you sure you want to disconnect your wallet?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await walletProvider.disconnect()
            setPublicKey(null)
            setStatus('disconnected')
            onDisconnected?.()
          } catch {
            setErrorMessage('Failed to disconnect wallet')
          }
        },
      },
    ])
  }

  function handleRetry() {
    setStatus('disconnected')
    setErrorMessage('')
  }

  const shortKey = publicKey
    ? `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`
    : null

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="wallet-screen"
    >
      <Text style={styles.title}>Wallet</Text>
      <Text style={styles.subtitle}>Connect your Stellar wallet to send tips and payments</Text>

      {/* Status indicator */}
      <View
        style={[
          styles.statusBadge,
          status === 'connected' && styles.statusConnected,
          status === 'error' && styles.statusError,
          status === 'connecting' && styles.statusConnecting,
        ]}
        testID="wallet-status-badge"
      >
        <Text style={styles.statusText} testID="wallet-status-text">
          {status === 'connected' && '🟢 Connected'}
          {status === 'disconnected' && '⚪ Disconnected'}
          {status === 'connecting' && '🔵 Connecting…'}
          {status === 'error' && '🔴 Connection Failed'}
        </Text>
      </View>

      {/* Connected view */}
      {status === 'connected' && publicKey && (
        <View style={styles.keyCard} testID="public-key-card">
          <Text style={styles.keyLabel}>Public Key</Text>
          <Text style={styles.keyValue} testID="public-key-value">
            {publicKey}
          </Text>
          <Text style={styles.keyShort} testID="public-key-short">
            {shortKey}
          </Text>
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}
            testID="disconnect-button"
            accessibilityLabel="Disconnect wallet"
          >
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connecting spinner */}
      {status === 'connecting' && (
        <ActivityIndicator
          size="large"
          color="#007AFF"
          style={styles.spinner}
          testID="connecting-indicator"
        />
      )}

      {/* Error view */}
      {status === 'error' && (
        <View style={styles.errorCard} testID="error-card">
          <Text style={styles.errorText} testID="error-message">{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            testID="retry-button"
            accessibilityLabel="Retry wallet connection"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connect button (shown when disconnected or after error allows retry) */}
      {(status === 'disconnected') && (
        <TouchableOpacity
          style={styles.connectButton}
          onPress={handleConnect}
          testID="connect-button"
          accessibilityLabel="Connect wallet"
        >
          <Text style={styles.connectButtonText}>Connect Wallet</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16, alignItems: 'stretch' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  statusBadge: {
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  statusConnected: { backgroundColor: '#E8F5E9' },
  statusError: { backgroundColor: '#FFEBEE' },
  statusConnecting: { backgroundColor: '#E3F2FD' },
  statusText: { fontSize: 14, fontWeight: '600', color: '#333' },
  keyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  keyLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  keyValue: { fontSize: 12, color: '#333', fontFamily: 'monospace', marginBottom: 4 },
  keyShort: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  disconnectButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  disconnectButtonText: { color: '#FF3B30', fontWeight: '600' },
  spinner: { marginVertical: 24 },
  errorCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: { color: '#D32F2F', fontSize: 14, marginBottom: 12 },
  retryButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  connectButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  connectButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
})

/**
 * ReceiveScreen — receive / payment-request flow for the BlueCollar mobile app.
 *
 * Presents the connected wallet's public key as the address others can use to
 * pay the user, with a copy-to-clipboard action and a QR placeholder.
 *
 * The address is injected (`publicKey`) or resolved from an injected
 * `walletProvider.getPublicKey()` so E2E tests are deterministic (issue #1275).
 */
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { WalletProvider } from './WalletConnectionScreen'

export interface ReceiveScreenProps {
  publicKey?: string | null
  walletProvider?: WalletProvider
  /** Injected clipboard copy handler (defaults to a no-op). */
  onCopy?: (address: string) => void
}

const MOCK_PK = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

const defaultProvider: WalletProvider = {
  requestAccess: async () => ({ publicKey: MOCK_PK }),
  disconnect: async () => {},
  getPublicKey: async () => MOCK_PK,
}

export default function ReceiveScreen({
  publicKey: publicKeyProp,
  walletProvider = defaultProvider,
  onCopy,
}: ReceiveScreenProps) {
  const [address, setAddress] = useState<string | null>(publicKeyProp ?? null)
  const [copied, setCopied] = useState(false)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let active = true
    if (publicKeyProp) {
      setAddress(publicKeyProp)
      setMissing(false)
      return
    }
    void walletProvider.getPublicKey().then((pk) => {
      if (!active) return
      if (pk) {
        setAddress(pk)
        setMissing(false)
      } else {
        setMissing(true)
      }
    })
    return () => {
      active = false
    }
  }, [publicKeyProp, walletProvider])

  function handleCopy() {
    if (!address) return
    onCopy?.(address)
    setCopied(true)
  }

  if (missing && !address) {
    return (
      <View style={styles.container} testID="receive-screen">
        <Text style={styles.title}>Receive payments</Text>
        <Text style={styles.subtitle}>Connect a wallet to generate a receive address.</Text>
        <View style={styles.errorCard} testID="no-wallet-card">
          <Text style={styles.errorText}>No wallet connected</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container} testID="receive-screen">
      <Text style={styles.title}>Receive payments</Text>
      <Text style={styles.subtitle}>Share this address so others can pay you on Stellar.</Text>

      <View style={styles.addressCard} testID="address-card">
        <Text style={styles.addressLabel}>Your receive address</Text>
        <Text style={styles.addressValue} testID="receive-address">{address}</Text>
      </View>

      {/* QR placeholder — a real build would render an SVG QR of `address`. */}
      <View style={styles.qrPlaceholder} testID="qr-code">
        <Text style={styles.qrText}>QR</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleCopy} testID="copy-button">
        <Text style={styles.primaryButtonText}>{copied ? 'Copied!' : 'Copy address'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 16, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  addressCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, elevation: 2 },
  addressLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  addressValue: { fontSize: 13, color: '#333', fontFamily: 'monospace' },
  qrPlaceholder: { width: 160, height: 160, alignSelf: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  qrText: { fontSize: 22, color: '#888', fontWeight: 'bold' },
  primaryButton: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  errorCard: { backgroundColor: '#FFF0F0', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { color: '#D32F2F', fontSize: 14 },
})

/**
 * SendScreen — send-tip / payment flow for the BlueCollar mobile app.
 *
 * The flow is:
 *   1. Enter recipient (worker id) + amount + optional asset/memo
 *   2. Review (confirmation summary)
 *   3. Submit via an injected send service → success / error
 *
 * The submit handler (`onSend`) is injected so E2E tests can run the flow with
 * a deterministic mock instead of a live Stellar network (issue #1275).
 */
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native'

export interface SendPayload {
  recipient: string
  amount: string
  asset: string
  memo?: string
}

export interface SendResult {
  txHash: string
}

export interface SendScreenProps {
  /** Injected submit handler (defaults to a no-op that resolves a fake tx hash). */
  onSend?: (payload: SendPayload) => Promise<SendResult>
  defaultAsset?: string
  /** Pre-filled recipient (e.g. from a worker profile deep link). */
  initialRecipient?: string
}

const defaultSend = async (_payload: SendPayload): Promise<SendResult> => ({
  txHash: 'mock_tx_hash_000',
})

function validateAmount(amount: string): boolean {
  const n = Number(amount)
  return Number.isFinite(n) && n > 0
}

export default function SendScreen({
  onSend = defaultSend,
  defaultAsset = 'XLM',
  initialRecipient = '',
}: SendScreenProps) {
  const [recipient, setRecipient] = useState(initialRecipient)
  const [amount, setAmount] = useState('')
  const [asset, setAsset] = useState(defaultAsset)
  const [memo, setMemo] = useState('')
  const [phase, setPhase] = useState<'form' | 'review' | 'success' | 'error'>('form')
  const [confirmation, setConfirmation] = useState<SendPayload | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const recipientMissing = recipient.trim().length === 0
  const amountInvalid = !validateAmount(amount)

  function handleReview() {
    if (recipientMissing || amountInvalid) {
      setErrorMessage('Enter a valid recipient and a positive amount')
      setPhase('error')
      return
    }
    setErrorMessage('')
    setConfirmation({ recipient: recipient.trim(), amount, asset, memo: memo.trim() || undefined })
    setPhase('review')
  }

  async function handleConfirm() {
    if (!confirmation) return
    try {
      const res = await onSend(confirmation)
      setResult(res)
      setPhase('success')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Transaction failed')
      setPhase('error')
    }
  }

  function handleEdit() {
    setPhase('form')
    setConfirmation(null)
  }

  return (
    <View style={styles.container} testID="send-screen">
      {phase === 'form' && (
        <View style={styles.form} testID="send-form">
          <Text style={styles.label}>Recipient (worker id)</Text>
          <TextInput
            style={styles.input}
            testID="recipient-input"
            value={recipient}
            onChangeText={setRecipient}
            placeholder="worker-xyz"
            accessibilityLabel="Recipient"
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            testID="amount-input"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            accessibilityLabel="Amount"
          />

          <Text style={styles.label}>Asset</Text>
          <TextInput
            style={styles.input}
            testID="asset-input"
            value={asset}
            onChangeText={setAsset}
            placeholder="XLM"
            accessibilityLabel="Asset"
          />

          <Text style={styles.label}>Memo (optional)</Text>
          <TextInput
            style={styles.input}
            testID="memo-input"
            value={memo}
            onChangeText={setMemo}
            placeholder="Thanks for the great work!"
            accessibilityLabel="Memo"
          />

          {errorMessage ? <Text style={styles.errorText} testID="form-error">{errorMessage}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleReview} testID="review-button">
            <Text style={styles.primaryButtonText}>Review</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'review' && confirmation && (
        <View style={styles.review} testID="review-view">
          <Text style={styles.title}>Confirm send</Text>
          <Text style={styles.row} testID="review-recipient">To: {confirmation.recipient}</Text>
          <Text style={styles.row} testID="review-amount">Amount: {confirmation.amount} {confirmation.asset}</Text>
          {confirmation.memo ? <Text style={styles.row} testID="review-memo">Memo: {confirmation.memo}</Text> : null}
          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleConfirm()} testID="send-button">
            <Text style={styles.primaryButtonText}>Confirm & Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleEdit} testID="edit-button">
            <Text style={styles.secondaryButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'success' && result && (
        <View style={styles.success} testID="success-screen">
          <Text style={styles.title}>Sent! ✅</Text>
          <Text style={styles.row} testID="success-txhash">Tx: {result.txHash}</Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.errorCard} testID="error-card">
          <Text style={styles.errorText} testID="error-message">{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleReview} testID="retry-button">
            <Text style={styles.retryButtonText}>Back to form</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 16 },
  form: { alignItems: 'stretch' },
  review: { alignItems: 'stretch' },
  success: { alignItems: 'center', marginTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 12 },
  label: { fontSize: 13, color: '#666', marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0' },
  row: { fontSize: 15, color: '#333', marginBottom: 8 },
  primaryButton: { backgroundColor: '#007AFF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: { marginTop: 12, alignItems: 'center', padding: 10 },
  secondaryButtonText: { color: '#007AFF', fontWeight: '600' },
  errorCard: { backgroundColor: '#FFF0F0', borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { color: '#D32F2F', fontSize: 14, marginBottom: 12 },
  retryButton: { backgroundColor: '#FF3B30', borderRadius: 8, padding: 10, alignItems: 'center' },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
})

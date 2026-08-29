/**
 * JobPostingScreen — form to create a new contact / job request.
 *
 * Users fill in a target worker ID, a message describing the job,
 * an optional preferred date, and submit via the contactRequestsApi.
 */
import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { contactRequestsApi } from '../../lib/api'

export interface JobPostingFormValues {
  workerId: string
  message: string
  preferredDate: string
}

export interface JobPostingScreenProps {
  /** Pre-selected worker ID (e.g. navigated from a worker profile) */
  initialWorkerId?: string
  onSuccess?: (requestId: string) => void
  onCancel?: () => void
}

export default function JobPostingScreen({
  initialWorkerId = '',
  onSuccess,
  onCancel,
}: JobPostingScreenProps) {
  const [workerId, setWorkerId] = useState(initialWorkerId)
  const [message, setMessage] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof JobPostingFormValues, string>>>({})
  const [networkError, setNetworkError] = useState('')

  function validate(): boolean {
    const newErrors: typeof errors = {}
    if (!workerId.trim()) newErrors.workerId = 'Worker ID is required'
    if (!message.trim()) newErrors.message = 'Message is required'
    if (message.trim().length < 10) newErrors.message = 'Message must be at least 10 characters'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    setNetworkError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      const payload: { workerId: string; message: string; preferredDate?: string } = {
        workerId: workerId.trim(),
        message: message.trim(),
      }
      if (preferredDate.trim()) payload.preferredDate = preferredDate.trim()

      const res = await contactRequestsApi.create(payload)
      if (!res.ok) {
        setNetworkError(res.error || 'Failed to submit job request')
        return
      }

      setSubmitted(true)
      const responseData = res.data as any
      Alert.alert('Request Sent', 'Your job request has been sent successfully!')
      onSuccess?.(responseData?.id ?? 'submitted')
    } catch (err) {
      setNetworkError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setWorkerId(initialWorkerId)
    setMessage('')
    setPreferredDate('')
    setErrors({})
    setNetworkError('')
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <View style={styles.successContainer} testID="success-screen">
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Request Sent!</Text>
        <Text style={styles.successMessage}>
          Your job request has been submitted successfully. The worker will respond shortly.
        </Text>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleReset}
          testID="post-another-button"
          accessibilityLabel="Post another job"
        >
          <Text style={styles.submitButtonText}>Post Another</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="job-posting-screen"
    >
      <Text style={styles.title}>Post a Job</Text>
      <Text style={styles.subtitle}>Describe the work you need done</Text>

      {/* Worker ID */}
      <Text style={styles.label}>Worker ID *</Text>
      <TextInput
        style={[styles.input, errors.workerId && styles.inputError]}
        value={workerId}
        onChangeText={(v) => {
          setWorkerId(v)
          if (errors.workerId) setErrors((e) => ({ ...e, workerId: undefined }))
        }}
        placeholder="Paste or enter worker ID"
        autoCapitalize="none"
        testID="worker-id-input"
        accessibilityLabel="Worker ID"
      />
      {errors.workerId ? (
        <Text style={styles.errorText} testID="worker-id-error">{errors.workerId}</Text>
      ) : null}

      {/* Message */}
      <Text style={styles.label}>Job Description *</Text>
      <TextInput
        style={[styles.textArea, errors.message && styles.inputError]}
        value={message}
        onChangeText={(v) => {
          setMessage(v)
          if (errors.message) setErrors((e) => ({ ...e, message: undefined }))
        }}
        placeholder="Describe the job: what needs to be done, tools required, expected duration…"
        multiline
        numberOfLines={5}
        testID="message-input"
        accessibilityLabel="Job description"
      />
      {errors.message ? (
        <Text style={styles.errorText} testID="message-error">{errors.message}</Text>
      ) : null}

      {/* Preferred date (optional) */}
      <Text style={styles.label}>Preferred Date (optional)</Text>
      <TextInput
        style={styles.input}
        value={preferredDate}
        onChangeText={setPreferredDate}
        placeholder="e.g. 2026-08-15"
        testID="preferred-date-input"
        accessibilityLabel="Preferred date"
      />

      {/* Network error */}
      {networkError ? (
        <View style={styles.networkErrorBox} testID="network-error">
          <Text style={styles.networkErrorText}>{networkError}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        {submitting ? (
          <ActivityIndicator size="large" color="#007AFF" testID="submitting-indicator" />
        ) : (
          <>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              testID="submit-button"
              accessibilityLabel="Submit job request"
            >
              <Text style={styles.submitButtonText}>Submit Request</Text>
            </TouchableOpacity>
            {onCancel && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                testID="cancel-button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FFF',
    color: '#222',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FFF',
    color: '#222',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { color: '#FF3B30', fontSize: 12, marginTop: 4 },
  networkErrorBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  networkErrorText: { color: '#D32F2F', fontSize: 14 },
  actions: { marginTop: 24, gap: 12 },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  submitButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#555', fontWeight: '600', fontSize: 16 },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F5F5F5',
  },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 8 },
  successMessage: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
})

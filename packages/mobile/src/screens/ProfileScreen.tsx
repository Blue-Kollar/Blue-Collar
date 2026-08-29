/**
 * ProfileScreen — authenticated user's profile view and edit form.
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
import { useAuth } from '../../context/AuthContext'
import { userApi } from '../../lib/api'

export default function ProfileScreen() {
  const { user, logout } = useAuth()

  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function handleSave() {
    if (!firstName.trim()) {
      setSaveError('First name is required')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const res = await userApi.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() })
      if (!res.ok) {
        setSaveError(res.error || 'Failed to update profile')
      } else {
        setEditing(false)
        Alert.alert('Saved', 'Profile updated successfully')
      }
    } catch {
      setSaveError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setFirstName(user?.firstName ?? '')
    setLastName(user?.lastName ?? '')
    setSaveError('')
    setEditing(false)
  }

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout()
        },
      },
    ])
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="profile-screen">
      <Text style={styles.title}>My Profile</Text>

      {/* Avatar placeholder */}
      <View style={styles.avatarContainer} testID="avatar-placeholder">
        <Text style={styles.avatarText}>
          {(user?.firstName?.[0] ?? '?').toUpperCase()}
          {(user?.lastName?.[0] ?? '').toUpperCase()}
        </Text>
      </View>

      {/* User details */}
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value} testID="email-value">{user?.email ?? '—'}</Text>

        <Text style={styles.label}>Role</Text>
        <Text style={styles.value} testID="role-value">{user?.role ?? '—'}</Text>

        {editing ? (
          <>
            <Text style={styles.label}>First name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              testID="first-name-input"
              accessibilityLabel="First name"
            />
            <Text style={styles.label}>Last name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              testID="last-name-input"
              accessibilityLabel="Last name"
            />

            {saveError ? (
              <Text style={styles.error} testID="save-error">{saveError}</Text>
            ) : null}

            <View style={styles.row}>
              {saving ? (
                <ActivityIndicator testID="saving-indicator" />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    testID="save-button"
                    accessibilityLabel="Save profile"
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancel}
                    testID="cancel-button"
                    accessibilityLabel="Cancel editing"
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value} testID="name-value">
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(true)}
              testID="edit-button"
              accessibilityLabel="Edit profile"
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        testID="logout-button"
        accessibilityLabel="Logout"
      >
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 16 },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  card: {
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
  label: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  value: { fontSize: 16, color: '#222' },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#222',
    marginBottom: 4,
  },
  error: { color: '#FF3B30', fontSize: 13, marginVertical: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#555', fontWeight: '600', fontSize: 15 },
  editButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  editButtonText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: { color: '#FF3B30', fontWeight: '600', fontSize: 15 },
})

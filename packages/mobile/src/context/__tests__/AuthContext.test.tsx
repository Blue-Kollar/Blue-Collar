import React from 'react'
import { Text } from 'react-native'
import { render, act, waitFor, fireEvent } from '@testing-library/react-native'
import { AuthProvider, useAuth } from '../AuthContext'

jest.mock('../../auth/SecureStorage', () => ({
  SecureStorage: {
    isAuthenticated: jest.fn(),
    getUser: jest.fn(),
    setToken: jest.fn(),
    setUser: jest.fn(),
    clear: jest.fn(),
  },
}))

jest.mock('../../auth/BiometricAuth', () => ({
  BiometricAuth: {
    isEnabled: jest.fn(),
  },
}))

const { SecureStorage } = require('../../auth/SecureStorage')
const { BiometricAuth } = require('../../auth/BiometricAuth')

function Consumer() {
  const { isAuthenticated, isLoading, isLocked, user, login, logout, unlock } = useAuth()
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="authed">{String(isAuthenticated)}</Text>
      <Text testID="locked">{String(isLocked)}</Text>
      <Text testID="user">{user ? user.email : 'none'}</Text>
      <Text testID="login" onPress={() => login('tok', { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'user' })}>
        login
      </Text>
      <Text testID="logout" onPress={() => logout()}>
        logout
      </Text>
      <Text testID="unlock" onPress={() => unlock()}>
        unlock
      </Text>
    </>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('boots into logged-out state when no token is stored (no false positive)', async () => {
    SecureStorage.isAuthenticated.mockResolvedValue(false)

    const { getByTestId } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    await waitFor(() => expect(getByTestId('loading').props.children).toBe('false'))
    expect(getByTestId('authed').props.children).toBe('false')
    expect(SecureStorage.getUser).not.toHaveBeenCalled()
  })

  it('boots into logged-in state and locked when a valid token exists and biometric is enabled', async () => {
    SecureStorage.isAuthenticated.mockResolvedValue(true)
    SecureStorage.getUser.mockResolvedValue({ id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'user' })
    BiometricAuth.isEnabled.mockResolvedValue(true)

    const { getByTestId } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    await waitFor(() => expect(getByTestId('loading').props.children).toBe('false'))
    expect(getByTestId('authed').props.children).toBe('true')
    expect(getByTestId('locked').props.children).toBe('true')
    expect(getByTestId('user').props.children).toBe('a@b.com')
  })

  it('does not lock on boot when biometric unlock is disabled', async () => {
    SecureStorage.isAuthenticated.mockResolvedValue(true)
    SecureStorage.getUser.mockResolvedValue({ id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'user' })
    BiometricAuth.isEnabled.mockResolvedValue(false)

    const { getByTestId } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    await waitFor(() => expect(getByTestId('loading').props.children).toBe('false'))
    expect(getByTestId('locked').props.children).toBe('false')
  })

  it('transitions logged out -> logging in -> logged in via login()', async () => {
    SecureStorage.isAuthenticated.mockResolvedValue(false)
    SecureStorage.setToken.mockResolvedValue(undefined)
    SecureStorage.setUser.mockResolvedValue(undefined)

    const { getByTestId } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('false'))
    expect(getByTestId('authed').props.children).toBe('false')

    await act(async () => {
      fireEvent.press(getByTestId('login'))
    })

    expect(SecureStorage.setToken).toHaveBeenCalledWith('tok')
    expect(getByTestId('authed').props.children).toBe('true')
    expect(getByTestId('user').props.children).toBe('a@b.com')
  })

  it('transitions logged in -> logged out via logout(), clearing state', async () => {
    SecureStorage.isAuthenticated.mockResolvedValue(true)
    SecureStorage.getUser.mockResolvedValue({ id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'user' })
    BiometricAuth.isEnabled.mockResolvedValue(true)
    SecureStorage.clear.mockResolvedValue(undefined)

    const { getByTestId } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('false'))
    expect(getByTestId('authed').props.children).toBe('true')

    await act(async () => {
      fireEvent.press(getByTestId('logout'))
    })

    expect(SecureStorage.clear).toHaveBeenCalled()
    expect(getByTestId('authed').props.children).toBe('false')
    expect(getByTestId('locked').props.children).toBe('false')
    expect(getByTestId('user').props.children).toBe('none')
  })

  it('unlock() clears the locked state without touching auth state', async () => {
    SecureStorage.isAuthenticated.mockResolvedValue(true)
    SecureStorage.getUser.mockResolvedValue({ id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'user' })
    BiometricAuth.isEnabled.mockResolvedValue(true)

    const { getByTestId } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => expect(getByTestId('locked').props.children).toBe('true'))

    act(() => {
      fireEvent.press(getByTestId('unlock'))
    })

    expect(getByTestId('locked').props.children).toBe('false')
    expect(getByTestId('authed').props.children).toBe('true')
  })

  it('throws when useAuth is used outside of AuthProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow('useAuth must be used within AuthProvider')
    consoleError.mockRestore()
  })
})

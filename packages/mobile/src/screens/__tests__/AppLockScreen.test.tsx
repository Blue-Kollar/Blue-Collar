import React from 'react'
import { render, waitFor, fireEvent, act } from '@testing-library/react-native'
import { AppLockScreen } from '../AppLockScreen'

jest.mock('../../auth/BiometricAuth', () => ({
  BiometricAuth: {
    authenticate: jest.fn(),
  },
}))

jest.mock('../../auth/SecureStorage', () => ({
  SecureStorage: {
    clear: jest.fn(),
  },
}))

const { BiometricAuth } = require('../../auth/BiometricAuth')
const { SecureStorage } = require('../../auth/SecureStorage')

describe('AppLockScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders as a blocking screen while awaiting biometric authentication', async () => {
    let resolveAuth: (v: any) => void = () => {}
    BiometricAuth.authenticate.mockReturnValue(new Promise((resolve) => (resolveAuth = resolve)))

    const onUnlock = jest.fn()
    const { queryByText } = render(<AppLockScreen onUnlock={onUnlock} onLogout={jest.fn()} />)

    expect(queryByText('BlueCollar')).toBeTruthy()
    expect(onUnlock).not.toHaveBeenCalled()

    await act(async () => {
      resolveAuth({ success: true })
    })
  })

  it('calls onUnlock only after a successful authentication event, not merely rendering', async () => {
    BiometricAuth.authenticate.mockResolvedValue({ success: true })
    const onUnlock = jest.fn()

    render(<AppLockScreen onUnlock={onUnlock} onLogout={jest.fn()} />)

    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1))
  })

  it('does not call onUnlock when authentication fails, and shows the error', async () => {
    BiometricAuth.authenticate.mockResolvedValue({ success: false, error: 'Face not recognized' })
    const onUnlock = jest.fn()

    const { findByText } = render(<AppLockScreen onUnlock={onUnlock} onLogout={jest.fn()} />)

    expect(await findByText('Face not recognized')).toBeTruthy()
    expect(onUnlock).not.toHaveBeenCalled()
  })

  it('does not call onUnlock when authentication is cancelled', async () => {
    BiometricAuth.authenticate.mockResolvedValue({ success: false, error: 'user_cancel' })
    const onUnlock = jest.fn()

    render(<AppLockScreen onUnlock={onUnlock} onLogout={jest.fn()} />)

    await waitFor(() => expect(BiometricAuth.authenticate).toHaveBeenCalled())
    expect(onUnlock).not.toHaveBeenCalled()
  })

  it('allows retrying authentication via the Try Again button', async () => {
    BiometricAuth.authenticate.mockResolvedValueOnce({ success: false, error: 'failed' })
    const onUnlock = jest.fn()

    const { findByText } = render(<AppLockScreen onUnlock={onUnlock} onLogout={jest.fn()} />)
    const retryButton = await findByText('Try Again')

    BiometricAuth.authenticate.mockResolvedValueOnce({ success: true })
    await act(async () => {
      fireEvent.press(retryButton)
    })

    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('logout requires an explicit action and clears storage before calling onLogout', async () => {
    BiometricAuth.authenticate.mockResolvedValue({ success: false, error: 'failed' })
    SecureStorage.clear.mockResolvedValue(undefined)
    const onLogout = jest.fn()

    const { findByText } = render(<AppLockScreen onUnlock={jest.fn()} onLogout={onLogout} />)
    const logoutButton = await findByText('Logout')

    await act(async () => {
      fireEvent.press(logoutButton)
    })

    expect(SecureStorage.clear).toHaveBeenCalled()
    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})

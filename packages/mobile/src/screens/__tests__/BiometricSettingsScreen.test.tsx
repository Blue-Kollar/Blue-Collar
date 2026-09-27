import React from 'react'
import { Alert } from 'react-native'
import { render, waitFor, fireEvent, act } from '@testing-library/react-native'
import { BiometricSettingsScreen } from '../BiometricSettingsScreen'
import { BiometricType } from '../../auth/BiometricAuth'

jest.mock('../../auth/BiometricAuth', () => {
  const actual = jest.requireActual('../../auth/BiometricAuth')
  return {
    ...actual,
    BiometricAuth: {
      getCapabilities: jest.fn(),
      isEnabled: jest.fn(),
      enableBiometric: jest.fn(),
      disableBiometric: jest.fn(),
    },
  }
})

const { BiometricAuth } = require('../../auth/BiometricAuth')

describe('BiometricSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  it('shows an unavailable message when the device has no biometric hardware', async () => {
    BiometricAuth.getCapabilities.mockResolvedValue({ isAvailable: false, supportedTypes: [], isEnrolled: false })
    BiometricAuth.isEnabled.mockResolvedValue(false)

    const { findByText } = render(<BiometricSettingsScreen />)

    expect(await findByText(/not available on this device/)).toBeTruthy()
  })

  it('reflects the persisted enabled state on cold start', async () => {
    BiometricAuth.getCapabilities.mockResolvedValue({
      isAvailable: true,
      supportedTypes: [BiometricType.FACE],
      isEnrolled: true,
    })
    BiometricAuth.isEnabled.mockResolvedValue(true)

    const { findByRole } = render(<BiometricSettingsScreen />)
    const toggle = await findByRole('switch')
    expect(toggle.props.value).toBe(true)
  })

  it('turning the toggle on persists the preference via BiometricAuth.enableBiometric', async () => {
    BiometricAuth.getCapabilities.mockResolvedValue({
      isAvailable: true,
      supportedTypes: [BiometricType.FINGERPRINT],
      isEnrolled: true,
    })
    BiometricAuth.isEnabled.mockResolvedValue(false)
    BiometricAuth.enableBiometric.mockResolvedValue({ success: true })

    const { findByRole } = render(<BiometricSettingsScreen />)
    const toggle = await findByRole('switch')

    await act(async () => {
      fireEvent(toggle, 'valueChange', true)
    })

    expect(BiometricAuth.enableBiometric).toHaveBeenCalled()
    expect(toggle.props.value).toBe(true)
  })

  it('does not flip the toggle on if enabling fails', async () => {
    BiometricAuth.getCapabilities.mockResolvedValue({
      isAvailable: true,
      supportedTypes: [BiometricType.FINGERPRINT],
      isEnrolled: true,
    })
    BiometricAuth.isEnabled.mockResolvedValue(false)
    BiometricAuth.enableBiometric.mockResolvedValue({ success: false, error: 'Auth failed' })

    const { findByRole } = render(<BiometricSettingsScreen />)
    const toggle = await findByRole('switch')

    await act(async () => {
      fireEvent(toggle, 'valueChange', true)
    })

    expect(toggle.props.value).toBe(false)
  })

  it('turning the toggle off persists via BiometricAuth.disableBiometric', async () => {
    BiometricAuth.getCapabilities.mockResolvedValue({
      isAvailable: true,
      supportedTypes: [BiometricType.FACE],
      isEnrolled: true,
    })
    BiometricAuth.isEnabled.mockResolvedValue(true)
    BiometricAuth.disableBiometric.mockResolvedValue(undefined)

    const { findByRole } = render(<BiometricSettingsScreen />)
    const toggle = await findByRole('switch')

    await act(async () => {
      fireEvent(toggle, 'valueChange', false)
    })

    expect(BiometricAuth.disableBiometric).toHaveBeenCalled()
    expect(toggle.props.value).toBe(false)
  })
})

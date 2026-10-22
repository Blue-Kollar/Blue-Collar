/**
 * Mobile E2E — Onboarding flow (#1275)
 *
 * Exercises the first-run onboarding critical path through the real
 * OnboardingScreen component using @testing-library/react-native.  The wallet
 * provider is injected so the flow is deterministic and needs no simulator or
 * live Stellar network.
 *
 * Seeded test account (deterministic, FAKE — never a real secret):
 *   GABC123... used only as a public key fixture for assertions.
 */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import OnboardingScreen from '../../src/screens/OnboardingScreen'

const SEEDED_PUBLIC_KEY =
  'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

describe('E2E — Onboarding flow (#1275)', () => {
  it('walks through welcome → connect → secure → done', async () => {
    const provider = {
      requestAccess: jest.fn().mockResolvedValue({ publicKey: SEEDED_PUBLIC_KEY }),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getPublicKey: jest.fn().mockResolvedValue(SEEDED_PUBLIC_KEY),
    }
    const onComplete = jest.fn()

    const { getByTestId } = render(<OnboardingScreen walletProvider={provider} onComplete={onComplete} />)

    // Welcome step
    expect(getByTestId('step-welcome')).toBeTruthy()
    fireEvent.press(getByTestId('get-started-button'))

    // Connect step
    expect(getByTestId('step-connect')).toBeTruthy()
    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })
    await waitFor(() => expect(getByTestId('step-secure')).toBeTruthy())
    expect(provider.requestAccess).toHaveBeenCalledTimes(1)
    expect(getByTestId('public-key-value').props.children).toBe(SEEDED_PUBLIC_KEY)

    // Secure step → finish
    fireEvent.press(getByTestId('biometric-toggle'))
    fireEvent.press(getByTestId('finish-button'))

    await waitFor(() => expect(getByTestId('step-done')).toBeTruthy())
    expect(onComplete).toHaveBeenCalledWith(SEEDED_PUBLIC_KEY)
  })

  it('shows an error and allows retry when wallet connection fails', async () => {
    const provider = {
      requestAccess: jest.fn().mockRejectedValue(new Error('User cancelled')),
      disconnect: jest.fn(),
      getPublicKey: jest.fn().mockResolvedValue(null),
    }

    const { getByTestId } = render(<OnboardingScreen walletProvider={provider} />)

    fireEvent.press(getByTestId('get-started-button'))
    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => expect(getByTestId('error-card')).toBeTruthy())
    expect(getByTestId('error-message').props.children).toBe('User cancelled')

    // Retry succeeds
    provider.requestAccess.mockResolvedValueOnce({ publicKey: SEEDED_PUBLIC_KEY })
    fireEvent.press(getByTestId('retry-button'))

    await waitFor(() => expect(getByTestId('step-secure')).toBeTruthy())
  })

  it('can resume onboarding directly at the connect step', async () => {
    const provider = {
      requestAccess: jest.fn().mockResolvedValue({ publicKey: SEEDED_PUBLIC_KEY }),
      disconnect: jest.fn(),
      getPublicKey: jest.fn(),
    }
    const { getByTestId } = render(<OnboardingScreen walletProvider={provider} startStep="connect" />)
    expect(getByTestId('step-connect')).toBeTruthy()
  })
})

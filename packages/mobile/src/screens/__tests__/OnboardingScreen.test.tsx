import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import OnboardingScreen from '../OnboardingScreen'

const PK = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

function makeProvider(overrides: Record<string, unknown> = {}) {
  return {
    requestAccess: jest.fn().mockResolvedValue({ publicKey: PK }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getPublicKey: jest.fn().mockResolvedValue(PK),
    ...overrides,
  }
}

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the welcome step and advances to connect', () => {
    const { getByTestId, queryByTestId } = render(<OnboardingScreen />)

    expect(getByTestId('onboarding-screen')).toBeTruthy()
    expect(getByTestId('step-welcome')).toBeTruthy()
    expect(queryByTestId('step-connect')).toBeNull()

    fireEvent.press(getByTestId('get-started-button'))

    expect(getByTestId('step-connect')).toBeTruthy()
    expect(queryByTestId('step-welcome')).toBeNull()
  })

  it('shows a spinner while connecting and moves to the secure step on success', async () => {
    let resolveAccess!: (value: { publicKey: string }) => void
    const provider = makeProvider({
      requestAccess: jest.fn(() => new Promise((resolve) => { resolveAccess = resolve })),
    })

    const { getByTestId, queryByTestId } = render(
      <OnboardingScreen walletProvider={provider} />
    )
    fireEvent.press(getByTestId('get-started-button'))
    fireEvent.press(getByTestId('connect-button'))

    expect(getByTestId('connecting-indicator')).toBeTruthy()
    expect(queryByTestId('connect-button')).toBeNull()

    await act(async () => {
      resolveAccess({ publicKey: PK })
    })

    await waitFor(() => expect(getByTestId('step-secure')).toBeTruthy())
    expect(getByTestId('public-key-value').props.children).toBe(PK)
    expect(provider.requestAccess).toHaveBeenCalledTimes(1)
  })

  it('toggles biometrics and completes onboarding with the connected key', async () => {
    const provider = makeProvider()
    const onComplete = jest.fn()

    const { getByTestId, getByText } = render(
      <OnboardingScreen walletProvider={provider} onComplete={onComplete} />
    )
    fireEvent.press(getByTestId('get-started-button'))
    fireEvent.press(getByTestId('connect-button'))
    await waitFor(() => expect(getByTestId('step-secure')).toBeTruthy())

    expect(getByTestId('biometric-toggle')).toBeTruthy()
    fireEvent.press(getByTestId('biometric-toggle'))
    fireEvent.press(getByTestId('finish-button'))

    expect(onComplete).toHaveBeenCalledWith(PK)
    expect(getByTestId('step-done')).toBeTruthy()

    fireEvent.press(getByTestId('copy-key-button'))
    expect(getByText('Copied!')).toBeTruthy()
  })

  it('shows the connection error and retries successfully', async () => {
    const provider = makeProvider({
      requestAccess: jest.fn()
        .mockRejectedValueOnce(new Error('User rejected'))
        .mockResolvedValueOnce({ publicKey: PK }),
    })

    const { getByTestId, queryByTestId } = render(
      <OnboardingScreen walletProvider={provider} />
    )
    fireEvent.press(getByTestId('get-started-button'))
    fireEvent.press(getByTestId('connect-button'))

    await waitFor(() => expect(getByTestId('error-card')).toBeTruthy())
    expect(getByTestId('error-message').props.children).toBe('User rejected')
    expect(queryByTestId('connect-button')).toBeNull()

    fireEvent.press(getByTestId('retry-button'))
    await waitFor(() => expect(getByTestId('step-secure')).toBeTruthy())
    expect(provider.requestAccess).toHaveBeenCalledTimes(2)
  })

  it('uses a generic message when a non-Error value is thrown', async () => {
    const provider = makeProvider({ requestAccess: jest.fn().mockRejectedValue('unknown') })

    const { getByTestId } = render(
      <OnboardingScreen walletProvider={provider} startStep="connect" />
    )
    fireEvent.press(getByTestId('connect-button'))

    await waitFor(() => expect(getByTestId('error-message').props.children).toBe('Wallet connection failed'))
  })

  it('goes back to welcome from the connect step', () => {
    const { getByTestId, queryByTestId } = render(
      <OnboardingScreen startStep="connect" />
    )
    fireEvent.press(getByTestId('back-button'))

    expect(getByTestId('step-welcome')).toBeTruthy()
    expect(queryByTestId('step-connect')).toBeNull()
  })

  it('does not render the secure step without a connected key', () => {
    const { queryByTestId } = render(<OnboardingScreen startStep="secure" />)
    expect(queryByTestId('step-secure')).toBeNull()
  })

  it('uses the default provider when none is injected', async () => {
    const { getByTestId } = render(<OnboardingScreen startStep="connect" />)

    fireEvent.press(getByTestId('connect-button'))
    await waitFor(() => expect(getByTestId('step-secure')).toBeTruthy())
    expect(getByTestId('public-key-value').props.children).toBe(PK)
  })
})

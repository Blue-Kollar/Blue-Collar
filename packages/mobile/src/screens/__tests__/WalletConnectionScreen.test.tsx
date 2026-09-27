/**
 * WalletConnectionScreen unit tests (#1040)
 *
 * Covers:
 * - Initial disconnected state
 * - Connect button triggers provider.requestAccess
 * - Connecting spinner shown while request is in-flight
 * - Connected state displays public key
 * - onConnected callback called with public key
 * - Abbreviated key shown
 * - Wallet connection failure (provider throws)
 * - Error message displayed
 * - Retry clears error and returns to disconnected
 * - Disconnect button triggers provider.disconnect
 * - onDisconnected callback
 * - No wallet provider configured error
 */
import React from 'react'
import { Alert } from 'react-native'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'

let WalletConnectionScreen: React.ComponentType<any>

beforeAll(() => {
  WalletConnectionScreen = require('../WalletConnectionScreen').default
})

// ── Mock wallet provider factory ───────────────────────────────────────────
function makeProvider(overrides: Partial<{
  requestAccess: () => Promise<{ publicKey: string }>
  disconnect: () => Promise<void>
  getPublicKey: () => Promise<string | null>
}> = {}) {
  return {
    requestAccess: jest.fn().mockResolvedValue({
      publicKey: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getPublicKey: jest.fn().mockResolvedValue(null),
    ...overrides,
  }
}

const MOCK_PK = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

describe('WalletConnectionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  // ── Initial state ─────────────────────────────────────────────────────────
  it('renders the wallet screen root', () => {
    const { getByTestId } = render(<WalletConnectionScreen />)
    expect(getByTestId('wallet-screen')).toBeTruthy()
  })

  it('starts in disconnected status', () => {
    const { getByTestId } = render(<WalletConnectionScreen />)
    expect(getByTestId('wallet-status-text').props.children).toContain('Disconnected')
  })

  it('renders the Connect Wallet button when disconnected', () => {
    const { getByTestId } = render(<WalletConnectionScreen />)
    expect(getByTestId('connect-button')).toBeTruthy()
  })

  it('does not render the public-key card while disconnected', () => {
    const { queryByTestId } = render(<WalletConnectionScreen />)
    expect(queryByTestId('public-key-card')).toBeNull()
  })

  // ── Connecting ────────────────────────────────────────────────────────────
  it('shows a connecting spinner while the wallet request is in-flight', async () => {
    let resolve!: (v: { publicKey: string }) => void
    const provider = makeProvider({
      requestAccess: jest.fn(
        () => new Promise((res) => { resolve = res })
      ),
    })

    const { getByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    act(() => {
      fireEvent.press(getByTestId('connect-button'))
    })

    expect(getByTestId('connecting-indicator')).toBeTruthy()
    expect(getByTestId('wallet-status-text').props.children).toContain('Connecting')

    // Clean up: resolve the promise
    await act(async () => { resolve({ publicKey: MOCK_PK }) })
  })

  // ── Connected ─────────────────────────────────────────────────────────────
  it('displays the public key card after successful connection', async () => {
    const provider = makeProvider()
    const { getByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => expect(getByTestId('public-key-card')).toBeTruthy())
    expect(getByTestId('public-key-value').props.children).toBe(MOCK_PK)
  })

  it('shows "Connected" status after successful connection', async () => {
    const provider = makeProvider()
    const { getByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() =>
      expect(getByTestId('wallet-status-text').props.children).toContain('Connected')
    )
  })

  it('calls onConnected with the public key', async () => {
    const provider = makeProvider()
    const onConnected = jest.fn()
    const { getByTestId } = render(
      <WalletConnectionScreen walletProvider={provider} onConnected={onConnected} />
    )

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => expect(onConnected).toHaveBeenCalledWith(MOCK_PK))
  })

  it('shows the abbreviated public key', async () => {
    const provider = makeProvider()
    const { getByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => getByTestId('public-key-short'))
    const shortKey = getByTestId('public-key-short').props.children
    expect(shortKey).toContain('…')
  })

  // ── Connection failure ────────────────────────────────────────────────────
  it('shows the error card when provider.requestAccess throws', async () => {
    const provider = makeProvider({
      requestAccess: jest.fn().mockRejectedValue(new Error('User rejected')),
    })
    const { getByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => expect(getByTestId('error-card')).toBeTruthy())
    expect(getByTestId('error-message').props.children).toBe('User rejected')
  })

  it('shows "Connection Failed" status on error', async () => {
    const provider = makeProvider({
      requestAccess: jest.fn().mockRejectedValue(new Error('Cancelled')),
    })
    const { getByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() =>
      expect(getByTestId('wallet-status-text').props.children).toContain('Failed')
    )
  })

  it('shows the retry button on error', async () => {
    const provider = makeProvider({
      requestAccess: jest.fn().mockRejectedValue(new Error('Timeout')),
    })
    const { getByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => expect(getByTestId('retry-button')).toBeTruthy())
  })

  it('returns to disconnected state and hides error when retry is pressed', async () => {
    const provider = makeProvider({
      requestAccess: jest.fn().mockRejectedValue(new Error('Timeout')),
    })
    const { getByTestId, queryByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })
    await waitFor(() => getByTestId('retry-button'))
    fireEvent.press(getByTestId('retry-button'))

    expect(queryByTestId('error-card')).toBeNull()
    expect(getByTestId('connect-button')).toBeTruthy()
    expect(getByTestId('wallet-status-text').props.children).toContain('Disconnected')
  })

  // ── Disconnect ────────────────────────────────────────────────────────────
  it('renders the Disconnect button while connected', async () => {
    const provider = makeProvider()
    const { getByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => getByTestId('disconnect-button'))
    expect(getByTestId('disconnect-button')).toBeTruthy()
  })

  it('shows a confirmation Alert when Disconnect is pressed', async () => {
    const provider = makeProvider()
    const { getByTestId } = render(<WalletConnectionScreen walletProvider={provider} />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => getByTestId('disconnect-button'))
    fireEvent.press(getByTestId('disconnect-button'))
    expect(Alert.alert).toHaveBeenCalledWith(
      'Disconnect Wallet',
      expect.any(String),
      expect.any(Array)
    )
  })

  it('calls provider.disconnect and onDisconnected when alert confirm is pressed', async () => {
    // Simulate Alert pressing the Disconnect button (index 1)
    ;(Alert.alert as jest.Mock).mockImplementation((_title, _msg, buttons) => {
      const confirmButton = buttons?.find((b: any) => b.style === 'destructive')
      confirmButton?.onPress?.()
    })

    const provider = makeProvider()
    const onDisconnected = jest.fn()
    const { getByTestId } = render(
      <WalletConnectionScreen walletProvider={provider} onDisconnected={onDisconnected} />
    )

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })
    await waitFor(() => getByTestId('disconnect-button'))

    await act(async () => {
      fireEvent.press(getByTestId('disconnect-button'))
    })

    expect(provider.disconnect).toHaveBeenCalled()
    await waitFor(() => expect(onDisconnected).toHaveBeenCalled())
  })

  // ── No provider configured ────────────────────────────────────────────────
  it('shows error card when no wallet provider is configured', async () => {
    // Default provider throws "No wallet provider configured"
    const { getByTestId } = render(<WalletConnectionScreen />)

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'))
    })

    await waitFor(() => expect(getByTestId('error-card')).toBeTruthy())
  })
})

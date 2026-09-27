/**
 * Mobile E2E — Receive flow (#1275)
 *
 * Exercises the critical "receive payments" path through the real
 * ReceiveScreen component: opening, presenting the connected wallet address,
 * and copying it to the clipboard.  The address and copy handler are injected
 * so the test is deterministic and needs no simulator.
 *
 * Seeded test account (FAKE — never a real secret): the public key below is a
 * stable fixture used only for assertions.
 */
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import ReceiveScreen from '../../src/screens/ReceiveScreen'

const SEEDED_PUBLIC_KEY =
  'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

describe('E2E — Receive flow (#1275)', () => {
  it('presents the connected wallet address and copies it', async () => {
    const onCopy = jest.fn()
    const { getByTestId } = render(<ReceiveScreen publicKey={SEEDED_PUBLIC_KEY} onCopy={onCopy} />)

    expect(getByTestId('receive-screen')).toBeTruthy()
    expect(getByTestId('address-card')).toBeTruthy()
    expect(getByTestId('receive-address').props.children).toBe(SEEDED_PUBLIC_KEY)
    // QR placeholder is rendered for scanning
    expect(getByTestId('qr-code')).toBeTruthy()

    fireEvent.press(getByTestId('copy-button'))

    expect(onCopy).toHaveBeenCalledWith(SEEDED_PUBLIC_KEY)
    expect(getByTestId('copy-button').props.children).toBe('Copied!')
  })

  it('resolves the address from an injected wallet provider', async () => {
    const provider = {
      requestAccess: jest.fn(),
      disconnect: jest.fn(),
      getPublicKey: jest.fn().mockResolvedValue(SEEDED_PUBLIC_KEY),
    }
    const { getByTestId } = render(<ReceiveScreen walletProvider={provider} />)

    await waitFor(() => expect(getByTestId('receive-address').props.children).toBe(SEEDED_PUBLIC_KEY))
    expect(provider.getPublicKey).toHaveBeenCalled()
  })

  it('prompts to connect when no wallet address is available', async () => {
    const provider = {
      requestAccess: jest.fn(),
      disconnect: jest.fn(),
      getPublicKey: jest.fn().mockResolvedValue(null),
    }
    const { getByTestId } = render(<ReceiveScreen walletProvider={provider} />)

    await waitFor(() => expect(getByTestId('no-wallet-card')).toBeTruthy())
  })
})

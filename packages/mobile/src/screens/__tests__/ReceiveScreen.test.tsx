import React from 'react'
import { render, waitFor, fireEvent } from '@testing-library/react-native'
import ReceiveScreen from '../ReceiveScreen'

const PK = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

function makeProvider(getPublicKey: () => Promise<string | null>) {
  return {
    requestAccess: jest.fn().mockResolvedValue({ publicKey: PK }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getPublicKey: jest.fn(getPublicKey),
  }
}

describe('ReceiveScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the injected public key with a QR placeholder', () => {
    const { getByTestId } = render(<ReceiveScreen publicKey={PK} />)

    expect(getByTestId('receive-screen')).toBeTruthy()
    expect(getByTestId('receive-address').props.children).toBe(PK)
    expect(getByTestId('qr-code')).toBeTruthy()
  })

  it('copies the address and shows feedback', () => {
    const onCopy = jest.fn()
    const { getByTestId, getByText } = render(<ReceiveScreen publicKey={PK} onCopy={onCopy} />)

    fireEvent.press(getByTestId('copy-button'))

    expect(onCopy).toHaveBeenCalledWith(PK)
    expect(getByText('Copied!')).toBeTruthy()
  })

  it('resolves the address from the wallet provider when no prop is given', async () => {
    const provider = makeProvider(async () => PK)
    const { getByTestId } = render(<ReceiveScreen walletProvider={provider} />)

    await waitFor(() => expect(getByTestId('receive-address').props.children).toBe(PK))
    expect(provider.getPublicKey).toHaveBeenCalledTimes(1)
  })

  it('shows the no-wallet card when the provider has no public key', async () => {
    const provider = makeProvider(async () => null)
    const { getByTestId, queryByTestId } = render(
      <ReceiveScreen walletProvider={provider} />
    )

    await waitFor(() => expect(getByTestId('no-wallet-card')).toBeTruthy())
    expect(queryByTestId('address-card')).toBeNull()
  })

  it('does not copy while the address is still unresolved', () => {
    const onCopy = jest.fn()
    const provider = makeProvider(() => new Promise<string | null>(() => {}))
    const { getByTestId } = render(
      <ReceiveScreen walletProvider={provider} onCopy={onCopy} />
    )

    expect(getByTestId('address-card')).toBeTruthy()
    fireEvent.press(getByTestId('copy-button'))

    expect(onCopy).not.toHaveBeenCalled()
  })

  it('prefers an injected public key over the provider', async () => {
    const provider = makeProvider(async () => 'other-key')
    const { getByTestId } = render(
      <ReceiveScreen publicKey={PK} walletProvider={provider} />
    )

    expect(getByTestId('receive-address').props.children).toBe(PK)
    expect(provider.getPublicKey).not.toHaveBeenCalled()
  })

  it('uses the default provider when none is injected', async () => {
    const { getByTestId } = render(<ReceiveScreen />)
    await waitFor(() => expect(getByTestId('receive-address').props.children).toBe(PK))
  })
})

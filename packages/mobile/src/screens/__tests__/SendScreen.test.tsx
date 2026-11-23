import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import SendScreen from '../SendScreen'

describe('SendScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the form with the default asset and pre-filled recipient', () => {
    const { getByTestId } = render(<SendScreen initialRecipient="worker-1" />)

    expect(getByTestId('send-screen')).toBeTruthy()
    expect(getByTestId('send-form')).toBeTruthy()
    expect(getByTestId('recipient-input').props.value).toBe('worker-1')
    expect(getByTestId('amount-input').props.value).toBe('')
    expect(getByTestId('asset-input').props.value).toBe('XLM')
    expect(getByTestId('memo-input').props.value).toBe('')
  })

  it('honours a custom default asset', () => {
    const { getByTestId } = render(<SendScreen defaultAsset="USDC" />)
    expect(getByTestId('asset-input').props.value).toBe('USDC')
  })

  it.each(['', '0', '-5', 'abc'])('rejects the invalid amount %p', (amount) => {
    const onSend = jest.fn()
    const { getByTestId } = render(<SendScreen initialRecipient="worker-1" onSend={onSend} />)

    fireEvent.changeText(getByTestId('amount-input'), amount)
    fireEvent.press(getByTestId('review-button'))

    expect(getByTestId('error-card')).toBeTruthy()
    expect(getByTestId('error-message').props.children).toBe('Enter a valid recipient and a positive amount')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('rejects a blank recipient', () => {
    const { getByTestId } = render(<SendScreen />)

    fireEvent.changeText(getByTestId('amount-input'), '10')
    fireEvent.press(getByTestId('review-button'))

    expect(getByTestId('error-card')).toBeTruthy()
  })

  it('moves to review with a trimmed payload and returns to the form on Edit', () => {
    const { getByTestId, queryByTestId } = render(<SendScreen />)

    fireEvent.changeText(getByTestId('recipient-input'), '  worker-1  ')
    fireEvent.changeText(getByTestId('amount-input'), '12.5')
    fireEvent.changeText(getByTestId('asset-input'), 'USDC')
    fireEvent.changeText(getByTestId('memo-input'), '  thanks!  ')
    fireEvent.press(getByTestId('review-button'))

    expect(getByTestId('review-view')).toBeTruthy()
    expect(queryByTestId('send-form')).toBeNull()
    expect(getByTestId('review-memo')).toBeTruthy()

    fireEvent.press(getByTestId('edit-button'))

    expect(getByTestId('send-form')).toBeTruthy()
    expect(queryByTestId('review-view')).toBeNull()
  })

  it('omits an empty memo from the review and the submitted payload', async () => {
    const onSend = jest.fn().mockResolvedValue({ txHash: 'hash-1' })
    const { getByTestId, queryByTestId } = render(
      <SendScreen initialRecipient="worker-1" onSend={onSend} />
    )

    fireEvent.changeText(getByTestId('amount-input'), '3')
    fireEvent.press(getByTestId('review-button'))

    expect(queryByTestId('review-memo')).toBeNull()
    await act(async () => {
      fireEvent.press(getByTestId('send-button'))
    })

    expect(onSend).toHaveBeenCalledWith({
      recipient: 'worker-1',
      amount: '3',
      asset: 'XLM',
      memo: undefined,
    })
    expect(getByTestId('success-screen')).toBeTruthy()
    expect(getByTestId('success-txhash').props.children).toContain('hash-1')
  })

  it('sends the reviewed payload and shows the transaction hash', async () => {
    const onSend = jest.fn().mockResolvedValue({ txHash: 'tx-abc' })
    const { getByTestId } = render(
      <SendScreen initialRecipient="worker-1" onSend={onSend} />
    )

    fireEvent.changeText(getByTestId('amount-input'), '7')
    fireEvent.changeText(getByTestId('memo-input'), 'rent')
    fireEvent.press(getByTestId('review-button'))
    await act(async () => {
      fireEvent.press(getByTestId('send-button'))
    })

    expect(onSend).toHaveBeenCalledWith({
      recipient: 'worker-1',
      amount: '7',
      asset: 'XLM',
      memo: 'rent',
    })
    await waitFor(() => expect(getByTestId('success-txhash').props.children).toContain('tx-abc'))
  })

  it('shows the error message when sending rejects with an Error', async () => {
    const onSend = jest.fn().mockRejectedValue(new Error('Insufficient balance'))
    const { getByTestId } = render(
      <SendScreen initialRecipient="worker-1" onSend={onSend} />
    )

    fireEvent.changeText(getByTestId('amount-input'), '100')
    fireEvent.press(getByTestId('review-button'))
    await act(async () => {
      fireEvent.press(getByTestId('send-button'))
    })

    await waitFor(() => expect(getByTestId('error-message').props.children).toBe('Insufficient balance'))
    fireEvent.press(getByTestId('retry-button'))
    expect(getByTestId('review-view')).toBeTruthy()
  })

  it('shows a generic error when sending rejects with a non-Error value', async () => {
    const onSend = jest.fn().mockRejectedValue('failed')
    const { getByTestId } = render(
      <SendScreen initialRecipient="worker-1" onSend={onSend} />
    )

    fireEvent.changeText(getByTestId('amount-input'), '1')
    fireEvent.press(getByTestId('review-button'))
    await act(async () => {
      fireEvent.press(getByTestId('send-button'))
    })

    expect(getByTestId('error-message').props.children).toBe('Transaction failed')
  })

  it('uses the default send handler when none is injected', async () => {
    const { getByTestId } = render(<SendScreen initialRecipient="worker-1" />)

    fireEvent.changeText(getByTestId('amount-input'), '2')
    fireEvent.press(getByTestId('review-button'))
    await act(async () => {
      fireEvent.press(getByTestId('send-button'))
    })

    await waitFor(() => expect(getByTestId('success-txhash').props.children).toContain('mock_tx_hash_000'))
  })
})

/**
 * Mobile E2E — Send flow (#1275)
 *
 * Exercises the critical "send a tip / payment" path through the real
 * SendScreen component: opening the form, entering a recipient and amount,
 * reviewing, and submitting.  The submit handler (`onSend`) is injected so the
 * test is deterministic and never touches a live Stellar network.
 *
 * Seeded test accounts (FAKE — never real secrets):
 *   recipient = seeded worker id fixture, used only to drive assertions.
 */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import SendScreen, { type SendPayload } from '../../src/screens/SendScreen'

const SEEDED_RECIPIENT = 'worker-xyz-123'
const SEEDED_TX_HASH = 'abc123def456abc123def456abc123def456abc123def456abc123def456ab'

describe('E2E — Send flow (#1275)', () => {
  it('completes the full send flow: form → review → submit → success', async () => {
    const onSend = jest.fn().mockResolvedValue({ txHash: SEEDED_TX_HASH })
    const { getByTestId } = render(<SendScreen onSend={onSend} initialRecipient={SEEDED_RECIPIENT} />)

    // Form
    expect(getByTestId('send-form')).toBeTruthy()
    fireEvent.changeText(getByTestId('amount-input'), '12.50')
    fireEvent.changeText(getByTestId('memo-input'), 'Great plumbing work')

    fireEvent.press(getByTestId('review-button'))

    // Review
    await waitFor(() => expect(getByTestId('review-view')).toBeTruthy())
    expect(getByTestId('review-recipient').props.children).toContain(SEEDED_RECIPIENT)
    expect(getByTestId('review-amount').props.children).toContain('12.50')

    await act(async () => {
      fireEvent.press(getByTestId('send-button'))
    })

    await waitFor(() => expect(getByTestId('success-screen')).toBeTruthy())
    expect(getByTestId('success-txhash').props.children).toContain(SEEDED_TX_HASH)
    expect(onSend).toHaveBeenCalledWith<[SendPayload]>({
      recipient: SEEDED_RECIPIENT,
      amount: '12.50',
      asset: 'XLM',
      memo: 'Great plumbing work',
    })
  })

  it('blocks submission and shows a validation error for an invalid amount', async () => {
    const onSend = jest.fn()
    const { getByTestId } = render(<SendScreen onSend={onSend} />)

    fireEvent.changeText(getByTestId('recipient-input'), SEEDED_RECIPIENT)
    fireEvent.changeText(getByTestId('amount-input'), '-5') // invalid

    fireEvent.press(getByTestId('review-button'))

    expect(getByTestId('error-card')).toBeTruthy()
    expect(getByTestId('error-message').props.children).toBe(
      'Enter a valid recipient and a positive amount',
    )
    expect(onSend).not.toHaveBeenCalled()
  })

  it('blocks submission when the recipient is missing', async () => {
    const onSend = jest.fn()
    const { getByTestId } = render(<SendScreen onSend={onSend} />)

    fireEvent.changeText(getByTestId('amount-input'), '10')
    fireEvent.press(getByTestId('review-button'))

    expect(getByTestId('error-card')).toBeTruthy()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('surfaces a send failure and lets the user return to the form', async () => {
    const onSend = jest
      .fn()
      .mockRejectedValue(new Error('Insufficient balance'))
    const { getByTestId } = render(<SendScreen onSend={onSend} initialRecipient={SEEDED_RECIPIENT} />)

    fireEvent.changeText(getByTestId('amount-input'), '999')
    fireEvent.press(getByTestId('review-button'))
    await waitFor(() => expect(getByTestId('review-view')).toBeTruthy())

    await act(async () => {
      fireEvent.press(getByTestId('send-button'))
    })

    await waitFor(() => expect(getByTestId('error-card')).toBeTruthy())
    expect(getByTestId('error-message').props.children).toBe('Insufficient balance')

    // Return to form and re-review
    fireEvent.press(getByTestId('retry-button'))
    expect(getByTestId('send-form')).toBeTruthy()
  })
})

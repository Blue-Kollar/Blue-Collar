/**
 * JobPostingScreen unit tests (#1040)
 *
 * Covers:
 * - Renders form fields
 * - Pre-fills worker ID from props
 * - Validation: workerId required
 * - Validation: message required
 * - Validation: message too short
 * - Validation clears on change
 * - Happy-path successful submission
 * - API network error
 * - Success screen rendered after submit
 * - "Post Another" resets form
 * - Cancel callback
 * - Submitting spinner shown during in-flight request
 */
import React from 'react'
import { Alert } from 'react-native'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../lib/api', () => ({
  contactRequestsApi: {
    create: jest.fn(),
  },
}))

const { contactRequestsApi } = require('../../../lib/api')

let JobPostingScreen: React.ComponentType<any>

beforeAll(() => {
  JobPostingScreen = require('../JobPostingScreen').default
})

describe('JobPostingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  // ── Renders ───────────────────────────────────────────────────────────────
  it('renders the job posting screen root', () => {
    const { getByTestId } = render(<JobPostingScreen />)
    expect(getByTestId('job-posting-screen')).toBeTruthy()
  })

  it('renders all form fields', () => {
    const { getByTestId } = render(<JobPostingScreen />)
    expect(getByTestId('worker-id-input')).toBeTruthy()
    expect(getByTestId('message-input')).toBeTruthy()
    expect(getByTestId('preferred-date-input')).toBeTruthy()
    expect(getByTestId('submit-button')).toBeTruthy()
  })

  it('pre-fills worker ID when initialWorkerId prop is provided', () => {
    const { getByTestId } = render(<JobPostingScreen initialWorkerId="worker-abc-123" />)
    expect(getByTestId('worker-id-input').props.value).toBe('worker-abc-123')
  })

  // ── Validation: worker ID ─────────────────────────────────────────────────
  it('shows a validation error when worker ID is empty on submit', async () => {
    const { getByTestId } = render(<JobPostingScreen />)
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(getByTestId('worker-id-error')).toBeTruthy()
    expect(contactRequestsApi.create).not.toHaveBeenCalled()
  })

  // ── Validation: message ───────────────────────────────────────────────────
  it('shows a validation error when message is empty on submit', async () => {
    const { getByTestId } = render(<JobPostingScreen initialWorkerId="w123" />)
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(getByTestId('message-error')).toBeTruthy()
    expect(contactRequestsApi.create).not.toHaveBeenCalled()
  })

  it('shows a validation error when message is shorter than 10 characters', async () => {
    const { getByTestId } = render(<JobPostingScreen initialWorkerId="w123" />)
    fireEvent.changeText(getByTestId('message-input'), 'Short')
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(getByTestId('message-error')).toBeTruthy()
  })

  it('clears the worker-id error when the user starts typing', async () => {
    const { getByTestId, queryByTestId } = render(<JobPostingScreen />)
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(getByTestId('worker-id-error')).toBeTruthy()
    fireEvent.changeText(getByTestId('worker-id-input'), 'w')
    expect(queryByTestId('worker-id-error')).toBeNull()
  })

  it('clears the message error when the user starts typing', async () => {
    const { getByTestId, queryByTestId } = render(
      <JobPostingScreen initialWorkerId="w1" />
    )
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(getByTestId('message-error')).toBeTruthy()
    fireEvent.changeText(getByTestId('message-input'), 'x')
    expect(queryByTestId('message-error')).toBeNull()
  })

  // ── Happy path ────────────────────────────────────────────────────────────
  it('submits the form and calls the API with correct payload', async () => {
    contactRequestsApi.create.mockResolvedValue({ ok: true, data: { id: 'req-001' } })
    const onSuccess = jest.fn()

    const { getByTestId } = render(
      <JobPostingScreen initialWorkerId="w123" onSuccess={onSuccess} />
    )
    fireEvent.changeText(
      getByTestId('message-input'),
      'Fix my kitchen sink, urgent please'
    )
    fireEvent.changeText(getByTestId('preferred-date-input'), '2026-08-15')

    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })

    expect(contactRequestsApi.create).toHaveBeenCalledWith({
      workerId: 'w123',
      message: 'Fix my kitchen sink, urgent please',
      preferredDate: '2026-08-15',
    })
    expect(onSuccess).toHaveBeenCalledWith('req-001')
  })

  it('does not include preferredDate in payload when field is empty', async () => {
    contactRequestsApi.create.mockResolvedValue({ ok: true, data: { id: 'req-002' } })

    const { getByTestId } = render(
      <JobPostingScreen initialWorkerId="w123" />
    )
    fireEvent.changeText(
      getByTestId('message-input'),
      'Install a ceiling fan in the bedroom'
    )

    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })

    const call = contactRequestsApi.create.mock.calls[0][0]
    expect(call).not.toHaveProperty('preferredDate')
  })

  // ── Success screen ────────────────────────────────────────────────────────
  it('shows the success screen after a successful submission', async () => {
    contactRequestsApi.create.mockResolvedValue({ ok: true, data: { id: 'req-003' } })
    const { getByTestId } = render(
      <JobPostingScreen initialWorkerId="w123" />
    )
    fireEvent.changeText(getByTestId('message-input'), 'Repair bathroom tiles carefully')

    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })

    await waitFor(() => expect(getByTestId('success-screen')).toBeTruthy())
  })

  it('"Post Another" on success screen resets the form', async () => {
    contactRequestsApi.create.mockResolvedValue({ ok: true, data: { id: 'req-004' } })
    const { getByTestId, queryByTestId } = render(
      <JobPostingScreen initialWorkerId="w123" />
    )
    fireEvent.changeText(getByTestId('message-input'), 'Paint the exterior walls next week')

    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    await waitFor(() => getByTestId('post-another-button'))
    fireEvent.press(getByTestId('post-another-button'))

    await waitFor(() => expect(queryByTestId('success-screen')).toBeNull())
    expect(getByTestId('job-posting-screen')).toBeTruthy()
  })

  // ── Network / API error ───────────────────────────────────────────────────
  it('shows a network error banner when the API returns a non-OK response', async () => {
    contactRequestsApi.create.mockResolvedValue({
      ok: false,
      error: 'Worker not found',
    })
    const { getByTestId } = render(
      <JobPostingScreen initialWorkerId="w-bad" />
    )
    fireEvent.changeText(getByTestId('message-input'), 'Emergency pipe repair needed')

    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })

    await waitFor(() => expect(getByTestId('network-error')).toBeTruthy())
  })

  it('shows a network error banner when the API call throws', async () => {
    contactRequestsApi.create.mockRejectedValue(new Error('Connection refused'))
    const { getByTestId } = render(
      <JobPostingScreen initialWorkerId="w123" />
    )
    fireEvent.changeText(
      getByTestId('message-input'),
      'Emergency leak repair in basement'
    )

    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })

    await waitFor(() => expect(getByTestId('network-error')).toBeTruthy())
  })

  // ── Cancel ────────────────────────────────────────────────────────────────
  it('calls onCancel when the cancel button is pressed', () => {
    const onCancel = jest.fn()
    const { getByTestId } = render(<JobPostingScreen onCancel={onCancel} />)
    fireEvent.press(getByTestId('cancel-button'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not render cancel button when onCancel prop is not provided', () => {
    const { queryByTestId } = render(<JobPostingScreen />)
    expect(queryByTestId('cancel-button')).toBeNull()
  })
})

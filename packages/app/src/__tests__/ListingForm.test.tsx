import { screen, waitFor } from '@testing-library/react'
import { renderWithIntl as render } from '@/__tests__/renderWithIntl'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListingForm } from '@/components/Curator/ListingForm'

const { createMutateAsync, updateMutateAsync } = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/queries', () => ({
  useCategories: () => ({
    data: { data: [{ id: 'cat-1', name: 'Plumbing' }] },
  }),
  useCreateWorker: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateWorker: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}))

const VALID_WALLET = `G${'A'.repeat(55)}`

describe('ListingForm validation', () => {
  beforeEach(() => {
    createMutateAsync.mockReset()
    updateMutateAsync.mockReset()
  })

  it('shows field errors and does not submit when the form is empty', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<ListingForm onSuccess={onSuccess} />)

    await user.click(screen.getByRole('button', { name: 'Create listing' }))

    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument()
    expect(screen.getByText('Please select a category')).toBeInTheDocument()
    expect(screen.getByText('Either phone or email is required')).toBeInTheDocument()
    expect(createMutateAsync).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('rejects a malformed Stellar wallet address', async () => {
    const user = userEvent.setup()
    render(<ListingForm />)

    await user.type(screen.getByLabelText('Full name'), 'João Silva')
    await user.selectOptions(screen.getByLabelText('Category'), 'cat-1')
    await user.type(screen.getByLabelText('Phone'), '+55 11 99999-9999')
    await user.type(screen.getByLabelText('Stellar wallet address'), 'not-a-key')
    await user.click(screen.getByRole('button', { name: 'Create listing' }))

    expect(
      await screen.findByText('Must be a valid Stellar public key (starts with G)')
    ).toBeInTheDocument()
    expect(createMutateAsync).not.toHaveBeenCalled()
  })

  it('submits valid data as FormData and reports the created worker id', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    createMutateAsync.mockResolvedValue({ data: { id: 'worker-1' } })
    render(<ListingForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Full name'), 'João Silva')
    await user.selectOptions(screen.getByLabelText('Category'), 'cat-1')
    await user.type(screen.getByLabelText('Phone'), '+55 11 99999-9999')
    await user.type(screen.getByLabelText('Stellar wallet address'), VALID_WALLET)
    await user.click(screen.getByRole('button', { name: 'Create listing' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('worker-1'))
    expect(createMutateAsync).toHaveBeenCalledTimes(1)

    const payload = createMutateAsync.mock.calls[0]?.[0] as FormData
    expect(payload).toBeInstanceOf(FormData)
    expect(payload.get('name')).toBe('João Silva')
    expect(payload.get('categoryId')).toBe('cat-1')
    expect(payload.get('phone')).toBe('+55 11 99999-9999')
    expect(payload.get('walletAddress')).toBe(VALID_WALLET)
    expect(updateMutateAsync).not.toHaveBeenCalled()
  })

  it('surfaces a server error without calling onSuccess', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    createMutateAsync.mockRejectedValue(new Error('Worker limit reached'))
    render(<ListingForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Full name'), 'João Silva')
    await user.selectOptions(screen.getByLabelText('Category'), 'cat-1')
    await user.type(screen.getByLabelText('Email'), 'worker@example.com')
    await user.click(screen.getByRole('button', { name: 'Create listing' }))

    expect(await screen.findByText('Worker limit reached')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

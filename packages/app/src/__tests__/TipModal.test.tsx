import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import messages from '@/messages/en.json'
import TipModal from '@/components/TipModal'

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// Resolve real copy from the en locale so assertions match what users see.
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const raw: string =
      (messages as Record<string, Record<string, string>>)[namespace]?.[key] ??
      `${namespace}.${key}`
    if (!params) return raw
    return Object.entries(params).reduce(
      (acc, [name, value]) => acc.split(`{${name}}`).join(String(value)),
      raw,
    )
  },
}))

const mockIsConnected = vi.fn()
const mockRequestAccess = vi.fn()
const mockGetAddress = vi.fn()
const mockSignTransaction = vi.fn()
vi.mock('@stellar/freighter-api', () => ({
  isConnected: (...args: unknown[]) => mockIsConnected(...args),
  requestAccess: (...args: unknown[]) => mockRequestAccess(...args),
  getAddress: (...args: unknown[]) => mockGetAddress(...args),
  signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
}))

// buildTipTxXdr dynamically imports the SDK; stub it so we can count how many
// times a transaction gets built per send.
const mockLoadAccount = vi.fn()
vi.mock('@stellar/stellar-sdk', () => {
  const builder = {
    addOperation: () => builder,
    setTimeout: () => builder,
    build: () => ({ toXDR: () => 'MOCK_XDR' }),
  }
  return {
    TransactionBuilder: vi.fn(() => builder),
    Operation: { payment: vi.fn(() => ({})) },
    Asset: { native: vi.fn(() => ({})) },
    BASE_FEE: '100',
    Server: vi.fn(() => ({ loadAccount: mockLoadAccount })),
  }
})

// lucide-react stubs
vi.mock('lucide-react', () => ({
  X: () => <span />,
  Loader2: () => <span />,
  CheckCircle2: () => <span />,
  AlertCircle: () => <span />,
  ExternalLink: () => <span />,
  Zap: () => <span />,
}))

const defaultProps = {
  workerName: 'John Plumber',
  walletAddress: 'GABCDEF1234567890',
}

/** Open the modal and return its dialog element. */
async function openModal(user: ReturnType<typeof userEvent.setup>) {
  render(<TipModal {...defaultProps} />)
  await user.click(screen.getByRole('button', { name: /send tip/i }))
  return screen.findByRole('dialog')
}

describe('TipModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadAccount.mockResolvedValue({})
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetAddress.mockResolvedValue({ address: 'GSENDER0000000000' })
    mockSignTransaction.mockResolvedValue({ signedTxXdr: 'SIGNED_XDR' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the trigger button', () => {
    render(<TipModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /send tip/i })).toBeInTheDocument()
  })

  it('opens modal when trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<TipModal {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /send tip/i }))
    expect(await screen.findByText('Send a Tip')).toBeInTheDocument()
  })

  it('shows worker wallet address in modal', async () => {
    const user = userEvent.setup()
    render(<TipModal {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /send tip/i }))
    expect(await screen.findByText('GABCDEF1234567890')).toBeInTheDocument()
  })

  it('Send Tip submit button is disabled when amount is empty', async () => {
    const user = userEvent.setup()
    const dialog = await openModal(user)
    const submitBtn = within(dialog).getByRole('button', { name: /^send tip$/i })
    expect(submitBtn).toBeDisabled()
  })

  it('Send Tip submit button is enabled when valid amount is entered', async () => {
    const user = userEvent.setup()
    const dialog = await openModal(user)
    await user.type(within(dialog).getByRole('spinbutton'), '5')
    expect(within(dialog).getByRole('button', { name: /^send tip$/i })).not.toBeDisabled()
  })

  it('adds the flat network fee to the amount in the summary', async () => {
    const user = userEvent.setup()
    const dialog = await openModal(user)
    await user.type(within(dialog).getByRole('spinbutton'), '5')
    // 5 XLM + 0.00001 network fee
    expect(within(dialog).getByText('5.0000100 XLM')).toBeInTheDocument()
  })

  it('shows Freighter not found when the extension is unavailable', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false })
    const user = userEvent.setup()
    const dialog = await openModal(user)
    await user.type(within(dialog).getByRole('spinbutton'), '5')
    await user.click(within(dialog).getByRole('button', { name: /^send tip$/i }))
    expect(await screen.findByText('Freighter not found')).toBeInTheDocument()
  })

  it('surfaces the insufficient-balance error instead of the generic failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: { message: 'tx failed: insufficient balance' } }),
      }),
    )

    const user = userEvent.setup()
    const dialog = await openModal(user)
    await user.type(within(dialog).getByRole('spinbutton'), '5')
    await user.click(within(dialog).getByRole('button', { name: /^send tip$/i }))

    expect(await screen.findByText('Insufficient balance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try a different amount' })).toBeInTheDocument()
    expect(screen.queryByText('Transaction failed')).not.toBeInTheDocument()
  })

  it('falls back to the generic failure for unclassified errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: { message: 'boom' } }),
      }),
    )

    const user = userEvent.setup()
    const dialog = await openModal(user)
    await user.type(within(dialog).getByRole('spinbutton'), '5')
    await user.click(within(dialog).getByRole('button', { name: /^send tip$/i }))

    expect(await screen.findByText('Transaction failed')).toBeInTheDocument()
  })

  it('builds the transaction once and signs that same XDR', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: {}, hash: 'TXHASH' }),
      }),
    )

    const user = userEvent.setup()
    const dialog = await openModal(user)
    await user.type(within(dialog).getByRole('spinbutton'), '5')
    await user.click(within(dialog).getByRole('button', { name: /^send tip$/i }))

    expect(await screen.findByText('Tip sent successfully!')).toBeInTheDocument()
    expect(mockLoadAccount).toHaveBeenCalledTimes(1)
    expect(mockSignTransaction).toHaveBeenCalledWith('MOCK_XDR', expect.anything())
  })
})

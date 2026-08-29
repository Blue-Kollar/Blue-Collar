import { render, screen, waitFor } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const WALLET = 'GWALLETOWNERADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const MARKET = 'GMARKETCONTRACTIDBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

function horizonPayment(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `pay-${i}`,
    type: 'payment',
    asset_type: 'native',
    created_at: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    from: `GSENDER${String(i).padStart(4, '0')}CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC`,
    amount: `${i + 1}.5000000`,
    transaction_hash: `hash-${i}`,
    ...overrides,
  }
}

function mockHorizon(records: unknown[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ _embedded: { records } }),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── useTransactionList ───────────────────────────────────────────────────────

describe('useTransactionList', () => {
  it('normalises Horizon records into camelCase items', async () => {
    mockHorizon([horizonPayment(0)])
    const { useTransactionList } = await import('@/hooks/useTransactionList')
    const { result } = renderHook(() => useTransactionList({ walletAddress: WALLET }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.transactions).toEqual([
      {
        id: 'pay-0',
        createdAt: '2026-07-01T10:00:00Z',
        from: 'GSENDER0000CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        amount: '1.5000000',
        transactionHash: 'hash-0',
      },
    ])
  })

  it('keeps only native incoming payments', async () => {
    mockHorizon([
      horizonPayment(0),
      horizonPayment(1, { type: 'create_account' }),
      horizonPayment(2, { asset_type: 'credit_alphanum4' }),
      horizonPayment(3, { from: WALLET }), // outgoing — self as sender
    ])
    const { useTransactionList } = await import('@/hooks/useTransactionList')
    const { result } = renderHook(() => useTransactionList({ walletAddress: WALLET }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.total).toBe(1)
    expect(result.current.transactions[0]?.id).toBe('pay-0')
  })

  it('filters to the market contract when one is supplied', async () => {
    mockHorizon([horizonPayment(0), horizonPayment(1, { from: MARKET })])
    const { useTransactionList } = await import('@/hooks/useTransactionList')
    const { result } = renderHook(() =>
      useTransactionList({ walletAddress: WALLET, marketContractId: MARKET }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.total).toBe(1)
    expect(result.current.transactions[0]?.id).toBe('pay-1')
  })

  it('pages through cached results without refetching', async () => {
    const fetchMock = mockHorizon(Array.from({ length: 25 }, (_, i) => horizonPayment(i)))
    const { useTransactionList } = await import('@/hooks/useTransactionList')
    const { result } = renderHook(() => useTransactionList({ walletAddress: WALLET }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.total).toBe(25)
    expect(result.current.totalPages).toBe(3)
    expect(result.current.transactions).toHaveLength(10)
    expect(result.current.transactions[0]?.id).toBe('pay-0')

    act(() => result.current.setPage(3))
    expect(result.current.transactions).toHaveLength(5)
    expect(result.current.transactions[0]?.id).toBe('pay-20')
    // The whole point of caching: page changes cost no network round-trip.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('clamps a stale page index when the result set shrinks', async () => {
    mockHorizon(Array.from({ length: 25 }, (_, i) => horizonPayment(i)))
    const { useTransactionList } = await import('@/hooks/useTransactionList')
    const { result, rerender } = renderHook(
      ({ address }) => useTransactionList({ walletAddress: address }),
      { initialProps: { address: WALLET } },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    mockHorizon([horizonPayment(0)])
    rerender({ address: 'GOTHERWALLETDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD' })

    await waitFor(() => expect(result.current.total).toBe(1))
    expect(result.current.page).toBe(1)
    expect(result.current.transactions).toHaveLength(1)
  })

  it('surfaces a non-ok response as an error and empties the list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    const { useTransactionList } = await import('@/hooks/useTransactionList')
    const { result } = renderHook(() => useTransactionList({ walletAddress: WALLET }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to fetch transactions')
    expect(result.current.transactions).toEqual([])
  })

  it('surfaces a network rejection as an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { useTransactionList } = await import('@/hooks/useTransactionList')
    const { result } = renderHook(() => useTransactionList({ walletAddress: WALLET }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('offline')
  })
})

// ─── Presentational components ────────────────────────────────────────────────

describe('TransactionListTable', () => {
  const transactions = [
    {
      id: 'pay-0',
      createdAt: '2026-07-01T10:00:00Z',
      from: 'GSENDERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      amount: '12.5000000',
      transactionHash: 'hash-0',
    },
  ]

  it('renders formatted values and links to the explorer', async () => {
    const { default: TransactionListTable } = await import(
      '@/components/TransactionList/TransactionListTable'
    )
    render(<TransactionListTable transactions={transactions} />)

    expect(screen.getByText('12.50 XLM')).toBeInTheDocument()
    expect(screen.getByText('GSENDE…AAAA')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View on Stellar Expert' })).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/testnet/tx/hash-0',
    )
  })

  it('is purely presentational — rendering it performs no fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { default: TransactionListTable } = await import(
      '@/components/TransactionList/TransactionListTable'
    )
    render(<TransactionListTable transactions={transactions} />)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('memoizes transaction rows to prevent unnecessary re-renders', async () => {
    const { default: TransactionListTable } = await import(
      '@/components/TransactionList/TransactionListTable'
    )
    const renderSpy = vi.fn()

    const TestWrapper = ({ transactions }: { transactions: any[] }) => {
      renderSpy()
      return <TransactionListTable transactions={transactions} />
    }

    const { rerender } = render(<TestWrapper transactions={transactions} />)
    expect(renderSpy).toHaveBeenCalledTimes(1)

    rerender(<TestWrapper transactions={transactions} />)
    expect(renderSpy).toHaveBeenCalledTimes(2)
    // Table should not re-render deeply when props are identical
  })

  it('handles large transaction lists efficiently with memoization', async () => {
    const { default: TransactionListTable } = await import(
      '@/components/TransactionList/TransactionListTable'
    )
    const largeList = Array.from({ length: 500 }, (_, i) => ({
      id: `pay-${i}`,
      createdAt: '2026-07-01T10:00:00Z',
      from: 'GSENDERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      amount: `${i + 1}.5000000`,
      transactionHash: `hash-${i}`,
    }))

    const { container } = render(<TransactionListTable transactions={largeList} />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(500)
  })
})

describe('TransactionListPagination', () => {
  it('renders nothing for a single page', async () => {
    const { default: Pagination } = await import(
      '@/components/TransactionList/TransactionListPagination'
    )
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('disables the edges and reports the page change', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    const { default: Pagination } = await import(
      '@/components/TransactionList/TransactionListPagination'
    )
    const { rerender } = render(
      <Pagination page={1} totalPages={3} onPageChange={onPageChange} />,
    )

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)

    rerender(<Pagination page={3} totalPages={3} onPageChange={onPageChange} />)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onPageChange).toHaveBeenLastCalledWith(2)
  })
})

// ─── Container ────────────────────────────────────────────────────────────────

describe('TransactionList container', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('shows the loading state, then the table', async () => {
    mockHorizon([horizonPayment(0)])
    const { default: TransactionList } = await import('@/components/TransactionList')
    render(<TransactionList walletAddress={WALLET} />)

    expect(screen.getByText(/loading transactions/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    expect(screen.getByText('1.50 XLM')).toBeInTheDocument()
  })

  it('shows the empty state when nothing matches', async () => {
    mockHorizon([])
    const { default: TransactionList } = await import('@/components/TransactionList')
    render(<TransactionList walletAddress={WALLET} />)

    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument())
    expect(screen.queryByText(/loading transactions/i)).not.toBeInTheDocument()
  })

  it('surfaces fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { default: TransactionList } = await import('@/components/TransactionList')
    render(<TransactionList walletAddress={WALLET} />)

    await waitFor(() => expect(screen.getByText('Error: offline')).toBeInTheDocument())
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('paginates end to end without refetching', async () => {
    const user = userEvent.setup()
    const fetchMock = mockHorizon(Array.from({ length: 15 }, (_, i) => horizonPayment(i)))
    const { default: TransactionList } = await import('@/components/TransactionList')
    render(<TransactionList walletAddress={WALLET} />)

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

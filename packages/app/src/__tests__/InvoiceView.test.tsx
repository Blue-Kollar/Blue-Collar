/**
 * Unit tests for InvoiceView.
 *
 * Covers rendering, every prop, the loading / error / empty states, and the
 * money arithmetic. API responses are mocked at the `@/lib/api` boundary.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

const getInvoice = vi.fn()
vi.mock('@/lib/api', () => ({
  getInvoice: (...args: unknown[]) => getInvoice(...args),
}))

import InvoiceView, { calculateSubtotal, formatAmount } from '@/components/InvoiceView'
import type { Invoice, InvoiceStatus } from '@/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_1',
    number: 'INV-2026-0042',
    status: 'issued',
    issuedAt: '2026-03-01T09:00:00.000Z',
    dueAt: '2026-03-15T09:00:00.000Z',
    currency: 'XLM',
    worker: { id: 'w1', name: 'Ada Plumbing' },
    client: { id: 'c1', name: 'Grace Hopper' },
    lineItems: [
      { id: 'li1', description: 'Pipe replacement', quantity: 2, unitAmount: 50 },
      { id: 'li2', description: 'Call-out fee', quantity: 1, unitAmount: 25 },
    ],
    platformFee: 5,
    notes: null,
    transactionHash: null,
    ...overrides,
  }
}

/**
 * Run an interaction (if given) and flush the fetch it kicks off, all inside
 * act(), so the resulting state update doesn't land after the assertion.
 */
async function settled(interaction?: () => Promise<unknown>) {
  await act(async () => {
    await interaction?.()
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getInvoice.mockResolvedValue({ data: makeInvoice() })
})

// ─── Fetching ─────────────────────────────────────────────────────────────────

describe('InvoiceView — fetching', () => {
  it('requests the invoice by id on mount', async () => {
    render(<InvoiceView invoiceId="inv_1" />)
    await waitFor(() => expect(getInvoice).toHaveBeenCalledWith('inv_1'))
    await screen.findByRole('heading', { name: /INV-2026-0042/ })
  })

  it('refetches when the invoiceId prop changes', async () => {
    const { rerender } = render(<InvoiceView invoiceId="inv_1" />)
    await screen.findByRole('heading', { name: /INV-2026-0042/ })

    getInvoice.mockResolvedValue({ data: makeInvoice({ id: 'inv_2', number: 'INV-2026-0043' }) })
    rerender(<InvoiceView invoiceId="inv_2" />)

    await waitFor(() => expect(getInvoice).toHaveBeenLastCalledWith('inv_2'))
    expect(await screen.findByRole('heading', { name: /INV-2026-0043/ })).toBeInTheDocument()
  })

  it('does not fetch when a pre-fetched invoice is supplied', async () => {
    render(<InvoiceView invoiceId="inv_1" invoice={makeInvoice({ number: 'INV-PREFETCHED' })} />)

    expect(await screen.findByRole('heading', { name: /INV-PREFETCHED/ })).toBeInTheDocument()
    expect(getInvoice).not.toHaveBeenCalled()
  })
})

// ─── Loading state ────────────────────────────────────────────────────────────

describe('InvoiceView — loading state', () => {
  it('shows a status region while the request is in flight', async () => {
    let resolve: (value: unknown) => void = () => {}
    getInvoice.mockReturnValue(new Promise((r) => { resolve = r }))

    render(<InvoiceView invoiceId="inv_1" />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Loading invoice…')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()

    await act(async () => {
      resolve({ data: makeInvoice() })
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('starts in the loaded state when given a pre-fetched invoice', () => {
    render(<InvoiceView invoiceId="inv_1" invoice={makeInvoice()} />)
    // No loading flash for server-rendered data.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /INV-2026-0042/ })).toBeInTheDocument()
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe('InvoiceView — error state', () => {
  it('renders a friendly alert when the request fails', async () => {
    getInvoice.mockRejectedValue(new Error('500 Internal Server Error'))

    render(<InvoiceView invoiceId="inv_1" />)

    const alert = await screen.findByRole('alert')
    // Raw backend copy must not reach the user.
    expect(alert).not.toHaveTextContent('500 Internal Server Error')
    expect(alert).toHaveTextContent('Something went wrong on our end.')
  })

  it('falls back to an invoice-specific message for unrecognised errors', async () => {
    getInvoice.mockRejectedValue(new Error('kaboom'))

    render(<InvoiceView invoiceId="inv_1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load this invoice.",
    )
  })

  it('maps a network failure to connectivity copy', async () => {
    getInvoice.mockRejectedValue(new Error('Failed to fetch'))

    render(<InvoiceView invoiceId="inv_1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect.')
  })

  it('retries the request when Try again is pressed', async () => {
    const user = userEvent.setup()
    getInvoice.mockRejectedValueOnce(new Error('kaboom'))

    render(<InvoiceView invoiceId="inv_1" />)
    await screen.findByRole('alert')

    getInvoice.mockResolvedValue({ data: makeInvoice() })
    await settled(() => user.click(screen.getByRole('button', { name: 'Try again' })))

    expect(screen.getByRole('heading', { name: /INV-2026-0042/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getInvoice).toHaveBeenCalledTimes(2)
  })

  it('shows the error again if the retry also fails', async () => {
    const user = userEvent.setup()
    getInvoice.mockRejectedValue(new Error('kaboom'))

    render(<InvoiceView invoiceId="inv_1" />)
    await screen.findByRole('alert')

    await settled(() => user.click(screen.getByRole('button', { name: 'Try again' })))

    expect(getInvoice).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

// ─── Empty states ─────────────────────────────────────────────────────────────

describe('InvoiceView — empty states', () => {
  it('renders a not-found panel when the response carries no invoice', async () => {
    getInvoice.mockResolvedValue({ data: null })

    render(<InvoiceView invoiceId="inv_1" />)

    expect(await screen.findByText('Invoice not found')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders an empty-line-items message but still shows totals', async () => {
    getInvoice.mockResolvedValue({ data: makeInvoice({ lineItems: [], platformFee: 0 }) })

    render(<InvoiceView invoiceId="inv_1" />)

    expect(await screen.findByText('This invoice has no line items yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    // The invoice header and a zeroed total still render.
    expect(screen.getByRole('heading', { name: /INV-2026-0042/ })).toBeInTheDocument()
    expect(screen.getByText('Total').closest('div')).toHaveTextContent('0.00 XLM')
  })
})

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('InvoiceView — rendering', () => {
  it('renders the invoice number, parties and dates', async () => {
    render(<InvoiceView invoiceId="inv_1" />)

    expect(await screen.findByRole('heading', { name: 'Invoice INV-2026-0042' })).toBeInTheDocument()
    expect(screen.getByText('Ada Plumbing')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('Mar 1, 2026')).toBeInTheDocument()
    expect(screen.getByText('Mar 15, 2026')).toBeInTheDocument()
  })

  it('renders dates as machine-readable time elements', async () => {
    const { container } = render(<InvoiceView invoiceId="inv_1" />)
    await screen.findByRole('heading', { name: /INV-2026-0042/ })

    const times = container.querySelectorAll('time')
    expect(times).toHaveLength(2)
    expect(times[0]).toHaveAttribute('dateTime', '2026-03-01T09:00:00.000Z')
    expect(times[1]).toHaveAttribute('dateTime', '2026-03-15T09:00:00.000Z')
  })

  it('omits the due date when the invoice has none', async () => {
    getInvoice.mockResolvedValue({ data: makeInvoice({ dueAt: null }) })
    const { container } = render(<InvoiceView invoiceId="inv_1" />)
    await screen.findByRole('heading', { name: /INV-2026-0042/ })

    expect(container.querySelectorAll('time')).toHaveLength(1)
    expect(screen.queryByText(/Due/)).not.toBeInTheDocument()
  })

  it('renders one table row per line item with a per-row amount', async () => {
    render(<InvoiceView invoiceId="inv_1" />)

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    // Header row plus two line items.
    expect(rows).toHaveLength(3)

    const first = within(table).getByRole('row', { name: /Pipe replacement/ })
    expect(within(first).getByText('2')).toBeInTheDocument()
    expect(within(first).getByText('50.00 XLM')).toBeInTheDocument()
    // 2 × 50
    expect(within(first).getByText('100.00 XLM')).toBeInTheDocument()
  })

  it('gives the line-item table an accessible caption and column headers', async () => {
    render(<InvoiceView invoiceId="inv_1" />)

    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Description',
      'Qty',
      'Unit price',
      'Amount',
    ])
    expect(table).toHaveAccessibleName('Line items for invoice INV-2026-0042')
  })

  it('computes subtotal, platform fee and total', async () => {
    render(<InvoiceView invoiceId="inv_1" />)
    await screen.findByRole('table')

    // 2×50 + 1×25 = 125, + 5 fee = 130
    expect(screen.getByText('Subtotal').closest('div')).toHaveTextContent('125.00 XLM')
    expect(screen.getByText('Platform fee').closest('div')).toHaveTextContent('5.00 XLM')
    expect(screen.getByText('Total').closest('div')).toHaveTextContent('130.00 XLM')
  })

  it('exposes the invoice as a region labelled by its heading', async () => {
    render(<InvoiceView invoiceId="inv_1" />)

    const heading = await screen.findByRole('heading', { name: /INV-2026-0042/ })
    const region = screen.getByRole('region', { name: /INV-2026-0042/ })
    expect(region).toHaveAttribute('aria-labelledby', heading.id)
  })

  it('renders notes only when present', async () => {
    getInvoice.mockResolvedValue({ data: makeInvoice({ notes: 'Paid in two instalments.' }) })
    const { unmount } = render(<InvoiceView invoiceId="inv_1" />)
    expect(await screen.findByText('Paid in two instalments.')).toBeInTheDocument()
    unmount()

    getInvoice.mockResolvedValue({ data: makeInvoice({ notes: null }) })
    render(<InvoiceView invoiceId="inv_1" />)
    await screen.findByRole('table')
    expect(screen.queryByText('Paid in two instalments.')).not.toBeInTheDocument()
  })

  it('links to the Stellar explorer once a transaction hash exists', async () => {
    getInvoice.mockResolvedValue({ data: makeInvoice({ status: 'paid', transactionHash: 'abc123' }) })

    render(<InvoiceView invoiceId="inv_1" />)

    const link = await screen.findByRole('link', { name: /View transaction on Stellar/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('abc123'))
    expect(link).toHaveAttribute('target', '_blank')
    // Opening in a new tab without noopener is a tabnabbing risk.
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('hides the transaction link when the invoice is unpaid', async () => {
    render(<InvoiceView invoiceId="inv_1" />)
    await screen.findByRole('table')
    expect(screen.queryByRole('link', { name: /View transaction/ })).not.toBeInTheDocument()
  })

  it.each<[InvoiceStatus, string]>([
    ['draft', 'Draft'],
    ['issued', 'Issued'],
    ['paid', 'Paid'],
    ['overdue', 'Overdue'],
    ['void', 'Void'],
  ])('renders the %s status badge', async (status, label) => {
    getInvoice.mockResolvedValue({ data: makeInvoice({ status }) })

    render(<InvoiceView invoiceId="inv_1" />)

    expect(await screen.findByText(label)).toBeInTheDocument()
  })
})

// ─── Props ────────────────────────────────────────────────────────────────────

describe('InvoiceView — props', () => {
  it('hides the download action when onDownload is not supplied', async () => {
    render(<InvoiceView invoiceId="inv_1" />)
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
  })

  it('calls onDownload with the loaded invoice', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()

    render(<InvoiceView invoiceId="inv_1" onDownload={onDownload} />)
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Download' }))

    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ number: 'INV-2026-0042' }))
  })

  it('applies className to the loaded, loading, error and not-found states', async () => {
    // Loaded
    const loaded = render(<InvoiceView invoiceId="inv_1" invoice={makeInvoice()} className="mt-8" />)
    expect(loaded.container.firstElementChild).toHaveClass('mt-8')
    loaded.unmount()

    // Loading
    getInvoice.mockReturnValue(new Promise(() => {}))
    const loading = render(<InvoiceView invoiceId="inv_1" className="mt-8" />)
    expect(loading.container.firstElementChild).toHaveClass('mt-8')
    loading.unmount()

    // Error
    getInvoice.mockRejectedValue(new Error('kaboom'))
    const errored = render(<InvoiceView invoiceId="inv_1" className="mt-8" />)
    await screen.findByRole('alert')
    expect(errored.container.firstElementChild).toHaveClass('mt-8')
    errored.unmount()

    // Not found
    getInvoice.mockResolvedValue({ data: null })
    const missing = render(<InvoiceView invoiceId="inv_1" className="mt-8" />)
    await screen.findByText('Invoice not found')
    expect(missing.container.firstElementChild).toHaveClass('mt-8')
  })
})

// ─── Exported helpers ─────────────────────────────────────────────────────────

describe('calculateSubtotal', () => {
  it('sums quantity × unit price across line items', () => {
    expect(
      calculateSubtotal([
        { id: 'a', description: 'a', quantity: 2, unitAmount: 50 },
        { id: 'b', description: 'b', quantity: 3, unitAmount: 10 },
      ]),
    ).toBe(130)
  })

  it('returns 0 for no line items', () => {
    expect(calculateSubtotal([])).toBe(0)
  })
})

describe('formatAmount', () => {
  it('always shows at least two decimal places', () => {
    expect(formatAmount(5, 'XLM')).toBe('5.00 XLM')
  })

  it('preserves Stellar precision up to seven decimals', () => {
    expect(formatAmount(1.1234567, 'XLM')).toBe('1.1234567 XLM')
  })

  it('groups thousands', () => {
    expect(formatAmount(1234567.5, 'XLM')).toBe('1,234,567.50 XLM')
  })

  it('uses the invoice currency', () => {
    expect(formatAmount(10, 'USDC')).toBe('10.00 USDC')
  })
})

/**
 * walletConnection.integration.test.tsx — integration tests for the wallet
 * connect-to-authenticated-session flow (#1261).
 *
 * Unlike walletConnection.test.tsx (unit tests for hooks in isolation), this
 * file tests the full integration between:
 *
 *  1. WalletProvider context
 *  2. The WalletGuard component (blocks rendering until wallet is connected)
 *  3. Components that consume the wallet context (WalletConnectButton patterns)
 *
 * Tests are grouped by scenario:
 *  - connect flow: full connect → sign → session persisted
 *  - rejection / cancel path
 *  - session restore on re-mount
 *  - WalletGuard integration
 *
 * Environment: jsdom (Vitest) with @testing-library/react.
 * All Freighter calls are mocked so no real network is hit.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ── Freighter mock ────────────────────────────────────────────────────────────

const mockIsConnected = vi.fn()
const mockRequestAccess = vi.fn()
const mockGetAddress = vi.fn()
const mockGetNetwork = vi.fn()
const mockSignTransaction = vi.fn()

vi.mock('@stellar/freighter-api', () => ({
  isConnected: (...args: unknown[]) => mockIsConnected(...args),
  requestAccess: (...args: unknown[]) => mockRequestAccess(...args),
  getAddress: (...args: unknown[]) => mockGetAddress(...args),
  getNetwork: (...args: unknown[]) => mockGetNetwork(...args),
  signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
}))

// ── localStorage stub ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'bc_wallet_address'
const store: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear: () => Object.keys(store).forEach((k) => delete store[k]),
})

// ── fetch stub (Horizon balance) ──────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── window.open stub ──────────────────────────────────────────────────────────

const mockOpen = vi.fn()
vi.stubGlobal('window', { open: mockOpen })

// ── Imports (after all mocks) ─────────────────────────────────────────────────

import { WalletProvider, useWallet } from '@/context/WalletContext'
import WalletGuard from '@/components/Payment/WalletGuard'

// ── Constants ─────────────────────────────────────────────────────────────────

const MOCK_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'
const ALT_ADDRESS  = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const MOCK_XDR     = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='

function stubBalance(balance = '100.0000000') {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ balances: [{ asset_type: 'native', balance }] }),
  })
}

// ── Wrapper ───────────────────────────────────────────────────────────────────

function ProviderWrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(WalletProvider, null, children)
}

// ── Minimal consumer component for integration tests ─────────────────────────

function WalletConsumer() {
  const { publicKey, isConnected, isConnecting, network, balance, connect, disconnect } = useWallet()

  return (
    <div>
      <div data-testid="public-key">{publicKey ?? 'none'}</div>
      <div data-testid="network">{network ?? 'none'}</div>
      <div data-testid="balance">{balance ?? 'none'}</div>
      <div data-testid="is-connected">{String(isConnected)}</div>
      <div data-testid="is-connecting">{String(isConnecting)}</div>
      <button data-testid="connect-btn" onClick={connect}>Connect</button>
      <button data-testid="disconnect-btn" onClick={disconnect}>Disconnect</button>
    </div>
  )
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockIsConnected.mockResolvedValue({ isConnected: false })
  mockRequestAccess.mockResolvedValue({ address: MOCK_ADDRESS })
  mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS })
  mockGetNetwork.mockResolvedValue({ network: 'TESTNET', networkPassphrase: 'Test SDF Network ; September 2015' })
  mockSignTransaction.mockResolvedValue({ signedTxXdr: 'signed-xdr-value' })
  stubBalance()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ═════════════════════════════════════════════════════════════════════════════
// Full connect → sign → session persisted
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: connect → sign → session persisted', () => {
  it('renders disconnected state before any interaction', async () => {
    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await waitFor(() => {
      expect(screen.getByTestId('is-connecting').textContent).toBe('false')
    })

    expect(screen.getByTestId('public-key').textContent).toBe('none')
    expect(screen.getByTestId('is-connected').textContent).toBe('false')
  })

  it('connects, sets publicKey, network, and balance in one flow', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    stubBalance('250.0000000')

    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('public-key').textContent).toBe(MOCK_ADDRESS)
    })

    expect(screen.getByTestId('network').textContent).toBe('TESTNET')
    expect(screen.getByTestId('balance').textContent).toBe('250.0000000')
    expect(screen.getByTestId('is-connected').textContent).toBe('true')
  })

  it('persists session to localStorage after connect', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })

    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-btn'))
    })

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe(MOCK_ADDRESS)
    })
  })

  it('clears session from localStorage after disconnect', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })

    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('is-connected').textContent).toBe('true')
    })

    act(() => {
      fireEvent.click(screen.getByTestId('disconnect-btn'))
    })

    expect(screen.getByTestId('public-key').textContent).toBe('none')
    expect(screen.getByTestId('balance').textContent).toBe('none')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Rejection / cancel path
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: rejection / cancel path', () => {
  it('stays disconnected when user rejects the connection', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockRequestAccess.mockRejectedValue(new Error('User rejected'))

    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('is-connecting').textContent).toBe('false')
    })

    expect(screen.getByTestId('public-key').textContent).toBe('none')
    expect(screen.getByTestId('is-connected').textContent).toBe('false')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('opens install page when Freighter is not installed', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false })

    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('is-connecting').textContent).toBe('false')
    })

    expect(mockOpen).toHaveBeenCalledWith('https://www.freighter.app', '_blank')
    expect(screen.getByTestId('public-key').textContent).toBe('none')
  })

  it('resets isConnecting to false after rejection', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetAddress.mockRejectedValue(new Error('getAddress failed'))

    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('is-connecting').textContent).toBe('false')
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Session restore on mount
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: session restore on mount', () => {
  it('restores session if stored address matches Freighter', async () => {
    localStorage.setItem(STORAGE_KEY, MOCK_ADDRESS)
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS })
    stubBalance('75.0000000')

    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await waitFor(() => {
      expect(screen.getByTestId('public-key').textContent).toBe(MOCK_ADDRESS)
    }, { timeout: 3000 })

    expect(screen.getByTestId('is-connected').textContent).toBe('true')
    expect(screen.getByTestId('network').textContent).toBe('TESTNET')
  })

  it('clears stale localStorage when stored address does not match Freighter', async () => {
    localStorage.setItem(STORAGE_KEY, MOCK_ADDRESS)
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetAddress.mockResolvedValue({ address: ALT_ADDRESS }) // mismatch

    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await waitFor(() => {
      expect(screen.getByTestId('public-key').textContent).toBe('none')
    }, { timeout: 3000 })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('does nothing on mount when localStorage is empty', async () => {
    render(<WalletConsumer />, { wrapper: ProviderWrapper })

    await waitFor(() => {
      expect(screen.getByTestId('is-connecting').textContent).toBe('false')
    })

    // isConnected should NOT have been called — no stored key → early return
    expect(mockIsConnected).not.toHaveBeenCalled()
    expect(screen.getByTestId('public-key').textContent).toBe('none')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// WalletGuard component integration
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: WalletGuard', () => {
  it('renders the prompt/fallback when wallet is not connected', async () => {
    render(
      <WalletProvider>
        <WalletGuard>
          <div data-testid="protected-content">Protected!</div>
        </WalletGuard>
      </WalletProvider>
    )

    await waitFor(() => {
      expect(screen.queryByTestId('protected-content')).toBeNull()
    })
  })

  it('renders protected children after successful wallet connection', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    localStorage.setItem(STORAGE_KEY, MOCK_ADDRESS)
    mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS })

    render(
      <WalletProvider>
        <WalletGuard>
          <div data-testid="protected-content">Protected!</div>
        </WalletGuard>
      </WalletProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeTruthy()
    }, { timeout: 3000 })
  })
})

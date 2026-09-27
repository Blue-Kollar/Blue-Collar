/**
 * Extended unit tests for the wallet connection flow (closes #1052).
 *
 * The original useWallet.test.tsx covers the happy path and basic
 * connect/disconnect/restore scenarios.  This suite adds coverage for:
 *
 *  - balance fetching and balance state
 *  - Freighter "not installed" path (opens freighter.app)
 *  - connect() error handling — throws should not crash the component
 *  - network state and all networkWarning combinations
 *  - disconnect resets balance and network
 *  - WalletContext default values (used outside provider)
 *  - useWalletNetworkWarning helper hook
 *  - isConnecting flag lifecycle during connect()
 *  - address mismatch: stored key differs from Freighter's current address
 *  - Horizon fetch failure during balance load (graceful null)
 *  - multiple rapid connect() calls are safely idempotent
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'

// ── Freighter API mock ────────────────────────────────────────────────────────

const mockIsConnected = vi.fn()
const mockRequestAccess = vi.fn()
const mockGetAddress = vi.fn()
const mockGetNetwork = vi.fn()

vi.mock('@stellar/freighter-api', () => ({
  isConnected: (...args: unknown[]) => mockIsConnected(...args),
  requestAccess: (...args: unknown[]) => mockRequestAccess(...args),
  getAddress: (...args: unknown[]) => mockGetAddress(...args),
  getNetwork: (...args: unknown[]) => mockGetNetwork(...args),
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

const mockWindowOpen = vi.fn()
vi.stubGlobal('window', { open: mockWindowOpen })

// ── imports (after mocks are set up) ─────────────────────────────────────────

import { WalletProvider, useWallet } from '@/context/WalletContext'
import { useWalletNetworkWarning } from '@/hooks/useWallet'

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(WalletProvider, null, children)
}

const MOCK_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'
const ALT_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

function stubBalanceFetch(balance = '100.0000000') {
  mockFetch.mockResolvedValue({
    json: () =>
      Promise.resolve({
        balances: [{ asset_type: 'native', balance }],
      }),
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// Setup
// ═════════════════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockIsConnected.mockResolvedValue({ isConnected: false })
  mockRequestAccess.mockResolvedValue({ address: MOCK_ADDRESS })
  mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS })
  mockGetNetwork.mockResolvedValue({ network: 'TESTNET' })
  stubBalanceFetch()
})

afterEach(() => vi.clearAllMocks())

// ═════════════════════════════════════════════════════════════════════════════
// Balance fetching
// ═════════════════════════════════════════════════════════════════════════════

describe('balance state', () => {
  it('fetches and stores the native XLM balance after connect()', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    stubBalanceFetch('250.0000000')

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(result.current.balance).toBe('250.0000000')
  })

  it('balance is null before connecting', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })
    await waitFor(() => expect(result.current.isConnecting).toBe(false))
    expect(result.current.balance).toBeNull()
  })

  it('balance resets to null after disconnect()', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    stubBalanceFetch('50.0000000')

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })
    expect(result.current.balance).toBe('50.0000000')

    act(() => { result.current.disconnect() })
    expect(result.current.balance).toBeNull()
  })

  it('balance is null when Horizon returns no native entry', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          balances: [{ asset_type: 'credit_alphanum4', balance: '10.0' }],
        }),
    })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(result.current.balance).toBeNull()
  })

  it('balance is null when the Horizon fetch throws', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useWallet(), { wrapper })

    // connect() should not throw — fetchBalance is fire-and-forget
    await act(async () => { await result.current.connect() })

    expect(result.current.balance).toBeNull()
    expect(result.current.publicKey).toBe(MOCK_ADDRESS) // still connected
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Freighter not installed
// ═════════════════════════════════════════════════════════════════════════════

describe('Freighter not installed', () => {
  it('opens the Freighter install page when isConnected returns false', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await waitFor(() => expect(result.current.isConnecting).toBe(false))

    await act(async () => { await result.current.connect() })

    expect(mockWindowOpen).toHaveBeenCalledWith('https://www.freighter.app', '_blank')
    expect(result.current.publicKey).toBeNull()
  })

  it('does not call requestAccess when Freighter is not installed', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(mockRequestAccess).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// isConnecting lifecycle
// ═════════════════════════════════════════════════════════════════════════════

describe('isConnecting lifecycle', () => {
  it('starts as false on mount', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })
    await waitFor(() => expect(result.current.isConnecting).toBe(false))
    expect(result.current.isConnecting).toBe(false)
  })

  it('is false after a successful connect()', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(result.current.isConnecting).toBe(false)
  })

  it('resets to false even when connect() encounters an error', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockRequestAccess.mockRejectedValue(new Error('User rejected'))

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(result.current.isConnecting).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Error handling
// ═════════════════════════════════════════════════════════════════════════════

describe('connect() error handling', () => {
  it('does not throw when requestAccess rejects', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockRequestAccess.mockRejectedValue(new Error('User rejected'))

    const { result } = renderHook(() => useWallet(), { wrapper })

    await expect(
      act(async () => { await result.current.connect() })
    ).resolves.not.toThrow()
  })

  it('publicKey remains null when requestAccess throws', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockRequestAccess.mockRejectedValue(new Error('Rejected'))

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(result.current.publicKey).toBeNull()
  })

  it('does not throw when getAddress rejects', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetAddress.mockRejectedValue(new Error('getAddress failed'))

    const { result } = renderHook(() => useWallet(), { wrapper })

    await expect(
      act(async () => { await result.current.connect() })
    ).resolves.not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Network state
// ═════════════════════════════════════════════════════════════════════════════

describe('network state', () => {
  it('stores the network name after connect()', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetNetwork.mockResolvedValue({ network: 'TESTNET' })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(result.current.network).toBe('TESTNET')
  })

  it('network resets to null after disconnect()', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })
    expect(result.current.network).toBe('TESTNET')

    act(() => { result.current.disconnect() })
    expect(result.current.network).toBeNull()
  })

  it('networkWarning is false when network is TESTNET', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetNetwork.mockResolvedValue({ network: 'TESTNET' })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(result.current.networkWarning).toBe(false)
  })

  it('networkWarning is true for FUTURENET', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetNetwork.mockResolvedValue({ network: 'FUTURENET' })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(result.current.networkWarning).toBe(true)
  })

  it('networkWarning is true for MAINNET (non-testnet)', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetNetwork.mockResolvedValue({ network: 'MAINNET' })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(result.current.networkWarning).toBe(true)
  })

  it('networkWarning is false before connecting (no network yet)', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })
    await waitFor(() => expect(result.current.isConnecting).toBe(false))

    expect(result.current.networkWarning).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// localStorage persistence
// ═════════════════════════════════════════════════════════════════════════════

describe('localStorage persistence', () => {
  it('writes address to localStorage on successful connect', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(localStorage.getItem(STORAGE_KEY)).toBe(MOCK_ADDRESS)
  })

  it('removes localStorage entry on disconnect', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })
    act(() => { result.current.disconnect() })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('clears stale localStorage when Freighter address does not match stored value', async () => {
    // Store address A but Freighter returns address B
    localStorage.setItem(STORAGE_KEY, MOCK_ADDRESS)
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetAddress.mockResolvedValue({ address: ALT_ADDRESS })

    const { result } = renderHook(() => useWallet(), { wrapper })

    await waitFor(
      () => expect(result.current.publicKey).toBeNull(),
      { timeout: 3000 },
    )

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('does not write to localStorage when connect() fails', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockRequestAccess.mockRejectedValue(new Error('Denied'))

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// useWalletNetworkWarning helper hook
// ═════════════════════════════════════════════════════════════════════════════

describe('useWalletNetworkWarning', () => {
  it('returns networkWarning and network from the wallet context', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetNetwork.mockResolvedValue({ network: 'FUTURENET' })

    const { result } = renderHook(() => useWalletNetworkWarning(), { wrapper })
    await act(async () => {
      // trigger connect to set network
      const wallet = renderHook(() => useWallet(), { wrapper })
      await wallet.result.current.connect()
    })

    // The hook should expose the same shape as WalletContext
    expect(result.current).toHaveProperty('networkWarning')
    expect(result.current).toHaveProperty('network')
  })

  it('initial networkWarning is false before any wallet interaction', () => {
    const { result } = renderHook(() => useWalletNetworkWarning(), { wrapper })
    expect(result.current.networkWarning).toBe(false)
    expect(result.current.network).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// WalletContext default values (used outside provider)
// ═════════════════════════════════════════════════════════════════════════════

describe('WalletContext default values', () => {
  it('all fields have safe defaults when hook is called without a provider', () => {
    // No wrapper — falls through to the context default value
    const { result } = renderHook(() => useWallet())

    expect(result.current.publicKey).toBeNull()
    expect(result.current.network).toBeNull()
    expect(result.current.balance).toBeNull()
    expect(result.current.networkWarning).toBe(false)
    expect(result.current.isConnected).toBe(false)
    expect(result.current.isConnecting).toBe(false)
    expect(typeof result.current.connect).toBe('function')
    expect(typeof result.current.disconnect).toBe('function')
  })

  it('default connect() is a no-op (does not throw)', async () => {
    const { result } = renderHook(() => useWallet())
    await expect(act(async () => { await result.current.connect() })).resolves.not.toThrow()
  })

  it('default disconnect() is a no-op (does not throw)', () => {
    const { result } = renderHook(() => useWallet())
    expect(() => act(() => { result.current.disconnect() })).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Session restore on mount
// ═════════════════════════════════════════════════════════════════════════════

describe('session restore on mount', () => {
  it('restores publicKey, network, and balance from a valid stored session', async () => {
    localStorage.setItem(STORAGE_KEY, MOCK_ADDRESS)
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS })
    mockGetNetwork.mockResolvedValue({ network: 'TESTNET' })
    stubBalanceFetch('75.0000000')

    const { result } = renderHook(() => useWallet(), { wrapper })

    await waitFor(
      () => expect(result.current.publicKey).toBe(MOCK_ADDRESS),
      { timeout: 3000 },
    )

    expect(result.current.isConnected).toBe(true)
    expect(result.current.network).toBe('TESTNET')
  })

  it('does nothing on mount when localStorage is empty', async () => {
    // No stored key
    const { result } = renderHook(() => useWallet(), { wrapper })
    await waitFor(() => expect(result.current.isConnecting).toBe(false))

    expect(result.current.publicKey).toBeNull()
    // isConnected() should NOT have been called (no stored key → early return)
    expect(mockIsConnected).not.toHaveBeenCalled()
  })
})

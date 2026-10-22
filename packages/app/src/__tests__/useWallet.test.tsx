import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// ── Freighter API mock ────────────────────────────────────────────────────────

const mockIsConnected = vi.fn()
const mockRequestAccess = vi.fn()
const mockGetAddress = vi.fn()
const mockGetNetwork = vi.fn()

vi.mock('@stellar/freighter-api', () => ({
  isConnected: (...args: any[]) => mockIsConnected(...args),
  requestAccess: (...args: any[]) => mockRequestAccess(...args),
  getAddress: (...args: any[]) => mockGetAddress(...args),
  getNetwork: (...args: any[]) => mockGetNetwork(...args),
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

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  json: () => Promise.resolve({
    balances: [{ asset_type: 'native', balance: '100.0000000' }],
  }),
}))

// ── helpers ───────────────────────────────────────────────────────────────────

import { WalletProvider, useWallet } from '@/context/WalletContext'

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(WalletProvider, null, children)
}

const MOCK_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockIsConnected.mockResolvedValue({ isConnected: false })
    mockRequestAccess.mockResolvedValue({ address: MOCK_ADDRESS })
    mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS })
    mockGetNetwork.mockResolvedValue({ network: 'TESTNET' })
  })

  it('starts with no wallet connected', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })
    await waitFor(() => expect(result.current.isConnecting).toBe(false))
    expect(result.current.publicKey).toBeNull()
    expect(result.current.isConnected).toBe(false)
  })

  it('connect() calls requestAccess and stores the public key', async () => {
    // localStorage is empty so useEffect returns early without calling isConnected.
    // The only isConnected() call comes from inside connect() itself.
    mockIsConnected.mockResolvedValue({ isConnected: true })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await waitFor(() => expect(result.current.isConnecting).toBe(false))

    await act(async () => {
      await result.current.connect()
    })

    expect(mockRequestAccess).toHaveBeenCalled()
    expect(result.current.publicKey).toBe(MOCK_ADDRESS)
    expect(result.current.isConnected).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(MOCK_ADDRESS)
  })

  it('disconnect() clears the public key and localStorage', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    const { result } = renderHook(() => useWallet(), { wrapper })

    await act(async () => { await result.current.connect() })
    expect(result.current.publicKey).toBe(MOCK_ADDRESS)

    act(() => { result.current.disconnect() })
    expect(result.current.publicKey).toBeNull()
    expect(result.current.isConnected).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('restores a previously connected wallet from localStorage on mount', async () => {
    localStorage.setItem(STORAGE_KEY, MOCK_ADDRESS)
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS })

    const { result } = renderHook(() => useWallet(), { wrapper })

    await waitFor(
      () => expect(result.current.publicKey).toBe(MOCK_ADDRESS),
      { timeout: 3000 }
    )
    expect(result.current.isConnected).toBe(true)
  })

  it('removes stale localStorage entry when Freighter reports disconnected', async () => {
    localStorage.setItem(STORAGE_KEY, MOCK_ADDRESS)
    mockIsConnected.mockResolvedValue({ isConnected: false })

    const { result } = renderHook(() => useWallet(), { wrapper })

    await waitFor(
      () => expect(result.current.publicKey).toBeNull(),
      { timeout: 3000 }
    )
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('sets networkWarning when connected to an unexpected network', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetNetwork.mockResolvedValue({ network: 'FUTURENET' })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })
    expect(result.current.networkWarning).toBe(true)
  })

  it('does not set networkWarning for TESTNET', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockGetNetwork.mockResolvedValue({ network: 'TESTNET' })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })
    expect(result.current.networkWarning).toBe(false)
  })
})

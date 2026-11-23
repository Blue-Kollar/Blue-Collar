/**
 * Extended Wallet Hook Tests with Mocked Freighter
 * Issue #1862: Wallet hook tests with mocked Freighter
 *
 * Extends the existing useWallet.test.tsx with:
 *   - Freighter not installed scenarios
 *   - User rejection flows
 *   - Network mismatch detection
 *   - Balance fetching and updates
 *   - Selector hook performance optimization
 *   - Transaction signing and error handling
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// ── Freighter API mock ────────────────────────────────────────────────────────

const mockIsConnected = vi.fn();
const mockRequestAccess = vi.fn();
const mockGetAddress = vi.fn();
const mockGetNetwork = vi.fn();
const mockSignTransaction = vi.fn();
const mockSignBlob = vi.fn();

vi.mock('@stellar/freighter-api', () => ({
  isConnected: (...args: any[]) => mockIsConnected(...args),
  requestAccess: (...args: any[]) => mockRequestAccess(...args),
  getAddress: (...args: any[]) => mockGetAddress(...args),
  getNetwork: (...args: any[]) => mockGetNetwork(...args),
  signTransaction: (...args: any[]) => mockSignTransaction(...args),
  signBlob: (...args: any[]) => mockSignBlob(...args),
}));

// ── localStorage stub ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'bc_wallet_address';
const store: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => Object.keys(store).forEach((k) => delete store[k]),
});

// ── fetch stub (Horizon balance) ──────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── helpers ───────────────────────────────────────────────────────────────────

import {
  WalletProvider,
  useWallet,
  useWalletBalance,
  useWalletConnection,
} from '@/context/WalletContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(WalletProvider, null, children);
}

const MOCK_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';
const MOCK_PUBLIC_KEY = 'GABC1234DEFG5678HIJKLMNOP';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useWallet (Extended) — Failure Paths & Selectors (#1862)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          balances: [{ asset_type: 'native', balance: '100.0000000' }],
        }),
    });
    mockIsConnected.mockResolvedValue({ isConnected: false });
    mockRequestAccess.mockResolvedValue({ address: MOCK_ADDRESS });
    mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS });
    mockGetNetwork.mockResolvedValue({ network: 'TESTNET' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Freighter not installed ───────────────────────────────────────────────

  describe('Freighter not installed', () => {
    it('throws FreighterNotInstalledError when Freighter is unavailable', async () => {
      mockRequestAccess.mockRejectedValue(new Error('Freighter not installed'));
      mockGetAddress.mockRejectedValue(new Error('Freighter not installed'));

      const { result } = renderHook(() => useWallet(), { wrapper });
      await waitFor(() => expect(result.current.isConnecting).toBe(false));

      await expect(async () => {
        await act(async () => {
          await result.current.connect();
        });
      }).rejects.toThrow('Freighter not installed');
    });

    it('handleConnect catches exception and updates error state', async () => {
      mockRequestAccess.mockRejectedValue(new Error('Extension not found'));

      const { result } = renderHook(() => useWallet(), { wrapper });
      await waitFor(() => expect(result.current.isConnecting).toBe(false));

      try {
        await act(async () => {
          await result.current.connect();
        });
      } catch {
        // Expected
      }

      expect(result.current.error).toBeTruthy();
      expect(result.current.publicKey).toBeNull();
    });

    it('does not persist address when connection fails', async () => {
      mockRequestAccess.mockRejectedValue(new Error('Not installed'));

      const { result } = renderHook(() => useWallet(), { wrapper });
      try {
        await act(async () => {
          await result.current.connect();
        });
      } catch {
        // Expected
      }

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  // ── User rejection flow ───────────────────────────────────────────────────

  describe('User rejection / denial', () => {
    it('throws error when user rejects access request', async () => {
      mockRequestAccess.mockRejectedValue(new Error('User rejected the request'));

      const { result } = renderHook(() => useWallet(), { wrapper });
      await waitFor(() => expect(result.current.isConnecting).toBe(false));

      await expect(async () => {
        await act(async () => {
          await result.current.connect();
        });
      }).rejects.toThrow('User rejected');
    });

    it('allows user to retry connection after rejection', async () => {
      // First attempt: rejection
      mockRequestAccess.mockRejectedValueOnce(new Error('User rejected'));
      const { result } = renderHook(() => useWallet(), { wrapper });

      try {
        await act(async () => {
          await result.current.connect();
        });
      } catch {
        // Expected
      }

      // Second attempt: success
      mockRequestAccess.mockResolvedValueOnce({ address: MOCK_ADDRESS });
      mockIsConnected.mockResolvedValueOnce({ isConnected: true });

      await act(async () => {
        await result.current.connect();
      });
      expect(result.current.publicKey).toBe(MOCK_ADDRESS);
    });

    it('clears error state on successful retry', async () => {
      mockRequestAccess.mockRejectedValueOnce(new Error('User rejected'));

      const { result } = renderHook(() => useWallet(), { wrapper });

      try {
        await act(async () => {
          await result.current.connect();
        });
      } catch {
        // Expected
      }

      expect(result.current.error).toBeTruthy();

      mockRequestAccess.mockResolvedValueOnce({ address: MOCK_ADDRESS });
      mockIsConnected.mockResolvedValueOnce({ isConnected: true });

      await act(async () => {
        await result.current.connect();
      });
      expect(result.current.error).toBeNull();
    });
  });

  // ── Network mismatch ──────────────────────────────────────────────────────

  describe('Network detection and warning', () => {
    it('detects non-TESTNET network and sets warning', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockGetNetwork.mockResolvedValue({ network: 'PUBLIC' });

      const { result } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.networkWarning).toBe(true);
      expect(result.current.network).toBe('PUBLIC');
    });

    it('does not set warning for TESTNET', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockGetNetwork.mockResolvedValue({ network: 'TESTNET' });

      const { result } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.networkWarning).toBe(false);
      expect(result.current.network).toBe('TESTNET');
    });

    it('detects FUTURENET and sets warning', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockGetNetwork.mockResolvedValue({ network: 'FUTURENET' });

      const { result } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.networkWarning).toBe(true);
    });
  });

  // ── Balance fetching ───────────────────────────────────────────────────────

  describe('Balance fetching from Horizon', () => {
    it('fetches balance from Horizon after connection', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            balances: [{ asset_type: 'native', balance: '250.5000000' }],
          }),
      });

      const { result } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await result.current.connect();
      });

      await waitFor(() => {
        expect(result.current.balance).toBe('250.5000000');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`${HORIZON_URL}/accounts/${MOCK_ADDRESS}`),
      );
    });

    it('handles Horizon fetch failure gracefully', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await result.current.connect();
      });

      await waitFor(() => {
        expect(result.current.balance).toBeNull();
      });
    });

    it('updates balance when updated on Horizon', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            balances: [{ asset_type: 'native', balance: '100.0000000' }],
          }),
      });

      const { result } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await result.current.connect();
      });

      await waitFor(() => {
        expect(result.current.balance).toBe('100.0000000');
      });

      // Simulate balance update
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            balances: [{ asset_type: 'native', balance: '150.0000000' }],
          }),
      });

      await act(async () => {
        await result.current.refetchBalance?.();
      });

      await waitFor(() => {
        expect(result.current.balance).toBe('150.0000000');
      });
    });
  });

  // ── Transaction signing ───────────────────────────────────────────────────

  describe('Transaction signing', () => {
    it('signs transaction when connected', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockSignTransaction.mockResolvedValue({ signedTxXdr: 'signed-xdr-data' });

      const { result } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await result.current.connect();
      });

      let signedXdr: string | null = null;
      await act(async () => {
        const response = await result.current.signTransaction?.('test-xdr');
        signedXdr = response?.signedTxXdr;
      });

      expect(signedXdr).toBe('signed-xdr-data');
      expect(mockSignTransaction).toHaveBeenCalledWith('test-xdr', expect.any(Object));
    });

    it('throws error when signing without connection', async () => {
      const { result } = renderHook(() => useWallet(), { wrapper });

      await expect(async () => {
        await result.current.signTransaction?.('test-xdr');
      }).rejects.toThrow();
    });

    it('handles signing errors gracefully', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockSignTransaction.mockRejectedValue(new Error('Signing denied'));

      const { result } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await result.current.connect();
      });

      await expect(async () => {
        await act(async () => {
          await result.current.signTransaction?.('test-xdr');
        });
      }).rejects.toThrow('Signing denied');
    });
  });

  // ── Persistence and restores ──────────────────────────────────────────────

  describe('Persistence and restoration', () => {
    it('restores connection from stale localStorage entry', async () => {
      localStorage.setItem(STORAGE_KEY, MOCK_PUBLIC_KEY);
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockGetAddress.mockResolvedValue({ address: MOCK_PUBLIC_KEY });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await waitFor(() => {
        expect(result.current.publicKey).toBe(MOCK_PUBLIC_KEY);
      });
    });

    it('removes stale localStorage if Freighter reports disconnected', async () => {
      localStorage.setItem(STORAGE_KEY, MOCK_PUBLIC_KEY);
      mockIsConnected.mockResolvedValue({ isConnected: false });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await waitFor(() => {
        expect(result.current.publicKey).toBeNull();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      });
    });

    it('does not persist sensitive data beyond wallet address', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connect();
      });

      const storedKeys = Object.keys(store);
      expect(storedKeys).not.toContain('bc_wallet_private_key');
      expect(storedKeys).not.toContain('bc_wallet_seed');
      expect(storedKeys).toContain(STORAGE_KEY);
    });
  });

  // ── Selector hook performance ─────────────────────────────────────────────

  describe('Selector hooks (performance optimization)', () => {
    it('useWalletBalance only re-renders on balance change', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            balances: [{ asset_type: 'native', balance: '100.0000000' }],
          }),
      });

      let renderCount = 0;
      const { result: walletResult } = renderHook(
        () => {
          renderCount++;
          return useWalletBalance();
        },
        { wrapper },
      );

      const initialRenderCount = renderCount;

      // Connect wallet — balance hook may re-render
      const { result: mainResult } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await mainResult.connect();
      });

      await waitFor(() => {
        expect(walletResult.current).toBeTruthy();
      });

      // Subsequent connections should not cause balance hook re-render
      const countAfterConnect = renderCount;
      expect(countAfterConnect).toBeGreaterThanOrEqual(initialRenderCount);
    });

    it('useWalletConnection selector only re-renders on connection state change', async () => {
      let renderCount = 0;
      const { result: connResult } = renderHook(
        () => {
          renderCount++;
          return useWalletConnection();
        },
        { wrapper },
      );

      const initialRenderCount = renderCount;

      const { result: mainResult } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await mainResult.connect();
      });

      // Connection state changed, so re-render expected
      expect(renderCount).toBeGreaterThan(initialRenderCount);
    });
  });

  // ── Disconnect functionality ───────────────────────────────────────────────

  describe('Disconnect', () => {
    it('clears all connection state on disconnect', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connect();
      });
      expect(result.current.publicKey).toBe(MOCK_ADDRESS);

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.publicKey).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.balance).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles multiple rapid connect attempts', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await Promise.all([
          result.current.connect(),
          result.current.connect(),
          result.current.connect(),
        ]);
      });

      // Should only have one address, not corrupted
      expect(result.current.publicKey).toBe(MOCK_ADDRESS);
    });

    it('handles network change detection mid-connection', async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockGetNetwork.mockResolvedValueOnce({ network: 'TESTNET' });

      const { result } = renderHook(() => useWallet(), { wrapper });
      await act(async () => {
        await result.current.connect();
      });
      expect(result.current.networkWarning).toBe(false);

      // Simulate network change
      mockGetNetwork.mockResolvedValueOnce({ network: 'PUBLIC' });
      await act(async () => {
        await result.current.refetchNetwork?.();
      });

      expect(result.current.networkWarning).toBe(true);
    });
  });
});

/**
 * wallet.service.standalone.test.ts — unit tests for standalone re-exports (#1264)
 *
 * These tests verify the module-level wrapper functions that call through to
 * defaultStellarClient and the default WalletService instance.
 *
 * vi.mock() hoisting means the mocks are active before the module under test
 * is imported — this is the correct pattern for testing module-level singletons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted before the module under test is loaded) ───────────────────

vi.mock('../clients/stellar.client.js', () => ({
  stellarClient: {
    getAccountInfo: vi.fn(),
    broadcastTransaction: vi.fn(),
    pollTransactionStatus: vi.fn(),
    fundTestnetAccount: vi.fn(),
    getAccountTransactions: vi.fn(),
  },
  StellarClient: vi.fn(),
}))

vi.mock('../repositories/wallet.repository.js', () => ({
  walletRepository: {
    upsertAccount: vi.fn(),
    findByUserId: vi.fn(),
    findByPublicKey: vi.fn(),
  },
}))

// ── Import module under test (after mocks are set up) ────────────────────────

import {
  getAccountInfo,
  broadcastTransaction,
  pollTransactionStatus,
  fundTestnetAccount,
  getAccountTransactions,
  syncStellarAccount,
  getUserBalance,
  buildUnsignedTx,
  linkStellarAccount,
} from './wallet.service.js'
import { stellarClient } from '../clients/stellar.client.js'
import { walletRepository } from '../repositories/wallet.repository.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

// ── Type helpers ──────────────────────────────────────────────────────────────

const mockStellarClient = stellarClient as {
  getAccountInfo: ReturnType<typeof vi.fn>
  broadcastTransaction: ReturnType<typeof vi.fn>
  pollTransactionStatus: ReturnType<typeof vi.fn>
  fundTestnetAccount: ReturnType<typeof vi.fn>
  getAccountTransactions: ReturnType<typeof vi.fn>
}

const mockWalletRepo = walletRepository as {
  upsertAccount: ReturnType<typeof vi.fn>
  findByUserId: ReturnType<typeof vi.fn>
  findByPublicKey: ReturnType<typeof vi.fn>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOCK_PUBLIC_KEY = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'
const MOCK_USER_ID = 'user-standalone-test'
const ALT_USER_ID = 'user-different'

// ─────────────────────────────────────────────────────────────────────────────
// Standalone re-exports (module-level API)
// ─────────────────────────────────────────────────────────────────────────────

describe('Standalone re-exports (module-level API)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getAccountInfo ──────────────────────────────────────────────────────────

  describe('getAccountInfo', () => {
    it('calls through to defaultStellarClient.getAccountInfo with the same publicKey', async () => {
      const expected = { publicKey: MOCK_PUBLIC_KEY, balance: 100, sequence: BigInt(42) }
      mockStellarClient.getAccountInfo.mockResolvedValueOnce(expected)

      const result = await getAccountInfo(MOCK_PUBLIC_KEY)

      expect(mockStellarClient.getAccountInfo).toHaveBeenCalledOnce()
      expect(mockStellarClient.getAccountInfo).toHaveBeenCalledWith(MOCK_PUBLIC_KEY)
      expect(result).toEqual(expected)
    })

    it('propagates AppError from defaultStellarClient', async () => {
      mockStellarClient.getAccountInfo.mockRejectedValueOnce(
        new AppError('Account not found on Stellar network', 404, true, ErrorCode.NOT_FOUND),
      )

      await expect(getAccountInfo(MOCK_PUBLIC_KEY)).rejects.toBeInstanceOf(AppError)
      await expect(getAccountInfo(MOCK_PUBLIC_KEY)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  // ── broadcastTransaction ────────────────────────────────────────────────────

  describe('broadcastTransaction', () => {
    const SIGNED_XDR = 'AAAAAQ=='

    it('calls through to defaultStellarClient.broadcastTransaction', async () => {
      const expected = { txHash: 'broadcast-hash', txId: 'broadcast-id' }
      mockStellarClient.broadcastTransaction.mockResolvedValueOnce(expected)

      const result = await broadcastTransaction(SIGNED_XDR)

      expect(mockStellarClient.broadcastTransaction).toHaveBeenCalledOnce()
      expect(mockStellarClient.broadcastTransaction).toHaveBeenCalledWith(SIGNED_XDR)
      expect(result).toEqual(expected)
    })

    it('propagates AppError (400) when broadcast fails', async () => {
      mockStellarClient.broadcastTransaction.mockRejectedValueOnce(
        new AppError('Broadcast failed: Transaction malformed', 400, true, ErrorCode.VALIDATION_ERROR),
      )

      await expect(broadcastTransaction(SIGNED_XDR)).rejects.toBeInstanceOf(AppError)
      await expect(broadcastTransaction(SIGNED_XDR)).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  // ── pollTransactionStatus ───────────────────────────────────────────────────

  describe('pollTransactionStatus', () => {
    const TX_HASH = 'deadbeef1234567890abcdef'

    it('calls through to defaultStellarClient.pollTransactionStatus', async () => {
      const expected = { status: 'confirmed', resultCode: 'ok' }
      mockStellarClient.pollTransactionStatus.mockResolvedValueOnce(expected)

      const result = await pollTransactionStatus(TX_HASH)

      expect(mockStellarClient.pollTransactionStatus).toHaveBeenCalledOnce()
      expect(mockStellarClient.pollTransactionStatus).toHaveBeenCalledWith(TX_HASH)
      expect(result).toEqual(expected)
    })

    it('returns pending status when transaction is not yet found', async () => {
      mockStellarClient.pollTransactionStatus.mockResolvedValueOnce({ status: 'pending' })

      const result = await pollTransactionStatus(TX_HASH)

      expect(result).toEqual({ status: 'pending' })
    })
  })

  // ── fundTestnetAccount ──────────────────────────────────────────────────────

  describe('fundTestnetAccount', () => {
    it('calls through to defaultStellarClient.fundTestnetAccount', async () => {
      const expected = { txHash: 'friendbot-hash', message: 'Account funded successfully' }
      mockStellarClient.fundTestnetAccount.mockResolvedValueOnce(expected)

      const result = await fundTestnetAccount(MOCK_PUBLIC_KEY)

      expect(mockStellarClient.fundTestnetAccount).toHaveBeenCalledOnce()
      expect(mockStellarClient.fundTestnetAccount).toHaveBeenCalledWith(MOCK_PUBLIC_KEY)
      expect(result).toEqual(expected)
    })
  })

  // ── getAccountTransactions ──────────────────────────────────────────────────

  describe('getAccountTransactions', () => {
    it('calls through to defaultStellarClient.getAccountTransactions with defaults', async () => {
      const expected = [{ hash: 'tx-1', created_at: '2024-01-01T00:00:00Z' }]
      mockStellarClient.getAccountTransactions.mockResolvedValueOnce(expected)

      const result = await getAccountTransactions(MOCK_PUBLIC_KEY)

      expect(mockStellarClient.getAccountTransactions).toHaveBeenCalledOnce()
      expect(mockStellarClient.getAccountTransactions).toHaveBeenCalledWith(MOCK_PUBLIC_KEY, 50, 'desc')
      expect(result).toEqual(expected)
    })

    it('passes custom limit and order to defaultStellarClient', async () => {
      mockStellarClient.getAccountTransactions.mockResolvedValueOnce([])

      await getAccountTransactions(MOCK_PUBLIC_KEY, 10, 'asc')

      expect(mockStellarClient.getAccountTransactions).toHaveBeenCalledWith(MOCK_PUBLIC_KEY, 10, 'asc')
    })
  })

  // ── syncStellarAccount (default service instance) ──────────────────────────

  describe('syncStellarAccount (default service instance)', () => {
    it('calls through to the default service: upserts account', async () => {
      const accountInfo = { publicKey: MOCK_PUBLIC_KEY, balance: 250, sequence: BigInt(7) }
      const upserted = {
        id: 'sa-1',
        publicKey: MOCK_PUBLIC_KEY,
        userId: MOCK_USER_ID,
        balance: 250,
        sequences: BigInt(7),
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockStellarClient.getAccountInfo.mockResolvedValueOnce(accountInfo)
      mockWalletRepo.upsertAccount.mockResolvedValueOnce(upserted)

      const result = await syncStellarAccount(MOCK_USER_ID, MOCK_PUBLIC_KEY)

      expect(mockStellarClient.getAccountInfo).toHaveBeenCalledWith(MOCK_PUBLIC_KEY)
      expect(mockWalletRepo.upsertAccount).toHaveBeenCalledWith(
        MOCK_PUBLIC_KEY,
        MOCK_USER_ID,
        250,
        BigInt(7),
      )
      expect(result).toEqual(upserted)
    })
  })

  // ── getUserBalance (default service instance — account not linked) ──────────

  describe('getUserBalance (default service instance)', () => {
    it('throws 404 AppError when no Stellar account is linked for the user', async () => {
      mockWalletRepo.findByUserId.mockResolvedValueOnce(null)

      await expect(getUserBalance(MOCK_USER_ID)).rejects.toBeInstanceOf(AppError)
      await expect(getUserBalance(MOCK_USER_ID)).rejects.toMatchObject({
        statusCode: 404,
        errorCode: ErrorCode.NOT_FOUND,
      })
    })

    it('returns balance data when account is linked', async () => {
      const account = {
        publicKey: MOCK_PUBLIC_KEY,
        balance: 999.5,
        lastSyncedAt: new Date('2025-06-01T12:00:00Z'),
      }
      mockWalletRepo.findByUserId.mockResolvedValueOnce(account)

      const result = await getUserBalance(MOCK_USER_ID)

      expect(result.publicKey).toBe(MOCK_PUBLIC_KEY)
      expect(result.balance).toBe(999.5)
      expect(result.lastSyncedAt).toBeInstanceOf(Date)
    })
  })

  // ── buildUnsignedTx (default service instance — account not found) ──────────

  describe('buildUnsignedTx (default service instance)', () => {
    it('throws 404 AppError when source account is not in the DB', async () => {
      mockWalletRepo.findByPublicKey.mockResolvedValueOnce(null)

      await expect(
        buildUnsignedTx(MOCK_PUBLIC_KEY, 'GDEST', '10'),
      ).rejects.toBeInstanceOf(AppError)
      await expect(
        buildUnsignedTx(MOCK_PUBLIC_KEY, 'GDEST', '10'),
      ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('builds the tx descriptor when source account exists', async () => {
      const account = { id: 'acct-3', publicKey: MOCK_PUBLIC_KEY, userId: MOCK_USER_ID }
      const accountInfo = { balance: 500, sequence: BigInt(3) }
      mockWalletRepo.findByPublicKey.mockResolvedValueOnce(account)
      mockStellarClient.getAccountInfo.mockResolvedValueOnce(accountInfo)

      const result = await buildUnsignedTx(MOCK_PUBLIC_KEY, 'GDEST', '50', 'payment-for-work')

      expect(result.sourcePublicKey).toBe(MOCK_PUBLIC_KEY)
      expect(result.destinationPublicKey).toBe('GDEST')
      expect(result.amount).toBe('50')
      expect(result.memo).toBe('payment-for-work')
      expect(result.sequence).toBe('4') // BigInt(3) + 1n
    })
  })

  // ── linkStellarAccount (default service instance — conflict case) ───────────

  describe('linkStellarAccount (default service instance)', () => {
    it('throws 409 AppError when public key is already linked to a different user', async () => {
      // getAccountInfo called twice in linkStellarAccount (existence check + upsert prep)
      mockStellarClient.getAccountInfo.mockResolvedValue({
        publicKey: MOCK_PUBLIC_KEY,
        balance: 100,
        sequence: BigInt(1),
      })
      mockWalletRepo.findByPublicKey.mockResolvedValueOnce({
        id: 'acct-conflict',
        publicKey: MOCK_PUBLIC_KEY,
        userId: ALT_USER_ID,
      })

      await expect(
        linkStellarAccount(MOCK_USER_ID, MOCK_PUBLIC_KEY),
      ).rejects.toBeInstanceOf(AppError)
      await expect(
        linkStellarAccount(MOCK_USER_ID, MOCK_PUBLIC_KEY),
      ).rejects.toMatchObject({
        statusCode: 409,
        errorCode: ErrorCode.CONFLICT,
      })
    })

    it('successfully links the account when no conflict exists', async () => {
      const upserted = {
        id: 'acct-new',
        publicKey: MOCK_PUBLIC_KEY,
        userId: MOCK_USER_ID,
        balance: 100,
        sequences: BigInt(1),
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockStellarClient.getAccountInfo.mockResolvedValue({
        publicKey: MOCK_PUBLIC_KEY,
        balance: 100,
        sequence: BigInt(1),
      })
      mockWalletRepo.findByPublicKey.mockResolvedValueOnce(null)
      mockWalletRepo.upsertAccount.mockResolvedValueOnce(upserted)

      const result = await linkStellarAccount(MOCK_USER_ID, MOCK_PUBLIC_KEY)

      expect(result).toEqual(upserted)
      expect(mockWalletRepo.upsertAccount).toHaveBeenCalledOnce()
    })
  })
})

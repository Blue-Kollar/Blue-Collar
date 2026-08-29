import { walletRepository as defaultWalletRepository } from '../repositories/wallet.repository.js'
import { stellarClient as defaultStellarClient, StellarClient } from '../clients/stellar.client.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import type { WalletServiceDeps } from '../container/types.js'

/**
 * WalletService encapsulates wallet business logic.
 * It orchestrates between the StellarClient (network operations) and
 * WalletRepository (persistence layer).
 */

// ── Factory ───────────────────────────────────────────────────────────────────

export interface WalletServiceDeps {
  walletRepository?: typeof defaultWalletRepository
  stellarClient?: StellarClient
}

export function createWalletService(deps: WalletServiceDeps = {}) {
  const { walletRepository: repo = defaultWalletRepository, stellarClient = defaultStellarClient } = deps

  return {
    /**
     * Sync or create a Stellar account for a user.
     * Fetches current balance and sequence from Horizon.
     */
    async syncStellarAccount(userId: string, publicKey: string) {
      const accountInfo = await stellarClient.getAccountInfo(publicKey)

      return repo.upsertAccount(publicKey, userId, accountInfo.balance, accountInfo.sequence)
    },

    /**
     * Get cached balance for a user's Stellar account.
     */
    async getUserBalance(userId: string) {
      const account = await repo.findByUserId(userId)

      if (!account) {
        throw new AppError('Stellar account not linked', 404, true, ErrorCode.NOT_FOUND)
      }

      return {
        publicKey: account.publicKey,
        balance: account.balance,
        lastSyncedAt: account.lastSyncedAt,
      }
    },

    /**
     * Build an unsigned transaction XDR for a tip/payment.
     */
    async buildUnsignedTx(
      sourcePublicKey: string,
      destinationPublicKey: string,
      amount: string,
      memo?: string,
    ) {
      const account = await repo.findByPublicKey(sourcePublicKey)

      if (!account) {
        throw new AppError('Source account not found', 404, true, ErrorCode.NOT_FOUND)
      }

      const current = await stellarClient.getAccountInfo(sourcePublicKey)
      const nextSequence = (current.sequence + BigInt(1)).toString()

      return {
        sourcePublicKey,
        destinationPublicKey,
        amount,
        memo: memo || '',
        sequence: nextSequence,
        description: 'Use stellar-sdk to sign this transaction and then broadcast',
      }
    },

    /**
     * Register a user's Stellar account for the first time.
     */
    async linkStellarAccount(userId: string, publicKey: string) {
      await stellarClient.getAccountInfo(publicKey)

      const existing = await repo.findByPublicKey(publicKey)

      if (existing && existing.userId !== userId) {
        throw new AppError('Wallet already linked to another account', 409, true, ErrorCode.CONFLICT)
      }

      const accountInfo = await stellarClient.getAccountInfo(publicKey)
      return repo.upsertAccount(publicKey, userId, accountInfo.balance, accountInfo.sequence)
    },
  }
}

// ── Standalone Stellar network helpers (for backward compatibility) ──────────
// These re-export from StellarClient for callers not yet using the new client directly

export async function getAccountInfo(publicKey: string) {
  return defaultStellarClient.getAccountInfo(publicKey)
}

export async function broadcastTransaction(signedXdr: string) {
  return defaultStellarClient.broadcastTransaction(signedXdr)
}

export async function pollTransactionStatus(txHash: string) {
  return defaultStellarClient.pollTransactionStatus(txHash)
}

export async function fundTestnetAccount(publicKey: string) {
  return defaultStellarClient.fundTestnetAccount(publicKey)
}

export async function getAccountTransactions(
  publicKey: string,
  limit = 50,
  order: 'asc' | 'desc' = 'desc',
) {
  return defaultStellarClient.getAccountTransactions(publicKey, limit, order)
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createWalletService({
  walletRepository: defaultWalletRepository,
})

export async function syncStellarAccount(userId: string, publicKey: string) {
  return _defaultService.syncStellarAccount(userId, publicKey)
}

export async function getUserBalance(userId: string) {
  return _defaultService.getUserBalance(userId)
}

export async function buildUnsignedTx(
  sourcePublicKey: string,
  destinationPublicKey: string,
  amount: string,
  memo?: string,
) {
  return _defaultService.buildUnsignedTx(sourcePublicKey, destinationPublicKey, amount, memo)
}

export async function linkStellarAccount(userId: string, publicKey: string) {
  return _defaultService.linkStellarAccount(userId, publicKey)
}

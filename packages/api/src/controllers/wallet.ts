import type { Request, Response } from 'express'
import * as walletService from '../services/wallet.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

// ── Service type ──────────────────────────────────────────────────────────────

export type WalletService = typeof walletService

/**
 * Builds the wallet route handlers on top of an injected wallet service.
 * Defaults to the real `wallet.service.js` module so route wiring is
 * unchanged; tests can pass a stub service to exercise handlers without
 * hitting the network or the database.
 */
export function createWalletController(service: WalletService = walletService) {
  return {
    /**
     * GET /api/wallet/balance
     * Get cached balance for the authenticated user's Stellar account.
     */
    getBalance: catchAsync(async (req: Request, res: Response) => {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError('Unauthorized', 401, true, ErrorCode.UNAUTHORIZED)
      }
      const data = await service.getUserBalance(userId)
      res.json({ status: 'success', code: 200, data })
    }),

    /**
     * GET /api/wallet/account/:publicKey
     * Get account info (balance, sequence) from Horizon.
     */
    getAccountInfo: catchAsync(async (req: Request, res: Response) => {
      const { publicKey } = req.params
      const data = await service.getAccountInfo(publicKey)
      res.json({ status: 'success', code: 200, data })
    }),

    /**
     * POST /api/wallet/link
     * Link a Stellar wallet to the authenticated user.
     * Validation is handled by the validate middleware upstream.
     */
    linkWallet: catchAsync(async (req: Request, res: Response) => {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError('Unauthorized', 401, true, ErrorCode.UNAUTHORIZED)
      }
      const { publicKey } = req.body
      const account = await service.linkStellarAccount(userId, publicKey)
      res.status(201).json({
        status: 'success',
        code: 201,
        message: 'Wallet linked successfully',
        data: account,
      })
    }),

    /**
     * POST /api/wallet/build-tx
     * Build an unsigned transaction XDR for tip/escrow.
     * Validation is handled by the validate middleware upstream.
     */
    buildTransaction: catchAsync(async (req: Request, res: Response) => {
      const { sourcePublicKey, destinationPublicKey, amount, memo } = req.body
      const tx = await service.buildUnsignedTx(sourcePublicKey, destinationPublicKey, amount, memo)
      res.json({ status: 'success', code: 200, data: tx })
    }),

    /**
     * POST /api/wallet/broadcast
     * Broadcast a signed transaction to the Stellar network.
     * Validation is handled by the validate middleware upstream.
     */
    broadcastTx: catchAsync(async (req: Request, res: Response) => {
      const { signedXdr } = req.body
      const result = await service.broadcastTransaction(signedXdr)
      res.json({ status: 'success', code: 200, data: result })
    }),

    /**
     * GET /api/wallet/tx-status/:txHash
     * Poll transaction status from Horizon.
     */
    getTxStatus: catchAsync(async (req: Request, res: Response) => {
      const { txHash } = req.params
      const status = await service.pollTransactionStatus(txHash)
      res.json({ status: 'success', code: 200, data: status })
    }),

    /**
     * POST /api/wallet/testnet-fund
     * Fund a testnet account via friendbot.
     * Validation is handled by the validate middleware upstream.
     */
    fundTestnet: catchAsync(async (req: Request, res: Response) => {
      const { publicKey } = req.body
      const result = await service.fundTestnetAccount(publicKey)
      res.json({ status: 'success', code: 200, data: result })
    }),

    /**
     * GET /api/wallet/transactions/:publicKey
     * Get account transaction history from Horizon.
     */
    getTransactions: catchAsync(async (req: Request, res: Response) => {
      const { publicKey } = req.params
      const limit = parseInt((req.query.limit as string) || '50', 10)
      const order = ((req.query.order as string) || 'desc') as 'asc' | 'desc'
      const transactions = await service.getAccountTransactions(publicKey, limit, order)
      res.json({ status: 'success', code: 200, data: transactions })
    }),
  }
}

// ── Default singleton (keeps existing route wiring intact) ────────────────────

const defaultWalletController = createWalletController()

export const {
  getBalance,
  getAccountInfo,
  linkWallet,
  buildTransaction,
  broadcastTx,
  getTxStatus,
  fundTestnet,
  getTransactions,
} = defaultWalletController

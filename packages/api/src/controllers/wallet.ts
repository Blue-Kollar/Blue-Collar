import type { Request, Response } from 'express'
import * as walletService from '../services/wallet.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { z } from 'zod'

// ── Validation schemas ────────────────────────────────────────────────────────

const linkWalletSchema = z.object({
  publicKey: z.string().min(56).max(56),
})

const buildTxSchema = z.object({
  sourcePublicKey: z.string().min(1),
  destinationPublicKey: z.string().min(1),
  amount: z.string().min(1),
  memo: z.string().optional(),
})

const broadcastSchema = z.object({
  signedXdr: z.string().min(1),
})

const fundTestnetSchema = z.object({
  publicKey: z.string().min(1),
})

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
     */
    linkWallet: catchAsync(async (req: Request, res: Response) => {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError('Unauthorized', 401, true, ErrorCode.UNAUTHORIZED)
      }
      const parsed = linkWalletSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError('Invalid public key', 400, true, ErrorCode.VALIDATION_ERROR)
      }
      const account = await service.linkStellarAccount(userId, parsed.data.publicKey)
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
     */
    buildTransaction: catchAsync(async (req: Request, res: Response) => {
      const parsed = buildTxSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError('Missing required fields', 400, true, ErrorCode.VALIDATION_ERROR)
      }
      const { sourcePublicKey, destinationPublicKey, amount, memo } = parsed.data
      const tx = await service.buildUnsignedTx(sourcePublicKey, destinationPublicKey, amount, memo)
      res.json({ status: 'success', code: 200, data: tx })
    }),

    /**
     * POST /api/wallet/broadcast
     * Broadcast a signed transaction to the Stellar network.
     */
    broadcastTx: catchAsync(async (req: Request, res: Response) => {
      const parsed = broadcastSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError('signedXdr is required', 400, true, ErrorCode.VALIDATION_ERROR)
      }
      const result = await service.broadcastTransaction(parsed.data.signedXdr)
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
     */
    fundTestnet: catchAsync(async (req: Request, res: Response) => {
      const parsed = fundTestnetSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError('publicKey is required', 400, true, ErrorCode.VALIDATION_ERROR)
      }
      const result = await service.fundTestnetAccount(parsed.data.publicKey)
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

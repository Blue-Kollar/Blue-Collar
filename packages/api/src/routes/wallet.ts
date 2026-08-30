import { Router } from 'express'
import * as walletController from '../controllers/wallet.js'
import { authenticate as requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { publicReadRateLimiter, publicWriteRateLimiter } from '../config/rateLimiter.js'
import { linkWalletRules, buildTxRules, broadcastRules, fundTestnetRules } from '../validations/index.js'

const router = Router()

// Public endpoints - no auth required
router.get('/account/:publicKey', publicReadRateLimiter, walletController.getAccountInfo)
router.post('/testnet-fund', publicWriteRateLimiter, validate(fundTestnetRules), walletController.fundTestnet)
router.get('/transactions/:publicKey', publicReadRateLimiter, walletController.getTransactions)

// Protected endpoints - auth required
router.get('/balance', requireAuth, walletController.getBalance)
router.post('/link', requireAuth, validate(linkWalletRules), walletController.linkWallet)
router.post('/build-tx', requireAuth, validate(buildTxRules), walletController.buildTransaction)
router.post('/broadcast', requireAuth, validate(broadcastRules), walletController.broadcastTx)
router.get('/tx-status/:txHash', requireAuth, walletController.getTxStatus)

export default router

import { Router } from 'express'
import * as walletController from '../controllers/wallet.js'
import { authenticate as requireAuth } from '../middleware/auth.js'

const router = Router()

// Public endpoints - no auth required
router.get('/account/:publicKey', walletController.getAccountInfo)
router.post('/testnet-fund', walletController.fundTestnet)
router.get('/transactions/:publicKey', walletController.getTransactions)

// Protected endpoints - auth required
router.get('/balance', requireAuth, walletController.getBalance)
router.post('/link', requireAuth, walletController.linkWallet)
router.post('/build-tx', requireAuth, walletController.buildTransaction)
router.post('/broadcast', requireAuth, walletController.broadcastTx)
router.get('/tx-status/:txHash', requireAuth, walletController.getTxStatus)

export default router

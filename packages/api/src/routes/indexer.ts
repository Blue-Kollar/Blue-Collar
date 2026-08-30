import { Router } from 'express'
import * as indexerController from '../controllers/indexer.js'
import { publicReadRateLimiter } from '../config/rateLimiter.js'

const router = Router()

// Query indexed events
router.get('/', publicReadRateLimiter, indexerController.queryEvents)
router.get('/worker-registrations/:contractId/:ownerAddress', publicReadRateLimiter, indexerController.getWorkerRegistrations)
router.get('/cursor/:contractId', publicReadRateLimiter, indexerController.getCursor)

export default router

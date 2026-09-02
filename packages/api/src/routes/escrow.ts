import { Router } from 'express'

import {
  activateEscrow, cancelEscrow,
createEscrow,
  fileDispute, getEscrow,   listEscrows, releaseEscrow, resolveDispute,
} from '../controllers/escrow.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', listEscrows)
router.post('/', createEscrow)
router.get('/:id', getEscrow)
router.patch('/:id/activate', activateEscrow)
router.patch('/:id/release', releaseEscrow)
router.patch('/:id/cancel', cancelEscrow)
router.post('/:id/disputes', fileDispute)
router.patch('/:id/disputes/:disputeId', authorize('admin'), resolveDispute)

export default router

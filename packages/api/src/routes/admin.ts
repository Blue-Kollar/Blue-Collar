import { Router } from 'express'
import { listWorkers, listUsers } from '../controllers/admin.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate, authorize('admin'))

router.get('/workers', listWorkers)
router.get('/users', listUsers)

export default router

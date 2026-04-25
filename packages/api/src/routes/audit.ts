import { Router } from 'express'
import { queryLogs } from '../controllers/audit.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, authorize('admin'), queryLogs)

export default router

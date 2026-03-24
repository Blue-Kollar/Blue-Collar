import { Router } from 'express'
import {
    listAllWorkers,
    deleteWorker,
    toggleWorkerActivation,
    bulkDeleteWorkers,
    listAllUsers,
} from '../controllers/admin.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { bulkDeleteRules } from '../validations/admin.js'

const router = Router()

// All admin routes require authentication and admin role
const adminAuth = [authenticate, authorize('admin')]

// Worker management routes
router.get('/workers', ...adminAuth, listAllWorkers)
router.delete('/workers/:id', ...adminAuth, deleteWorker)
router.patch('/workers/:id/toggle', ...adminAuth, toggleWorkerActivation)
router.delete('/workers/bulk', ...adminAuth, validate(bulkDeleteRules), bulkDeleteWorkers)

// User management routes
router.get('/users', ...adminAuth, listAllUsers)

export default router

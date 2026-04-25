import { Router } from 'express'
import { uploadInsurance, getWorkerInsurance, updateInsuranceStatus, triggerRenewalReminders } from '../controllers/insurance.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { upload, handleMulterError } from '../middleware/upload.js'

const router = Router()

// Upload insurance document (curator/admin)
router.post('/:id/insurance', authenticate, authorize('curator', 'admin'), upload.single('document'), handleMulterError, uploadInsurance)

// Get insurance documents for a worker
router.get('/:id/insurance', authenticate, authorize('curator', 'admin'), getWorkerInsurance)

// Admin: verify or reject a document
router.patch('/:id/insurance/:docId', authenticate, authorize('admin'), updateInsuranceStatus)

// Admin: trigger renewal reminders manually
router.post('/insurance/reminders', authenticate, authorize('admin'), triggerRenewalReminders)

export default router

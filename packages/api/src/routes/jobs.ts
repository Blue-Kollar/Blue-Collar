import { Router } from 'express'
import {
  listJobs, showJob, createJob, updateJob, deleteJob, renewJob,
  applyToJob, listApplications, updateApplicationStatus, withdrawApplication,
  sendMessage, listMessages,
  myPostedJobs, myApplications, recommendedJobs,
  validateCreateJob, validateUpdateJob, validateApply,
  validateAppStatus, validateSendMessage, validateListQuery,
} from '../controllers/jobs.js'
import { authenticate } from '../middleware/auth.js'
import { publicReadRateLimiter } from '../config/rateLimiter.js'

const router = Router()

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', publicReadRateLimiter, validateListQuery, listJobs)
router.get('/recommendations/:workerId', publicReadRateLimiter, recommendedJobs)
router.get('/:id', publicReadRateLimiter, showJob)

// ── Authenticated ─────────────────────────────────────────────────────────────
router.post('/', authenticate, validateCreateJob, createJob)
router.put('/:id', authenticate, validateUpdateJob, updateJob)
router.delete('/:id', authenticate, deleteJob)
router.post('/:id/renew', authenticate, renewJob)

// My jobs / applications
router.get('/me/posted', authenticate, myPostedJobs)
router.get('/me/applications', authenticate, myApplications)

// Applications
router.post('/:id/apply', authenticate, validateApply, applyToJob)
router.get('/:id/applications', authenticate, listApplications)
router.patch('/:id/applications/:applicationId', authenticate, validateAppStatus, updateApplicationStatus)
router.delete('/:id/apply', authenticate, withdrawApplication)

// Messaging
router.post('/:id/messages', authenticate, validateSendMessage, sendMessage)
router.get('/:id/messages', authenticate, listMessages)

export default router

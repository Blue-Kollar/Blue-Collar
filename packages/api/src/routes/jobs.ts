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
import { jobsWriteRateLimiter } from '../middleware/rateLimit.js'

const router = Router()

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', publicReadRateLimiter, validateListQuery, listJobs)
router.get('/recommendations/:workerId', publicReadRateLimiter, recommendedJobs)
router.get('/:id', publicReadRateLimiter, showJob)

// ── Authenticated (mutations rate-limited to prevent abuse/retry storms) ───────
router.post('/', authenticate, jobsWriteRateLimiter, validateCreateJob, createJob)
router.put('/:id', authenticate, jobsWriteRateLimiter, validateUpdateJob, updateJob)
router.delete('/:id', authenticate, jobsWriteRateLimiter, deleteJob)
router.post('/:id/renew', authenticate, jobsWriteRateLimiter, renewJob)

// My jobs / applications
router.get('/me/posted', authenticate, myPostedJobs)
router.get('/me/applications', authenticate, myApplications)

// Applications
router.post('/:id/apply', authenticate, jobsWriteRateLimiter, validateApply, applyToJob)
router.get('/:id/applications', authenticate, listApplications)
router.patch('/:id/applications/:applicationId', authenticate, jobsWriteRateLimiter, validateAppStatus, updateApplicationStatus)
router.delete('/:id/apply', authenticate, jobsWriteRateLimiter, withdrawApplication)

// Messaging
router.post('/:id/messages', authenticate, jobsWriteRateLimiter, validateSendMessage, sendMessage)
router.get('/:id/messages', authenticate, listMessages)

export default router

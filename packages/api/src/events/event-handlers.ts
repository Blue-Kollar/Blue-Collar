/**
 * Event handlers — register side-effects for application events.
 * Call `registerEventHandlers()` once at app startup.
 */
import logger from '../config/logger.js'
import { appEvents } from './app-events.js'

export function registerEventHandlers(): void {
  appEvents.on('worker.created', ({ workerId, curatorId }) => {
    logger.info({ workerId, curatorId }, 'worker.created')
  })

  appEvents.on('worker.updated', ({ workerId }) => {
    logger.info({ workerId }, 'worker.updated')
  })

  appEvents.on('worker.deleted', ({ workerId }) => {
    logger.info({ workerId }, 'worker.deleted')
  })

  appEvents.on('worker.toggled', ({ workerId, isActive }) => {
    logger.info({ workerId, isActive }, 'worker.toggled')
  })

  appEvents.on('user.registered', ({ userId, email }) => {
    logger.info({ userId, email }, 'user.registered')
  })

  appEvents.on('user.verified', ({ userId }) => {
    logger.info({ userId }, 'user.verified')
  })

  appEvents.on('review.created', ({ reviewId, workerId, rating }) => {
    logger.info({ reviewId, workerId, rating }, 'review.created')
  })

  appEvents.on('payment.completed', ({ fromUserId, toWorkerId, amount }) => {
    logger.info({ fromUserId, toWorkerId, amount }, 'payment.completed')
  })

  appEvents.on('job.created', ({ jobId, postedById }) => {
    logger.info({ jobId, postedById }, 'job.created')
  })

  appEvents.on('job.applied', ({ jobId, workerId }) => {
    logger.info({ jobId, workerId }, 'job.applied')
  })
}

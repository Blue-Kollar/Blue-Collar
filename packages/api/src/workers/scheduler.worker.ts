/**
 * Scheduler worker — Issue #775
 *
 * Handles periodic jobs: TTL extension, cleanup, booking reminders.
 * Scheduled jobs are added by the queue scheduler (cron-like) at startup.
 */

import { Worker, Queue, type Job } from 'bullmq'
import { redis } from '../config/redis.js'
import { logger } from '../config/logger.js'
import type { CleanupJobData, SchedulerJobData } from '../queue/index.js'
import { cleanupQueue, ttlQueue } from '../queue/index.js'

const connection = { host: redis.options.host ?? 'localhost', port: redis.options.port ?? 6379 }

// ── Cleanup worker ────────────────────────────────────────────────────────────

export const cleanupWorker = new Worker<CleanupJobData>(
  'cleanup',
  async (job: Job<CleanupJobData>) => {
    const { target, olderThanDays = 30 } = job.data
    logger.info({ jobId: job.id, target }, 'Running cleanup job')

    // Cleanup logic is delegated to the purge service (existing)
    const { purgeService } = await import('../services/purge.service.js')
    switch (target) {
      case 'expired_sessions':
        await purgeService.deleteExpiredSessions()
        break
      case 'orphaned_uploads':
        await purgeService.deleteOrphanedUploads(olderThanDays)
        break
      case 'stale_notifications':
        await purgeService.deleteOldNotifications(olderThanDays)
        break
    }
    logger.info({ jobId: job.id, target }, 'Cleanup job completed')
  },
  { connection, concurrency: 1 },
)

// ── Scheduler worker ──────────────────────────────────────────────────────────

export const schedulerWorker = new Worker<SchedulerJobData>(
  'scheduler',
  async (job: Job<SchedulerJobData>) => {
    const { jobType, userId } = job.data
    logger.info({ jobId: job.id, jobType, userId }, 'Running scheduled job')

    const { enqueueNotification } = await import('../queue/index.js')

    switch (jobType) {
      case 'booking_reminder':
        await enqueueNotification({
          userId,
          type: 'booking_reminder',
          title: 'Upcoming booking reminder',
          message: 'You have a booking coming up soon.',
          channels: ['email', 'push', 'inapp'],
        })
        break
      case 'review_prompt':
        await enqueueNotification({
          userId,
          type: 'review_prompt',
          title: 'How was your experience?',
          message: 'Leave a review for your recent booking.',
          channels: ['email', 'inapp'],
        })
        break
      case 'weekly_digest':
        await enqueueNotification({
          userId,
          type: 'weekly_digest',
          title: 'Your weekly BlueCollar digest',
          message: 'Here is what happened this week.',
          channels: ['email'],
        })
        break
    }
  },
  { connection, concurrency: 5 },
)

// ── Register recurring jobs at startup ────────────────────────────────────────

/**
 * Call this once at application startup to register recurring scheduled jobs.
 */
export async function registerRecurringJobs(): Promise<void> {
  // Daily cleanup at 02:00 UTC
  await cleanupQueue.add(
    'daily-cleanup',
    { target: 'expired_sessions' },
    { repeat: { pattern: '0 2 * * *' } },
  )
  await cleanupQueue.add(
    'weekly-upload-cleanup',
    { target: 'orphaned_uploads', olderThanDays: 30 },
    { repeat: { pattern: '0 3 * * 0' } }, // Sundays 03:00 UTC
  )

  logger.info('Recurring jobs registered')
}

cleanupWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Cleanup job failed')
})

schedulerWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Scheduler job failed')
})

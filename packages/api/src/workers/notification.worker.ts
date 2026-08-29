/**
 * Notification worker — Issue #775
 *
 * Processes notification fan-out jobs (email, push, in-app).
 */

import { Worker, type Job } from 'bullmq'
import { redis } from '../config/redis.js'
import { logger } from '../config/logger.js'
import { dispatchNotification } from '../services/notification.service.js'
import type { NotificationJobData } from '../queue/index.js'

const connection = { host: redis.options.host ?? 'localhost', port: redis.options.port ?? 6379 }

export const notificationWorker = new Worker<NotificationJobData>(
  'notification',
  async (job: Job<NotificationJobData>) => {
    logger.info({ jobId: job.id, userId: job.data.userId, type: job.data.type }, 'Processing notification job')
    await dispatchNotification(job.data)
  },
  { connection, concurrency: 10 },
)

notificationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Notification job failed')
})

notificationWorker.on('error', (err) => {
  logger.error({ err }, 'Notification worker error')
})

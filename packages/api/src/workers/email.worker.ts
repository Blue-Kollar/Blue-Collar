/**
 * Email worker — Issue #775
 *
 * Processes jobs from the email queue with retry/backoff and DLQ.
 */

import { Worker, type Job } from 'bullmq'
import { redis } from '../config/redis.js'
import { logger } from '../config/logger.js'
import { mailer } from '../mailer/index.js'
import type { EmailJobData } from '../queue/index.js'

const connection = { host: redis.options.host ?? 'localhost', port: redis.options.port ?? 6379 }

export const emailWorker = new Worker<EmailJobData>(
  'email',
  async (job: Job<EmailJobData>) => {
    const { to, subject, templateName, context } = job.data

    logger.info({ jobId: job.id, to, templateName }, 'Processing email job')

    await mailer.send({
      to,
      subject,
      html: `<p>${context.message ?? subject}</p>`,
      text: String(context.message ?? subject),
    })

    logger.info({ jobId: job.id, to }, 'Email sent successfully')
  },
  {
    connection,
    concurrency: 5,
  },
)

emailWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'Email job completed')
})

emailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err, attempts: job?.attemptsMade }, 'Email job failed')
})

emailWorker.on('error', (err) => {
  logger.error({ err }, 'Email worker error')
})

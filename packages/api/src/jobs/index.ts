/**
 * Background jobs module — issue #1235
 *
 * Central entry point for all recurring background jobs.
 *
 * ## Jobs registered here
 *
 * | Job                 | Source                                | Schedule      |
 * |---------------------|---------------------------------------|---------------|
 * | verification-reminder | `reminder.job.ts`                  | every 1 hour  |
 * | horizon-poller      | `horizon-poller.job.ts`               | every 30 s    |
 *
 * ## Usage in `src/index.ts`
 *
 * ```ts
 * import { startAllJobs, stopAllJobs } from './jobs/index.js'
 *
 * server.listen(PORT, () => {
 *   startAllJobs()
 * })
 *
 * process.on('SIGTERM', async () => {
 *   stopAllJobs()
 *   server.close()
 * })
 * ```
 */

import { logger } from '../config/logger.js'
import { startReminderJob, stopReminderJob } from './reminder.job.js'
import { startHorizonPollerJob, stopHorizonPollerJob } from './horizon-poller.job.js'

export { JobRunner } from './job-runner.js'
export type { JobRunnerOptions } from './job-runner.js'
export { startReminderJob, stopReminderJob, reminderJobRunner } from './reminder.job.js'
export { startHorizonPollerJob, stopHorizonPollerJob, horizonPollerJobRunner } from './horizon-poller.job.js'

/**
 * Start all background jobs.
 * Call once after the HTTP server begins listening.
 */
export function startAllJobs(): void {
  logger.info('Starting all background jobs')
  startReminderJob()
  startHorizonPollerJob()
  logger.info('All background jobs started')
}

/**
 * Stop all background jobs.
 * Call during graceful shutdown (SIGTERM / SIGINT handler).
 */
export function stopAllJobs(): void {
  logger.info('Stopping all background jobs')
  stopReminderJob()
  stopHorizonPollerJob()
  logger.info('All background jobs stopped')
}

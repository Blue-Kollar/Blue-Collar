/**
 * Reminder job — issue #1235
 *
 * Wraps `runVerificationReminderJob` from the reminder service in a
 * `JobRunner` so the scheduling concern is separated from the business logic.
 *
 * Previously the `setInterval` call lived inside `startReminderScheduler()`
 * in services/reminder.service.ts.  That function is preserved for backward
 * compatibility but now delegates to this module.
 */

import { JobRunner } from './job-runner.js'
import { runVerificationReminderJob } from '../services/reminder.service.js'
import { logger } from '../config/logger.js'

const HOUR_MS = 60 * 60 * 1000

/**
 * JobRunner instance for the verification-reminder job.
 *
 * Executes `runVerificationReminderJob` immediately on start, then every hour:
 *   - Sends first verification reminder 24h after registration
 *   - Sends second verification reminder 7 days after registration
 *   - Deletes unverified accounts older than 30 days
 */
export const reminderJobRunner = new JobRunner(
  'verification-reminder',
  runVerificationReminderJob,
  { intervalMs: HOUR_MS, runOnStart: true },
)

/**
 * Start the reminder background job.
 * Called once at application startup (from `src/index.ts`).
 */
export function startReminderJob(): void {
  logger.info('Starting verification reminder job')
  reminderJobRunner.start()
}

/**
 * Stop the reminder background job.
 * Called during graceful shutdown or in test teardown.
 */
export function stopReminderJob(): void {
  reminderJobRunner.stop()
}

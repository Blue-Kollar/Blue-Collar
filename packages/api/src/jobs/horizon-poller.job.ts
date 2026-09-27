/**
 * Horizon Poller job — issue #1235
 *
 * The Horizon polling loop was previously managed by a recursive
 * `setTimeout` inside `startHorizonPoller()` in
 * `services/horizon-poller.service.ts`.  That function is preserved for
 * backward compatibility but the lifecycle management is now delegated here.
 *
 * The poller fetches Stellar contract events every `POLL_INTERVAL_MS` (30s),
 * ingests them into the database, and dispatches to webhook subscribers.
 * The underlying fetch logic stays in the service; this module only handles
 * scheduling concerns (start, stop, logging, concurrency guard).
 */

import { JobRunner } from './job-runner.js'
import { logger } from '../config/logger.js'

const POLL_INTERVAL_MS = 30_000

const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID ?? ''
const MARKET_CONTRACT_ID = process.env.MARKET_CONTRACT_ID ?? ''

/**
 * The poll function is imported lazily so the module compiles even when
 * the Horizon service is not yet configured (e.g. in tests that mock env vars).
 */
async function pollCycle(): Promise<void> {
  const { fetchContractEvents } = await import('../services/horizon-poller.service.js')
  await Promise.all([
    fetchContractEvents(REGISTRY_CONTRACT_ID),
    fetchContractEvents(MARKET_CONTRACT_ID),
  ])
}

/**
 * JobRunner instance for the Horizon contract-event polling job.
 *
 * Runs `pollCycle` every 30 seconds.  `runOnStart: false` mirrors the
 * original `setTimeout(poll, 0)` behaviour where the first execution was
 * effectively immediate but non-blocking — here we let the caller control
 * timing via `startHorizonPollerJob`.
 */
export const horizonPollerJobRunner = new JobRunner(
  'horizon-poller',
  pollCycle,
  { intervalMs: POLL_INTERVAL_MS, runOnStart: true },
)

/**
 * Start the Horizon polling job.
 * Skipped when neither contract ID is configured.
 */
export function startHorizonPollerJob(): void {
  if (!REGISTRY_CONTRACT_ID && !MARKET_CONTRACT_ID) {
    logger.info(
      'Horizon poller job skipped — no contract IDs configured (REGISTRY_CONTRACT_ID / MARKET_CONTRACT_ID)',
    )
    return
  }
  logger.info({ REGISTRY_CONTRACT_ID, MARKET_CONTRACT_ID }, 'Starting Horizon poller job')
  horizonPollerJobRunner.start()
}

/**
 * Stop the Horizon polling job.
 * Called during graceful shutdown or in test teardown.
 */
export function stopHorizonPollerJob(): void {
  horizonPollerJobRunner.stop()
}

/**
 * Graceful worker shutdown — Issue #1352
 *
 * Wires SIGTERM/SIGINT to a BullMQ Worker so in-flight jobs are allowed to
 * finish (or are safely left for another worker to pick back up) before the
 * process exits. BullMQ workers already requeue jobs that are still locked
 * when a worker disconnects, so the main job here is to stop pulling new
 * work and wait for the currently-running job(s) to settle within a bounded
 * timeout instead of exiting immediately.
 */

import type { Worker } from 'bullmq'
import { logger } from '../config/logger.js'

export interface GracefulShutdownOptions {
  /** Max time (ms) to wait for in-flight jobs to finish before forcing exit. */
  timeoutMs?: number
  /** Called after the worker has closed (successfully or via timeout). */
  onShutdown?: () => void | Promise<void>
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? 30_000)

/**
 * Registers SIGTERM/SIGINT handlers that close the given worker(s) gracefully.
 * `worker.close()` stops the worker from accepting new jobs and resolves once
 * any job currently being processed has completed or failed, at which point
 * BullMQ releases the job lock so it can be safely requeued if it didn't finish.
 */
export function registerGracefulShutdown(
  worker: Worker | Worker[],
  name: string,
  options: GracefulShutdownOptions = {},
): void {
  const workers = Array.isArray(worker) ? worker : [worker]
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS
  let shuttingDown = false

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      logger.warn({ signal, name }, 'Shutdown already in progress, ignoring duplicate signal')
      return
    }
    shuttingDown = true

    logger.info({ signal, name, timeoutMs }, 'Received shutdown signal, draining in-flight jobs')

    const forceExitTimer = setTimeout(() => {
      logger.error(
        { name, timeoutMs },
        'Graceful shutdown timed out; forcing exit. In-flight jobs will be requeued after lock expiry.',
      )
      process.exit(1)
    }, timeoutMs)
    forceExitTimer.unref()

    try {
      // Worker#close() stops fetching new jobs and waits for the active job
      // to finish processing before resolving, releasing its lock so BullMQ
      // can safely hand it back to another worker if it never completed.
      await Promise.all(workers.map((w) => w.close()))
      logger.info({ name }, 'Worker closed cleanly, all in-flight jobs settled')
    } catch (err) {
      logger.error({ err, name }, 'Error while closing worker during shutdown')
    } finally {
      clearTimeout(forceExitTimer)
      await options.onShutdown?.()
      process.exit(0)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

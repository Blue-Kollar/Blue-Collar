/**
 * JobRunner — issue #1235
 *
 * A lightweight, re-usable wrapper that manages the lifecycle of a single
 * recurring background job:
 *   - Runs the job immediately on start (optional)
 *   - Schedules it at a fixed interval
 *   - Emits structured log entries on every execution (start, success, failure)
 *   - Propagates errors without crashing the process
 *   - Provides a clean stop() method (for tests and graceful shutdown)
 *
 * The key guarantee: the job function itself is never called with more than one
 * concurrent invocation — if a run is still in progress when the next tick fires,
 * that tick is skipped and logged as a warning.
 *
 * @example
 * ```ts
 * const runner = new JobRunner('reminder', runVerificationReminderJob, {
 *   intervalMs: 60 * 60 * 1000,
 *   runOnStart: true,
 * })
 * runner.start()
 * // …later…
 * await runner.stop()
 * ```
 */

import { logger } from '../config/logger.js'

export interface JobRunnerOptions {
  /** Interval between job executions in milliseconds. */
  intervalMs: number
  /** Whether to execute the job immediately on start() (default: true). */
  runOnStart?: boolean
}

export class JobRunner {
  private readonly name: string
  private readonly fn: () => Promise<void>
  private readonly intervalMs: number
  private readonly runOnStart: boolean

  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private started = false

  constructor(name: string, fn: () => Promise<void>, options: JobRunnerOptions) {
    this.name = name
    this.fn = fn
    this.intervalMs = options.intervalMs
    this.runOnStart = options.runOnStart ?? true
  }

  /**
   * Start the job runner.
   * If `runOnStart` is true (default), the job is executed immediately before
   * the interval begins.
   */
  start(): void {
    if (this.started) {
      logger.warn({ job: this.name }, 'JobRunner.start() called on already-started runner — ignoring')
      return
    }
    this.started = true

    logger.info({ job: this.name, intervalMs: this.intervalMs }, 'Job runner starting')

    if (this.runOnStart) {
      this.execute()
    }

    this.timer = setInterval(() => this.execute(), this.intervalMs)
  }

  /**
   * Stop the job runner.
   * Clears the interval; any in-progress execution is allowed to finish.
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.started = false
    logger.info({ job: this.name }, 'Job runner stopped')
  }

  /** Whether the runner is currently active (timer running). */
  get isRunning(): boolean {
    return this.started && this.timer !== null
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private execute(): void {
    if (this.running) {
      logger.warn({ job: this.name }, 'Job still in progress from previous tick — skipping this execution')
      return
    }

    this.running = true
    const startMs = Date.now()
    logger.info({ job: this.name }, 'Job execution started')

    this.fn()
      .then(() => {
        const durationMs = Date.now() - startMs
        logger.info({ job: this.name, durationMs, outcome: 'success' }, 'Job execution completed')
      })
      .catch((err: unknown) => {
        const durationMs = Date.now() - startMs
        logger.error({ job: this.name, durationMs, outcome: 'error', err }, 'Job execution failed')
      })
      .finally(() => {
        this.running = false
      })
  }
}

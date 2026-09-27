/**
 * Tests for JobRunner — issue #1235
 *
 * Covers:
 *  - Successful execution path (structured log: start, success)
 *  - Failed execution path (error logged, runner stays alive)
 *  - Concurrency guard (second tick skipped while first is in progress)
 *  - stop() clears the interval
 *  - start() is idempotent (double-start warning, no duplicate interval)
 *  - runOnStart: false skips the immediate first execution
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JobRunner } from './job-runner.js'

// ── Logger mock ───────────────────────────────────────────────────────────────

vi.mock('../config/logger.js', () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { logger } from '../config/logger.js'

// ── Timer mock ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRunner(
  fn: () => Promise<void>,
  opts: { intervalMs?: number; runOnStart?: boolean } = {},
) {
  return new JobRunner('test-job', fn, {
    intervalMs: opts.intervalMs ?? 1000,
    runOnStart: opts.runOnStart ?? false,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('JobRunner', () => {
  // ── start / stop ────────────────────────────────────────────────────────────

  it('is not running before start()', () => {
    const runner = makeRunner(async () => {})
    expect(runner.isRunning).toBe(false)
  })

  it('is running after start()', () => {
    const runner = makeRunner(async () => {})
    runner.start()
    expect(runner.isRunning).toBe(true)
    runner.stop()
  })

  it('is not running after stop()', () => {
    const runner = makeRunner(async () => {})
    runner.start()
    runner.stop()
    expect(runner.isRunning).toBe(false)
  })

  it('logs start and stop events', () => {
    const runner = makeRunner(async () => {})
    runner.start()
    runner.stop()
    const infoLogs = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (typeof c[0] === 'string' ? c[0] : c[1]),
    )
    expect(infoLogs.some((m) => /starting/i.test(m))).toBe(true)
    expect(infoLogs.some((m) => /stopped/i.test(m))).toBe(true)
  })

  // ── runOnStart ───────────────────────────────────────────────────────────────

  it('executes the job immediately when runOnStart is true', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const runner = makeRunner(fn, { runOnStart: true })
    runner.start()
    // Allow the microtask to settle
    await vi.runAllMicrotasksAsync()
    expect(fn).toHaveBeenCalledTimes(1)
    runner.stop()
  })

  it('does NOT execute the job immediately when runOnStart is false', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const runner = makeRunner(fn, { runOnStart: false })
    runner.start()
    await vi.runAllMicrotasksAsync()
    expect(fn).not.toHaveBeenCalled()
    runner.stop()
  })

  // ── Interval firing ──────────────────────────────────────────────────────────

  it('executes the job on each interval tick', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const runner = makeRunner(fn, { intervalMs: 1000, runOnStart: false })
    runner.start()

    vi.advanceTimersByTime(1000)
    await vi.runAllMicrotasksAsync()
    expect(fn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    await vi.runAllMicrotasksAsync()
    expect(fn).toHaveBeenCalledTimes(2)

    runner.stop()
  })

  it('stops firing after stop()', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const runner = makeRunner(fn, { intervalMs: 1000, runOnStart: false })
    runner.start()

    vi.advanceTimersByTime(1000)
    await vi.runAllMicrotasksAsync()
    runner.stop()

    vi.advanceTimersByTime(3000)
    await vi.runAllMicrotasksAsync()
    expect(fn).toHaveBeenCalledTimes(1) // only the first tick
  })

  // ── Success logging ──────────────────────────────────────────────────────────

  it('logs a success message after the job completes', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const runner = makeRunner(fn, { runOnStart: false, intervalMs: 500 })
    runner.start()
    vi.advanceTimersByTime(500)
    await vi.runAllMicrotasksAsync()
    runner.stop()

    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls
    const successCall = infoCalls.find(
      (c) => typeof c[1] === 'string' && /completed/i.test(c[1]),
    )
    expect(successCall).toBeDefined()
    // The structured log object should have outcome: 'success'
    expect(successCall![0]).toMatchObject({ outcome: 'success' })
  })

  // ── Error path ───────────────────────────────────────────────────────────────

  it('logs an error when the job throws, without crashing', async () => {
    const boom = new Error('database offline')
    const fn = vi.fn().mockRejectedValue(boom)
    const runner = makeRunner(fn, { runOnStart: false, intervalMs: 500 })
    runner.start()
    vi.advanceTimersByTime(500)
    await vi.runAllMicrotasksAsync()
    runner.stop()

    const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls
    expect(errorCalls.length).toBeGreaterThan(0)
    const errLog = errorCalls.find(
      (c) => typeof c[1] === 'string' && /failed/i.test(c[1]),
    )
    expect(errLog).toBeDefined()
    expect(errLog![0]).toMatchObject({ outcome: 'error' })
  })

  it('continues firing after a failed execution', async () => {
    let callCount = 0
    const fn = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('first run fails')
    })
    const runner = makeRunner(fn, { runOnStart: false, intervalMs: 500 })
    runner.start()

    vi.advanceTimersByTime(500)
    await vi.runAllMicrotasksAsync() // run 1 — fails

    vi.advanceTimersByTime(500)
    await vi.runAllMicrotasksAsync() // run 2 — succeeds

    runner.stop()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  // ── Concurrency guard ────────────────────────────────────────────────────────

  it('skips a tick if the previous execution is still running', async () => {
    let resolveFirst!: () => void
    const first = new Promise<void>((res) => { resolveFirst = res })
    const fn = vi.fn()
      .mockReturnValueOnce(first)           // first call — never resolves until we say so
      .mockResolvedValue(undefined)          // subsequent calls resolve immediately

    const runner = makeRunner(fn, { runOnStart: false, intervalMs: 500 })
    runner.start()

    vi.advanceTimersByTime(500)             // tick 1 — starts first execution
    await vi.runAllMicrotasksAsync()

    vi.advanceTimersByTime(500)             // tick 2 — should be skipped
    await vi.runAllMicrotasksAsync()

    expect(fn).toHaveBeenCalledTimes(1)     // only the first execution was started

    const warnCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls
    expect(warnCalls.some((c) => /skipping/i.test(String(c[1])))).toBe(true)

    resolveFirst()
    await vi.runAllMicrotasksAsync()

    runner.stop()
  })

  // ── Idempotent start ─────────────────────────────────────────────────────────

  it('warns and does not create a second interval on double start()', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const runner = makeRunner(fn, { runOnStart: false, intervalMs: 1000 })
    runner.start()
    runner.start() // second call

    const warnCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls
    expect(warnCalls.some((c) => /already.started/i.test(String(c[1])))).toBe(true)

    vi.advanceTimersByTime(1000)
    await vi.runAllMicrotasksAsync()
    expect(fn).toHaveBeenCalledTimes(1) // only one interval was registered

    runner.stop()
  })
})

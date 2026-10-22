/**
 * Tests for the reminder job — issue #1235
 *
 * Covers success and failure paths for the verification-reminder job
 * execution, verifying that:
 *  - The job function is called when the runner ticks
 *  - A thrown error is caught and logged without stopping the runner
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../services/reminder.service.js', () => ({
  runVerificationReminderJob: vi.fn(),
}))

import { runVerificationReminderJob } from '../services/reminder.service.js'
import { reminderJobRunner } from './reminder.job.js'
import { logger } from '../config/logger.js'

const mockRun = runVerificationReminderJob as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  reminderJobRunner.stop()
  vi.useRealTimers()
})

describe('reminderJobRunner', () => {
  it('calls runVerificationReminderJob on the first tick', async () => {
    mockRun.mockResolvedValue(undefined)

    reminderJobRunner.start()
    // runOnStart: true — the first execution is triggered immediately
    await vi.runAllMicrotasksAsync()

    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it('calls runVerificationReminderJob again after 1 hour', async () => {
    mockRun.mockResolvedValue(undefined)
    reminderJobRunner.start()
    await vi.runAllMicrotasksAsync() // initial run

    vi.advanceTimersByTime(60 * 60 * 1000)
    await vi.runAllMicrotasksAsync()

    expect(mockRun).toHaveBeenCalledTimes(2)
  })

  it('logs a success outcome after a successful job execution', async () => {
    mockRun.mockResolvedValue(undefined)
    reminderJobRunner.start()
    await vi.runAllMicrotasksAsync()
    reminderJobRunner.stop()

    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls
    const successEntry = infoCalls.find(
      (c) => typeof c[1] === 'string' && /completed/i.test(c[1]),
    )
    expect(successEntry).toBeDefined()
    expect(successEntry![0]).toMatchObject({ outcome: 'success', job: 'verification-reminder' })
  })

  it('logs an error outcome when runVerificationReminderJob throws', async () => {
    mockRun.mockRejectedValue(new Error('DB connection lost'))
    reminderJobRunner.start()
    await vi.runAllMicrotasksAsync()
    reminderJobRunner.stop()

    const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls
    expect(errorCalls.length).toBeGreaterThan(0)
    const errEntry = errorCalls.find(
      (c) => typeof c[1] === 'string' && /failed/i.test(c[1]),
    )
    expect(errEntry).toBeDefined()
    expect(errEntry![0]).toMatchObject({ outcome: 'error', job: 'verification-reminder' })
  })

  it('runner is still alive after a failed execution', async () => {
    mockRun.mockRejectedValueOnce(new Error('first run fails'))
    mockRun.mockResolvedValue(undefined)

    reminderJobRunner.start()
    await vi.runAllMicrotasksAsync()

    vi.advanceTimersByTime(60 * 60 * 1000)
    await vi.runAllMicrotasksAsync()

    expect(mockRun).toHaveBeenCalledTimes(2)
    expect(reminderJobRunner.isRunning).toBe(true)
  })
})

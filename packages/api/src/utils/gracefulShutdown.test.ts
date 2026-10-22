/**
 * Graceful shutdown test — Issue #1352
 *
 * Simulates a SIGTERM arriving while a job is mid-processing and asserts
 * the worker drains (closes) instead of exiting hard, so BullMQ can safely
 * requeue any job that didn't finish in time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerGracefulShutdown } from './gracefulShutdown.js'

function createFakeWorker(closeDelayMs: number) {
  return {
    close: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, closeDelayMs)
        }),
    ),
  } as unknown as import('bullmq').Worker
}

describe('registerGracefulShutdown', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((() => undefined) as unknown) as never)
  })

  afterEach(() => {
    vi.useRealTimers()
    exitSpy.mockRestore()
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
  })

  it('waits for the in-flight job to finish before exiting cleanly', async () => {
    const worker = createFakeWorker(50)
    registerGracefulShutdown(worker, 'test-worker', { timeoutMs: 5_000 })

    process.emit('SIGTERM')
    await vi.advanceTimersByTimeAsync(50)

    expect(worker.close).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('force-exits and lets BullMQ requeue the job if shutdown exceeds the configured timeout', async () => {
    // close() never resolves in time, simulating a stuck/long job
    const worker = createFakeWorker(60_000)
    registerGracefulShutdown(worker, 'test-worker', { timeoutMs: 100 })

    process.emit('SIGTERM')
    await vi.advanceTimersByTimeAsync(100)

    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('ignores duplicate shutdown signals while already shutting down', async () => {
    const worker = createFakeWorker(50)
    registerGracefulShutdown(worker, 'test-worker', { timeoutMs: 5_000 })

    process.emit('SIGTERM')
    process.emit('SIGTERM')
    await vi.advanceTimersByTimeAsync(50)

    expect(worker.close).toHaveBeenCalledTimes(1)
  })

  it('respects a configurable shutdown timeout via options', async () => {
    const worker = createFakeWorker(10)
    const onShutdown = vi.fn()
    registerGracefulShutdown(worker, 'test-worker', { timeoutMs: 1_234, onShutdown })

    process.emit('SIGINT')
    await vi.advanceTimersByTimeAsync(10)

    expect(onShutdown).toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})

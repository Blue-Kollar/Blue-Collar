import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CircuitBreaker, CircuitOpenError } from './circuitBreaker.js'

function failingCall(statusCode = 500) {
  return vi.fn().mockRejectedValue(Object.assign(new Error('upstream down'), { statusCode }))
}

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker
  let stateChanges: Array<{ from: string; to: string }>

  beforeEach(() => {
    stateChanges = []
    breaker = new CircuitBreaker({
      name: 'test-client',
      failureThreshold: 2,
      resetTimeoutMs: 50,
      maxRetries: 1, // isolate breaker behavior from retry-within-call behavior
      initialBackoffMs: 1,
      maxBackoffMs: 2,
      onStateChange: (from, to) => stateChanges.push({ from, to }),
    })
  })

  it('stays closed and returns the result on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await breaker.execute(fn)
    expect(result).toBe('ok')
    expect(breaker.getState()).toBe('closed')
  })

  it('opens after consecutive failures reach the threshold', async () => {
    const fn = failingCall(500)

    await expect(breaker.execute(fn)).rejects.toThrow('upstream down')
    expect(breaker.getState()).toBe('closed')

    await expect(breaker.execute(fn)).rejects.toThrow('upstream down')
    expect(breaker.getState()).toBe('open')

    expect(stateChanges).toContainEqual({ from: 'closed', to: 'open' })
  })

  it('short-circuits calls while open instead of hitting upstream', async () => {
    const fn = failingCall(500)
    await expect(breaker.execute(fn)).rejects.toThrow()
    await expect(breaker.execute(fn)).rejects.toThrow()
    expect(breaker.getState()).toBe('open')

    const callCountBeforeShortCircuit = fn.mock.calls.length
    await expect(breaker.execute(fn)).rejects.toThrow(CircuitOpenError)
    expect(fn.mock.calls.length).toBe(callCountBeforeShortCircuit) // fn was not called again
  })

  it('moves to half-open after the reset timeout and closes again on success', async () => {
    const fn = failingCall(500)
    await expect(breaker.execute(fn)).rejects.toThrow()
    await expect(breaker.execute(fn)).rejects.toThrow()
    expect(breaker.getState()).toBe('open')

    await new Promise((resolve) => setTimeout(resolve, 60)) // exceed resetTimeoutMs

    const recovered = vi.fn().mockResolvedValue('recovered')
    const result = await breaker.execute(recovered)
    expect(result).toBe('recovered')
    expect(breaker.getState()).toBe('closed')
    expect(stateChanges).toContainEqual({ from: 'open', to: 'half-open' })
    expect(stateChanges).toContainEqual({ from: 'half-open', to: 'closed' })
  })

  it('does not retry non-retryable (4xx) errors', async () => {
    const fn = failingCall(404)
    await expect(breaker.execute(fn, (err: any) => err.statusCode >= 500)).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

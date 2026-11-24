import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from './circuitBreaker.js';

function failingCall(statusCode = 500) {
  return vi.fn(() => {
    throw Object.assign(new Error('upstream down'), { statusCode });
  });
}

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  let stateChanges: Array<{ from: string; to: string }>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    stateChanges = [];
    breaker = new CircuitBreaker({
      name: 'test-client',
      failureThreshold: 2,
      resetTimeoutMs: 50,
      maxRetries: 1, // isolate breaker behavior from retry-within-call behavior
      initialBackoffMs: 1,
      maxBackoffMs: 2,
      onStateChange: (from, to) => stateChanges.push({ from, to }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stays closed and returns the result on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await breaker.execute(fn);
    expect(result).toBe('ok');
    expect(breaker.getState()).toBe('closed');
  });

  it('opens after consecutive failures reach the threshold', async () => {
    const fn = failingCall(500);

    await expect(breaker.execute(fn)).rejects.toThrow('upstream down');
    expect(breaker.getState()).toBe('closed');

    await expect(breaker.execute(fn)).rejects.toThrow('upstream down');
    expect(breaker.getState()).toBe('open');

    expect(stateChanges).toContainEqual({ from: 'closed', to: 'open' });
  });

  it('short-circuits calls while open instead of hitting upstream', async () => {
    const fn = failingCall(500);
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    expect(breaker.getState()).toBe('open');

    const callCountBeforeShortCircuit = fn.mock.calls.length;
    await expect(breaker.execute(fn)).rejects.toThrow(CircuitOpenError);
    expect(fn.mock.calls.length).toBe(callCountBeforeShortCircuit); // fn was not called again
  });

  it('stays open until the reset timeout elapses, then closes on a successful trial', async () => {
    const fn = failingCall(500);
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    expect(breaker.getState()).toBe('open');

    const callCountBeforeTrial = fn.mock.calls.length;
    await vi.advanceTimersByTimeAsync(49);
    await expect(breaker.execute(fn)).rejects.toThrow(CircuitOpenError);
    expect(fn).toHaveBeenCalledTimes(callCountBeforeTrial);
    expect(breaker.getState()).toBe('open');

    await vi.advanceTimersByTimeAsync(1); // exactly resetTimeoutMs after it opened

    const recovered = vi.fn().mockResolvedValue('recovered');
    const result = await breaker.execute(recovered);
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe('closed');
    expect(stateChanges).toContainEqual({ from: 'open', to: 'half-open' });
    expect(stateChanges).toContainEqual({ from: 'half-open', to: 'closed' });
  });

  it('reopens when the half-open trial request fails', async () => {
    const fn = failingCall(500);
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    expect(breaker.getState()).toBe('open');

    await vi.advanceTimersByTimeAsync(50);
    await expect(breaker.execute(failingCall(503))).rejects.toThrow('upstream down');

    expect(breaker.getState()).toBe('open');
    expect(stateChanges).toContainEqual({ from: 'open', to: 'half-open' });
    expect(stateChanges).toContainEqual({ from: 'half-open', to: 'open' });
  });

  it('waits for exponential backoff before each retry', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // remove jitter so delays are exact
    const retryingBreaker = new CircuitBreaker({
      name: 'backoff-client',
      failureThreshold: 5,
      resetTimeoutMs: 50,
      maxRetries: 3,
      initialBackoffMs: 100,
      maxBackoffMs: 400,
    });
    const fn = failingCall(500);

    const rejected = expect(retryingBreaker.execute(fn)).rejects.toThrow('upstream down');
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1); // first backoff: 100 ms
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // second backoff: 200 ms
    expect(fn).toHaveBeenCalledTimes(3);

    await rejected;
  });

  it('does not retry non-retryable (4xx) errors', async () => {
    const fn = failingCall(404);
    await expect(
      breaker.execute(fn, (err: unknown) => (err as { statusCode?: number }).statusCode >= 500),
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

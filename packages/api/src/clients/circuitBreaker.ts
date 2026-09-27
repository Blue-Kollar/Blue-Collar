/**
 * Retry-with-backoff + circuit breaker wrapper for outbound RPC/Horizon
 * calls made from `clients/`. Kept dependency-free (no timers library) so
 * it can wrap any `() => Promise<T>` call, and emits state-change events
 * that `packages/monitoring` (or any logger-based sink) can subscribe to.
 */

import { logger } from '../config/logger.js';

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Consecutive upstream failures before the breaker opens. */
  failureThreshold?: number;
  /** How long the breaker stays open before allowing a trial request. */
  resetTimeoutMs?: number;
  /** Max retry attempts per call while the breaker is closed/half-open. */
  maxRetries?: number;
  /** Base delay for exponential backoff between retries. */
  initialBackoffMs?: number;
  /** Ceiling for the exponential backoff delay. */
  maxBackoffMs?: number;
  /** Identifies the wrapped client in logs/metrics. */
  name?: string;
  /** Called on every breaker state transition — hook point for metrics. */
  onStateChange?: (from: BreakerState, to: BreakerState, name: string) => void;
}

export interface RetryableError {
  retryable?: boolean;
  statusCode?: number;
}

const DEFAULTS: Required<Omit<CircuitBreakerOptions, 'onStateChange'>> = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  maxRetries: 3,
  initialBackoffMs: 500,
  maxBackoffMs: 8_000,
  name: 'unnamed-client',
};

function defaultIsRetryable(err: unknown): boolean {
  const e = err as RetryableError | undefined;
  if (e?.retryable !== undefined) return e.retryable;
  if (typeof e?.statusCode === 'number') return e.statusCode >= 500;
  return true; // network errors / timeouts
}

function backoffDelay(attempt: number, initial: number, max: number): number {
  const exponential = Math.min(initial * Math.pow(2, attempt), max);
  return exponential + Math.random() * 0.1 * exponential;
}

/**
 * A simple three-state (closed / open / half-open) circuit breaker with
 * built-in exponential backoff retries, intended to wrap individual
 * outbound calls in HTTP clients such as `StellarClient`.
 */
export class CircuitBreaker {
  private readonly opts: Required<Omit<CircuitBreakerOptions, 'onStateChange'>> & Pick<CircuitBreakerOptions, 'onStateChange'>;
  private state: BreakerState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  getState(): BreakerState {
    return this.state;
  }

  private transition(to: BreakerState) {
    if (to === this.state) return;
    const from = this.state;
    this.state = to;
    logger.warn({ client: this.opts.name, from, to }, 'circuit breaker state change');
    this.opts.onStateChange?.(from, to, this.opts.name);
  }

  private recordSuccess() {
    this.consecutiveFailures = 0;
    if (this.state !== 'closed') this.transition('closed');
  }

  private recordFailure() {
    this.consecutiveFailures += 1;
    if (this.state === 'half-open' || this.consecutiveFailures >= this.opts.failureThreshold) {
      this.openedAt = Date.now();
      this.transition('open');
    }
  }

  private canAttempt(): boolean {
    if (this.state !== 'open') return true;
    if (Date.now() - this.openedAt >= this.opts.resetTimeoutMs) {
      this.transition('half-open');
      return true;
    }
    return false;
  }

  /**
   * Execute `fn` behind the breaker with retry-with-backoff. Rejects
   * immediately with a "circuit open" error while the breaker is open and
   * the reset timeout hasn't elapsed, short-circuiting sustained upstream
   * failures instead of piling up retries against a dead dependency.
   */
  async execute<T>(fn: () => Promise<T>, isRetryable: (err: unknown) => boolean = defaultIsRetryable): Promise<T> {
    if (!this.canAttempt()) {
      throw new CircuitOpenError(this.opts.name);
    }

    let lastError: unknown;
    const { maxRetries, initialBackoffMs, maxBackoffMs, name } = this.opts;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await fn();
        this.recordSuccess();
        return result;
      } catch (err) {
        lastError = err;
        this.recordFailure();

        const canRetry = attempt < maxRetries - 1 && isRetryable(err) && this.state !== 'open';
        if (!canRetry) break;

        const delayMs = backoffDelay(attempt, initialBackoffMs, maxBackoffMs);
        logger.warn({ client: name, attempt: attempt + 1, delayMs, error: (err as Error)?.message }, 'retrying outbound call');
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }
}

export class CircuitOpenError extends Error {
  constructor(clientName: string) {
    super(`Circuit breaker open for ${clientName}: upstream is failing, short-circuiting call`);
    this.name = 'CircuitOpenError';
  }
}

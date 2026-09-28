# Issue 2 — Retry/backoff + circuit breaker for outbound Horizon calls

## What changed

- Added `clients/circuitBreaker.ts`: a dependency-free `CircuitBreaker` class
  wrapping any `() => Promise<T>` call with:
  - Exponential backoff retries (jittered, capped at `maxBackoffMs`).
  - A three-state breaker (`closed` / `open` / `half-open`) that opens after
    `failureThreshold` consecutive failures and short-circuits further calls
    with `CircuitOpenError` until `resetTimeoutMs` elapses, at which point a
    single trial call is allowed through (`half-open`) before fully closing.
  - An `onStateChange(from, to, name)` hook plus a `logger.warn` call on
    every transition, so state changes are observable without coupling this
    package to a specific metrics backend. `packages/monitoring` (or any
    other consumer) can subscribe via `onStateChange` when constructing a
    breaker, or scrape the structured `circuit breaker state change` log
    line.
- `clients/stellar.client.ts` now routes every outbound Horizon/friendbot
  call (`getAccountInfo`, `broadcastTransaction`, `pollTransactionStatus`,
  `fundTestnetAccount`, `getAccountTransactions`) through a shared
  `horizonBreaker` instance instead of calling `fetch` directly. 4xx
  responses (e.g. 404 account-not-found) are treated as non-retryable;
  5xx/network errors are retried and count toward the breaker's failure
  threshold.
- Added `clients/circuitBreaker.test.ts` simulating sustained upstream
  failure and asserting: breaker opens after the threshold, short-circuits
  further calls without invoking the wrapped function, recovers via
  half-open after the reset timeout, and correctly skips retries for
  non-retryable errors.

## Notes

- `services/stellar-rpc.client.ts` already had its own retry-with-backoff
  (no breaker) for a parallel Soroban-facing client; it wasn't touched here
  since the issue scopes this to `clients/`. A natural follow-up is having
  both clients share `CircuitBreaker` to avoid two retry implementations.
- Metrics emission is log-based (`packages/monitoring` ingests structured
  logs elsewhere in this stack); wiring a dedicated counter/gauge exporter
  is a separate task once a metrics client is chosen for `packages/api`.

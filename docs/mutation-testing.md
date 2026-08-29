# Mutation Testing — Critical Fee Calculation Logic

> Issue: #1270 — Set up mutation testing for critical fee-calculation logic

This document explains how mutation testing is configured for Blue-Collar's
critical fee / balance calculation logic and how to run and extend it.

## What is mutation-tested

The single source of truth for money math in the API is
`packages/api/src/services/payment.service.ts`. It implements:

- `calculateFee(amount, fee_bps)` — the core basis-point fee calculator
  (`Math.floor((amount * fee_bps) / 10_000)`), with bounds `0..=10000`.
- `tip({ from, to, amount })` — validates, deducts the platform fee, and
  returns `{ grossAmount, fee, netAmount }` (balance conservation:
  `gross === fee + netAmount`).
- `createEscrow` / `createMultiSigEscrow` — validation guards (positive amount,
  future expiry, signer/threshold invariants).
- `updateFeeBps` / `getFeeBps` and the `PaymentService` class that mirrors the
  standalone API with per-instance fee state.

Other candidate modules were reviewed and deliberately **excluded** to keep the
run fast and focused on money-correctness:

- `packages/contracts/contracts/fee_distribution/src/lib.rs` — on-chain fee
  logic written in **Rust**; Stryker (JS) cannot mutate it.
- `packages/api/src/services/analytics/shared.ts` — contains `calcGrowthPct` /
  `calcRatingDelta` (financial rounding) but is co-located with date helpers
  that are not fee logic; including the whole file added non-financial noise.
  It is a good candidate to expand to in a follow-up once its date helpers are
  covered separately.
- `packages/app` — contains no fee/balance calculation logic.

## Tooling

- **Stryker** (`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`) is
  the mutation testing framework. It is already a dev dependency of
  `@bluecollar/api`.
- The vitest runner is used, so mutants are validated against the real unit
  tests.

## Configuration

`packages/api/stryker.config.mjs` — key settings:

```js
mutate: ['src/services/payment.service.ts'],
testRunner: 'vitest',
vitest: { configFile: 'vitest.mutation.config.ts' },
coverageAnalysis: 'perTest',
thresholds: { high: 80, low: 60, break: 50 },
```

A **dedicated vitest config** (`packages/api/vitest.mutation.config.ts`) narrows
the test run to the pure unit tests that exercise the fee logic:

- `src/services/payment.service.test.ts`
- `src/__tests__/payment.edge.test.ts`
- `src/services/payment.service.fee-calc.test.ts`
- `src/services/payment.service.error-messages.test.ts`

These tests are fully isolated from the database / Redis, so the mutation
baseline is green without any external services. (The full API suite needs a
live DB, so it is intentionally excluded from the mutation run.)

## How to run

```bash
pnpm install                                    # ensure @stryker-mutator/* are present
pnpm --filter @bluecollar/api test:mutation     # run Stryker
# CI-friendly (machine-readable reporters only):
pnpm --filter @bluecollar/api test:mutation:ci
```

Reports are written to `packages/api/reports/mutation/`
(`index.html` + `mutation.json`).

## Surviving mutants & how they were addressed

Baseline (before added tests): the initial run surfaced mutants on the
uncovered standalone `updateFeeBps` bounds guard and on every thrown error
message (the existing tests only asserted the `AppError` *class*, not the
message text).

Fixes applied:

1. `src/services/payment.service.fee-calc.test.ts` — added coverage for
   previously-untested `createMultiSigEscrow` guards (empty signers, threshold
   bounds, approvals initialisation), class-instance fee state, and fee
   rounding / 100%-fee / balance-conservation edge cases.
2. `src/services/payment.service.error-messages.test.ts` — pinned the **exact**
   error messages for every validation path (calculateFee, updateFeeBps,
   tip, createEscrow, createMultiSigEscrow, and the `PaymentService` class),
   and added the previously-uncovered standalone `updateFeeBps('admin', ±…)`
   bounds checks.

### Justified exclusions (equivalent mutants)

The following surviving mutants are **equivalent** — changing them does not
change any observable behaviour and cannot be killed by a meaningful test:

- **`expiryDate <= new Date()` → `expiryDate < new Date()`** (EqualityOperator)
  in `createEscrow` / `createMultiSigEscrow`. The boundary is "expiry strictly
  before the current instant". Hitting exact timestamp equality is
  non-deterministic (the `new Date()` inside the function is always a few
  microseconds after the caller's `new Date()`), so the `<` and `<=` forms are
  behaviourally identical and no test can distinguish them.
- **AppError `operational` flag `true` → `false`** (BooleanLiteral on every
  thrown error). This 4th constructor argument is metadata for the error
  handler and is not part of the response contract; flipping it does not change
  the thrown `statusCode` or `message` observable by callers.

These are documented rather than silently suppressed.

## Mutation score

The achieved mutation score is recorded in the PR description / the Stryker JSON
report (`reports/mutation/mutation.json`). After the test additions above it is
substantially higher than the initial run, with only the equivalent mutants
above remaining.

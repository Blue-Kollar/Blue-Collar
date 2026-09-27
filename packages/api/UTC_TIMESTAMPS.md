# UTC timestamp audit (Issue #1355)

## Scope audited

- `packages/api/prisma/schema.prisma` — all `DateTime` columns (Postgres
  `timestamptz`) already store instants in UTC; Prisma/`pg` always
  round-trips `Date` objects as UTC, so no storage-layer change was needed
  there.
- API JSON responses — `Date` objects serialize via the native
  `Date.prototype.toJSON()`, which always emits ISO-8601 in UTC
  (`...Z` suffix). No controller was found constructing date strings by hand
  (e.g. via `toLocaleString`/`toLocaleDateString`) in a response path, so
  response formatting was already consistent.
- `packages/contracts` escrow `expiry`/`created_at`/`updated_at` fields are
  Soroban ledger `u64` timestamps/sequence numbers — always UTC epoch
  seconds by protocol definition, no client-side conversion involved.

## Bug found and fixed

`packages/api/src/services/availability.service.ts` stores worker
availability as wall-clock `"HH:MM"` strings plus a separate `timezone`
field (defaulting to `'UTC'`), but `detectConflicts` compared the raw
`HH:MM` values directly — correct only when every slot being compared uses
the same offset. A worker (or client) submitting slots with different fixed
UTC offsets (e.g. one slot saved as `+00:00`, another as `+01:00` after a
DST transition) would have conflicts silently missed or falsely reported,
because `"09:00"` at `+02:00` and `"09:00"` at `UTC` are different instants
but compared as equal.

**Fix:** added `parseOffsetMinutes`/`toUtcMinutes` and changed
`detectConflicts` to compare all slots on a common UTC-minutes axis
(normalized into `[0, 1440)` to handle midnight wraparound). IANA zone names
(e.g. `"America/New_York"`) are not resolvable without a timezone database
and are treated as UTC (matching the existing default) — a documented
limitation; only fixed-offset strings (`"+02:00"`) or `"UTC"` are precisely
compared today. A follow-up could add a tz-database dependency
(e.g. `luxon`) if IANA-zone slot input becomes a product requirement.

## Tests added

`packages/api/src/services/availability.service.test.ts` covers:
- same-offset overlap detection (regression baseline)
- cross-offset overlap that naive string comparison would miss
- cross-offset non-overlap that naive string comparison would falsely flag
- a DST-boundary scenario (`+00:00` slot vs. `+01:00` slot crossing
  midnight) asserting the conflict is still correctly detected once
  normalized to UTC
- default-to-UTC storage behavior when no timezone is supplied

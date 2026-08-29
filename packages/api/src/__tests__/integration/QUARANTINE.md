# Integration Test Quarantine Log

**Issue:** [#1053] Remove flaky and duplicate integration tests in `packages/api`

---

## Removed: `worker.test.ts` (duplicate)

**File:** `packages/api/src/__tests__/integration/worker.test.ts`  
**Reason:** Full duplication of coverage already provided by `workers.integration.test.ts`.

### Overlap analysis

| Test scenario | `worker.test.ts` | `workers.integration.test.ts` |
|---|---|---|
| `POST /api/workers` — 401 unauthenticated | ✅ | ✅ |
| `POST /api/workers` — 400/422 invalid data | ✅ | ✅ |
| `GET /api/workers` — 200 list | ✅ | ✅ |
| `GET /api/workers` — category filter | ✅ | ✅ |
| `GET /api/workers` — pagination | ✅ | ✅ |
| `GET /api/workers/:id` — 200 found | ✅ | ✅ |
| `GET /api/workers/:id` — 404 not found | ✅ | ✅ |
| `PUT /api/workers/:id` — 401/403 | ✅ | ✅ |
| `DELETE /api/workers/:id` — 401/403 | ✅ | ✅ |

**Additional problems with `worker.test.ts`:**
1. **Real-DB dependency** — imports `prisma` from `../setup` and calls `prisma.worker.create()`,
   `prisma.user.create()`, etc. These calls fail in any CI environment without a live PostgreSQL
   instance, making every test non-deterministic. `workers.integration.test.ts` stubs the DB with
   `vi.mock`, so it runs everywhere.
2. **Order-dependence** — `beforeEach` creates users and workers without cleanup in `afterEach`;
   a previous test's data leaks into the next test depending on DB state.
3. **Wrong import path** — imports `{ app }` from `../../index` (named export) but the real module
   uses a default export, so the suite throws `TypeError` at runtime in the current codebase.

**Decision:** Delete the file. All meaningful scenarios are covered by `workers.integration.test.ts`.

---

## Quarantined (timing-sensitive): E2E tests that require a live database

The following e2e test files depend on `db.user.create`, `db.worker.create`, and sequential
HTTP flows that share state across `describe` blocks via outer `let` variables. They are
**excluded from the default vitest run** (already covered by the `exclude` pattern
`src/**/*.e2e.test.ts` in `vitest.config.ts`) and should only be run against a provisioned
test database via `pnpm test:e2e`.

| File | Flaky pattern |
|---|---|
| `e2e/auth.e2e.test.ts` | `verificationToken` / `authToken` shared state across describes |
| `e2e/workers.e2e.test.ts` | `workerId` set in one `describe`, consumed by later ones |
| `e2e/bookings.e2e.test.ts` | Multi-step flow — order-dependent |
| `e2e/escrow.e2e.test.ts` | Timing: escrow expiry relies on wall-clock `setTimeout` |
| `e2e/two-factor.e2e.test.ts` | TOTP window — passes if run within 30 s, fails otherwise |
| `e2e/reviews.e2e.test.ts` | Depends on worker created in same run's prior describe |
| `e2e/job-lifecycle.e2e.test.ts` | Chains job → application → escrow → review across sequential `it` blocks sharing outer `let` state — order-dependent by design (issue: full-journey coverage) |
| `e2e/payment.e2e.test.ts` | Chains escrow capture → release/refund across sequential `it` blocks sharing outer `let` state; also mutates the shared `paymentService` fee singleton — order-dependent by design (issue: full-journey coverage) |

These files are **not deleted** — they represent valid acceptance tests. They are quarantined
from the unit/integration test run to prevent CI failures unrelated to code changes.

**To run e2e tests locally against a real DB:**
```bash
# set up DB
export TEST_DATABASE_URL=postgresql://localhost:5432/bluecollar_test
pnpm --filter @bluecollar/api exec vitest run src/__tests__/e2e
```

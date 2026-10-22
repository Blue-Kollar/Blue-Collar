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

---

## #1263 Flaky Integration Test Audit

**Issue:** [#1263] Remove flaky integration tests duplicating unit coverage

### Methodology

Every test file under `src/__tests__/` was categorised by abstraction level:

| Level | Characteristic | Files |
|---|---|---|
| **Unit** | Calls controller/service/middleware functions directly with mocked `req`/`res` | `workers.test.ts`, `middleware/auth.test.ts`, `services/*.test.ts` |
| **Integration (HTTP-stack)** | Fires real HTTP via supertest; DB and external calls mocked with `vi.mock` | `integration/workers.integration.test.ts`, `integration/wallet.test.ts`, `integration/search.integration.test.ts`, `integration/admin.integration.test.ts`, `integration/onchain-sync.integration.test.ts` |
| **E2E** | Requires a live PostgreSQL instance; sequential describes share `let`-bound state | `e2e/*.e2e.test.ts` ← **already quarantined in this file** |

Flakiness patterns targeted:

1. **Real-DB dependency** — tests that call `prisma.worker.create()` / `db.user.create()` etc. without mocking.
2. **Order-dependence** — `let` variables set in one `describe`, consumed by a later one.
3. **Timing dependency** — wall-clock `setTimeout`, TOTP windows, escrow expiry timers.
4. **Cross-file duplication** — same assertion exercised at the same abstraction level in two files.

---

### Files examined

| File | Abstraction | DB mocked? | Verdict |
|---|---|---|---|
| `integration/workers.integration.test.ts` | HTTP-stack | ✅ `vi.mock('../../db.js')` | **Keep — tests full Express routing + middleware chain** |
| `integration/wallet.test.ts` | HTTP-stack | ✅ `vi.mock('../../db.js')` + fetch stub | **Keep — exercises wallet route → controller → Stellar service; unit tests do not cover HTTP layer** |
| `integration/onchain-sync.integration.test.ts` | Service integration | ✅ `vi.mock('../../db.js')` + global `fetch` stub | **Keep — only coverage for horizon-poller cursor advancement and signed webhook delivery** |
| `integration/search.integration.test.ts` | HTTP-stack | ✅ `vi.mock('../../db.js')` | **Keep — advanced search endpoints not covered at unit level** |
| `workers.test.ts` | Controller unit | N/A (no DB) | **Keep — primary coverage for `authenticate`, `authorize`, cursor/offset pagination dispatch logic; no HTTP-stack equivalent for middleware edge cases** |

---

### Overlap analysis: `workers.test.ts` vs `workers.integration.test.ts`

These two files share scenario *names* but test **different abstraction layers**:

| Scenario | `workers.test.ts` (unit) | `workers.integration.test.ts` (HTTP-stack) |
|---|---|---|
| GET /api/workers → 200 | Calls `listWorkers(req, res)` directly | HTTP `GET /api/workers` through supertest |
| GET /api/workers with `?category` | Asserts `workerService.listWorkers` called with `{ category }` | HTTP request; verifies response status 200 |
| GET /api/workers with `?search` | Asserts service called with `{ search }` | HTTP request; verifies 200 (no crash) |
| GET /api/workers/:id → 200 | Calls `showWorker` directly; asserts body shape | HTTP request; verifies response status + `status: "success"` |
| GET /api/workers/:id → 404 | Calls `showWorker` with `null` service result | HTTP request through full routing + error handler |
| POST → 201 | Calls `createWorker` directly | HTTP POST with real JWT; exercises `authenticate` + `authorize` middleware in express context |
| PUT → 200 | Calls `updateWorker` directly | HTTP PUT with real JWT |
| PUT → 404 | Service mock throws `AppError(404)` | HTTP PUT to nonexistent ID |
| DELETE → 204 | Calls `deleteWorker` directly | HTTP DELETE with real JWT |
| 401 no auth header | Calls `authenticate` middleware directly | HTTP request with no `Authorization` header |
| 403 wrong role | Calls `authorize("curator")` directly | HTTP POST with a `user`-role token |

**Conclusion:** These scenarios are *not* duplicates. The unit tests verify the controller and middleware logic in isolation. The integration tests verify that the **Express router wires them together correctly** — the JWT is parsed by `authenticate`, the role is enforced by `authorize`, and errors reach the global error handler and are serialized to the correct HTTP response. Both layers are necessary.

---

### What was removed

**Nothing additional.** The only genuine cross-file duplication at the same abstraction level was `integration/worker.test.ts` (singular), which was already removed under issue #1053 (see the first section of this document). That file called `prisma.worker.create()` without mocking, duplicated every scenario in `workers.integration.test.ts`, and had a broken `app` import.

No further test files were found that duplicate coverage at the same abstraction level with no unique assertions.

---

### Remaining candidates for future cleanup

| File | Candidate action | Rationale |
|---|---|---|
| `workers.test.ts` | Rename to `controllers/workers.controller.test.ts` | Current name implies it is a top-level workers test; it is specifically a controller + middleware unit test |
| `workers.test.ts` — `authenticate`/`authorize` describes | Consider moving to `middleware/auth.test.ts` | The file comment acknowledges this; middleware tests belong in a dedicated file |
| `integration/workers.integration.test.ts` — `?search` and `?category` tests | Could be deduplicated into `search.integration.test.ts` | Minor; no flakiness risk, so low priority |
| E2E files (already quarantined) | Run separately via `pnpm test:e2e` against a provisioned DB | Already implemented via vitest `exclude` pattern |

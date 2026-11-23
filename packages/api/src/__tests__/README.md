# API test suites

Test files live under `src/__tests__/` and are run with `pnpm --filter @bluecollar/api test`
(Vitest). The `e2e/` directory and `*.e2e.test.ts` files need a live database and are excluded
from the default run.

## Retry-free policy (issue #1865)

**All tests must pass deterministically without retries.** Flaky tests that pass intermittently
mask real issues and slow down CI. The monorepo enforces a strict no-retry policy:

- **No test retries** — Vitest and Playwright test runners are configured with `retries: 0`.
- **Fix root causes** — Tests that fail due to timing, shared state, or real network/DB
  dependencies must be fixed (use fake timers, mock infrastructure, isolate state) or moved
  to the quarantine zone (E2E tests with explicit DB setup).
- **E2E tests are quarantined** — Tests requiring live infrastructure are excluded from the
  default test run and live in `src/__tests__/e2e/`. They must be explicitly opted in via
  `pnpm test:e2e` with `TEST_DATABASE_URL` set. See `QUARANTINE.md` for details.

Patterns that cause flakiness and are **not allowed** in the default test suite:

| Pattern | Why it fails | Fix |
|---|---|---|
| `await new Promise(resolve => setTimeout(resolve, 100))` | Wall-clock timing depends on CPU load | Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` |
| `let sharedState` across `describe` blocks | Order-dependent — one test modifies state used by the next | Isolate state with `beforeEach`/`afterEach` or factories |
| `prisma.user.create()` without mocking | Real DB calls fail in CI without provisioned database | Mock `db` module with `vi.mock('../../db.js')` |
| TOTP codes tested within 30s window | Validation window makes tests time-sensitive | Mock `Date.now()` or use pre-generated valid codes |

If a test cannot be made deterministic (requires real DB, timing-sensitive by design), it
belongs in the E2E quarantine zone, not the default suite.

---

## Coverage policy (issue #1867)

The monorepo enforces an **85% line-coverage target** across all packages. This threshold
applies to lines, functions, and statements; branches are set at 80% due to environment-
conditional code paths. See `docs/TESTING_COVERAGE.md` for the complete coverage policy,
per-package thresholds, and exclusion rules.

**Running coverage checks locally:**

```bash
# Single package
pnpm --filter @bluecollar/api test:coverage

# All packages
pnpm -r test:coverage
```

Coverage reports are generated in `<package>/coverage/index.html`. Failing to meet the 85%
threshold causes the test run to exit with a non-zero code, blocking CI merges.

## Shared HTTP integration harness (`test-harness.ts`)

HTTP integration suites drive the real Express app with supertest. Each one needs the same
environment and the same infrastructure stubs, so `test-harness.ts` holds them once.

### What it provides

| Export | Purpose |
|---|---|
| `TEST_ENV` | Every variable `config/config.ts` requires at load time. Applied to `process.env` when the harness is imported (without overwriting values already set). |
| `makeAuthToken(role?, id?, email?)` | Signs a JWT the `authenticate` middleware accepts. |
| `infraMocks` | Factories returning the module shape for each infrastructure module: `redis`, `env`, `openapiDocs`, `passport`, `requestLogger`, `events`, `queue`, `rateLimiter`, `versionRateLimit`, `userRateLimit`, `mailerTransport`. |

### Usage

The harness must be imported **before** `app` so the environment is in place when the config
module loads. Wire each infrastructure mock with a factory that imports the harness lazily:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { makeAuthToken } from '../test-harness.js'

vi.mock('../../config/redis.js', async () => (await import('../test-harness.js')).infraMocks.redis())
vi.mock('../../config/env.js', async () => (await import('../test-harness.js')).infraMocks.env())
vi.mock('../../queue/index.js', async () => (await import('../test-harness.js')).infraMocks.queue())
// ...the rest of the infraMocks entries your suite needs...

// Suite-specific: only the database model stubs belong here.
vi.mock('../../db.js', () => ({
  db: { category: { findMany: vi.fn() /* ... */ } },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}))

import app from '../../app.js'
import { db } from '../../db.js'
```

Then build requests as usual:

```ts
const res = await request(app)
  .get('/api/categories')
  .set('Authorization', `Bearer ${makeAuthToken('admin', 'admin-1')}`)
expect(res.status).toBe(200)
```

Suites that use the harness: `integration/categories.integration.test.ts` and
`integration/admin.integration.test.ts`.

### Rules

- Put only database stubs and per-suite behaviour in the suite file. Change shared
  infrastructure stubs in `test-harness.ts` so every suite picks them up.
- Do not call `vi.mock` inside the harness. Factories are pure so a suite can override one
  entry for a single test if it needs to.
- Use `vi.useFakeTimers` for anything time-dependent. Do not sleep for real milliseconds.

## Other conventions

- `helpers/testHarness.ts` provides `makeReq`, `makeRes` and `makeNext` for unit tests of
  controllers and middleware. Use it for tests that call handlers directly without HTTP.
- `helpers/fakeRepositories.ts` and `helpers/factories.ts` provide in-memory repositories and
  record factories for service-level tests.
- Run the suites that use the harness with:

  ```bash
  DATABASE_URL=postgresql://localhost:5432/test pnpm --filter @bluecollar/api exec vitest run \
    src/__tests__/integration/categories.integration.test.ts \
    src/__tests__/integration/admin.integration.test.ts
  ```

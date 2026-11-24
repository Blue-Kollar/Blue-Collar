# Load Testing

Performance tests live in `deploy/load-tests/`. They are **not** part of the
normal test suite — run them manually against a seeded database.

The **canonical, runnable API baseline** is
[`deploy/load-tests/api-baseline.k6.js`](../deploy/load-tests/api-baseline.k6.js).
The other scripts in `deploy/load-tests/` are specialised (payment, transaction,
DB, spike, stress) and are listed at the bottom of this document.

## Canonical API baseline (#1877)

The baseline exercises three realistic flows in a single VU iteration:

| Flow | Requests | Notes |
|------|----------|-------|
| Health | `GET /health` (root, not `/api/health`) | Derived from `BASE_URL` by stripping `/api[/vN]`; override with `HEALTH_URL` |
| Auth | `POST /api/auth/login` once in `setup()`, then `GET /api/auth/me` per iteration; `DELETE /api/auth/logout` in `teardown()` | Login is performed **once** on purpose: `/api/auth/login` is behind `strictAuthRateLimiter` (per-IP, 15-min window), so logging in on every iteration would measure the limiter, not the API. Without valid credentials the script falls back to an unauthenticated `GET /auth/me` (expects 401) and skips authenticated job reads. |
| Jobs | `GET /api/jobs` → `GET /api/jobs/:id` (first id from list) → `GET /api/jobs/me/posted` when a token is available | Read-only; no job mutation, so the test is safe to run against a seeded staging database. |

Measured metrics are tagged per endpoint (`health`, `auth_me`, `jobs_list`,
`jobs_detail`) so `--out json` can be sliced by endpoint.

## BASELINE definition

### Thresholds (acceptance criteria)

These are the current gate values enforced by the script's `thresholds` block.
A run that breaches any of them exits non-zero and fails CI.

| Metric | p95 | p99 | Error rate | Rationale |
|--------|-----|-----|------------|-----------|
| `http_req_duration` (all) | < 500 ms | < 1500 ms | — | Global SLO inherited from the existing API load tests |
| `http_req_failed` | — | — | < 5% | Network/HTTP-level failures |
| `api_error_rate` (failed checks per iteration) | — | — | < 5% | Logical failures (unexpected status, missing data) |
| `health_duration` | < 200 ms | < 500 ms | — | Liveness probe; must stay cheap |
| `auth_duration` | < 600 ms | < 1500 ms | — | Token validation on the hot path |
| `jobs_list_duration` | < 500 ms | < 1500 ms | — | Primary read endpoint (p50 ≤ 50 ms / p95 ≤ 200 ms SLA still applies to steady state) |
| `jobs_detail_duration` | < 400 ms | < 1200 ms | — | Single-row lookup |

### Capacity assumptions

| Assumption | Value |
|------------|-------|
| Environment | Production-like: 1 API instance (2 vCPU / 2 GB), seeded Postgres, same region as the test runner |
| Seeded data | ≥ 10 000 jobs so `/api/jobs` is not an empty-list benchmark |
| Baseline profile | 50 peak VUs, 1 VU ≈ 4 requests per 3 s think-time cycle ≈ 1.3 RPS ⇒ ≈ **65 RPS** at peak; ~10-minute run |
| Auth | One login per run (see above); test account is `loadtest@example.com` / `Password123!` unless overridden |
| Rate limiting | Public read limiter must not trip at 50 VUs; auth limiter is deliberately excluded from steady-state measurement |
| Noise | Run on an otherwise idle environment; record API instance count and git SHA with every result |

> These thresholds are **targets set before the first measured capture**. After
> the first `load` run, tighten each latency threshold to
> `measured p95 × 1.25` (25 % headroom) and update both this table and the
> `THRESHOLDS` constant in the script.

### Load profile (SCENARIO)

| `SCENARIO` | Profile | Duration | Purpose |
|------------|---------|----------|---------|
| `smoke` | 1 VU constant | 1 min | PR gate / pre-flight sanity |
| `load` | 0 → 10 (1 min) → 50 (3 min) → hold 50 (5 min) → 0 (1 min) | 10 min | **Baseline capture** |
| `stress` | 0 → 10 → 50 → 150 → hold → 0 | ~13 min | Find degradation point (not a baseline) |
| `soak` | 20 VUs constant | 30 min | Leak / pool-exhaustion detection |

### Environment overrides

| Variable | Default | Purpose |
|----------|---------|---------|
| `BASE_URL` | `http://localhost:3000/api` | API root under test |
| `HEALTH_URL` | derived from `BASE_URL` | Root health endpoint |
| `SCENARIO` | `load` | `smoke` / `load` / `stress` / `soak` |
| `TEST_EMAIL`, `TEST_PASSWORD` | `loadtest@example.com`, `Password123!` | One-time login identity |
| `JOBS_QUERY` | empty | Query string for `/api/jobs`, e.g. `?limit=20` |
| `THINK_TIME` | `1` | Seconds of sleep between flows |
| `PEAK_VUS`, `WARMUP_VUS`, `WARMUP_DURATION`, `RAMP_UP_DURATION`, `HOLD_DURATION`, `RAMP_DOWN_DURATION` | `50`, `10`, `1m`, `3m`, `5m`, `1m` | Staged profile knobs |
| `STRESS_VUS`, `SOAK_VUS`, `SOAK_DURATION`, `SMOKE_VUS`, `SMOKE_DURATION` | `150`, `20`, `30m`, `1`, `1m` | Other scenario knobs |
| `SUMMARY_JSON` | `results/api-baseline.json` | Baseline JSON output; set to `none` to disable |

## Running locally

Prerequisites: k6 ≥ 0.47 (`brew install k6`), a running API, and seeded jobs.
Do **not** run the full load profile against production without coordinating.

```bash
# Pre-flight (fast; runs on every PR in CI)
k6 run --env SCENARIO=smoke --env BASE_URL=http://localhost:3000/api \
  deploy/load-tests/api-baseline.k6.js

# Baseline capture against staging
mkdir -p results
k6 run --env SCENARIO=load \
       --env BASE_URL=https://api.staging.bluecollar.app/api \
       --env TEST_EMAIL=loadtest@bluecollar.app \
       --env TEST_PASSWORD='StagingPass123!' \
       --env SUMMARY_JSON=results/api-baseline.json \
       --out json=results/api-baseline-raw.json \
       deploy/load-tests/api-baseline.k6.js
```

The script always prints a compact baseline table to stdout and writes the
machine-readable summary to `SUMMARY_JSON` (create the directory first).
The raw `--out json` file preserves per-request samples for endpoint slicing.

## CI

`.github/workflows/load.yml` runs:

- **PR / push**: the `smoke` scenario of the canonical script, plus the existing
  search/auth smoke jobs. Thresholds gate the PR.
- **Nightly / manual**: the `load` scenario against staging (or `inputs.base_url`),
  archiving both the summary and raw JSON as artifacts for comparison.

`BASE_URL` is resolved from `inputs.base_url` → `secrets.STAGING_API_URL` →
`http://localhost:3000/api`.

## Recording and comparing runs

1. Copy the generated `results/api-baseline.json` to
   `docs/api-performance-baseline.json` and commit it with the git SHA and
   captured-at timestamp. This file is the **current accepted baseline**.
2. Keep this table in sync with the committed JSON:

   | Metric | p95 | p99 | Error rate | Captured at | Commit |
   |--------|-----|-----|------------|-------------|--------|
   | `http_req_duration` | TBD | TBD | — | — | — |
   | `health_duration` | TBD | TBD | — | — | — |
   | `auth_duration` | TBD | TBD | — | — | — |
   | `jobs_list_duration` | TBD | TBD | — | — | — |
   | `jobs_detail_duration` | TBD | TBD | — | — | — |
   | `http_req_failed` / `api_error_rate` | — | — | TBD | — | — |

   `TBD` means no measured baseline has been committed yet; there is no local
   API running in this environment, so the table is intentionally left for the
   first real capture.
3. Compare a new run against the committed baseline:

   ```bash
   node -e '
     const b = require("./docs/api-performance-baseline.json").baseline;
     const n = require("./results/api-baseline.json").baseline;
     for (const k of Object.keys(b)) {
       if (typeof b[k] !== "number" || typeof n[k] !== "number") continue;
       const delta = ((n[k] - b[k]) / b[k]) * 100;
       console.log(`${k}: ${b[k].toFixed(1)} → ${n[k].toFixed(1)} (${delta.toFixed(1)}%)`);
     }'
   ```

4. Regression rule: p95 worse by **> 25 %** or an error rate higher by
   **> 1 percentage point** blocks the change and requires investigation before
   the baseline is updated. Improvements are accepted by committing a new
   baseline JSON and updating the table.

## Other load tests in `deploy/load-tests/`

| Script | Focus |
|--------|-------|
| `payment-load-test.js` | Tips + escrow lifecycle (see `LOAD_TESTING_GUIDE.md`) |
| `transaction-submission-test.js` | Stellar transaction submission / idempotency |
| `api-load-test.js` | Workers/categories/auth mix (legacy) |
| `auth-load-test.js`, `basic-load-test.js`, `worker-crud-load-test.js` | Single-concern smoke/CRUD tests |
| `db-performance-test.js`, `contract-gas-test.js`, `spike-test.js`, `stress-test.js` | Specialised diagnostics |

## Legacy quick start (alternative harness)

The previous harness used `npm run test:load:jobs`. Kept here for reference
until that script is migrated to the canonical k6 baseline:

```bash
DATABASE_URL=postgres://... SEED_ROWS=100000 npm run seed:jobs
API_URL=http://localhost:8080 \
SEARCH_PATH='/api/jobs?q=plumbing&city=Lagos' \
CONNECTIONS=50 \
DURATION=30 \
npm run test:load:jobs
```

## Historical SLA

| Metric | Target | Notes |
|--------|--------|-------|
| p50    | ≤ 50 ms | median response |
| p95    | ≤ 200 ms | tail latency |
| p99    | ≤ 500 ms | worst-case expected |

Endpoints failing these targets get a follow-up issue with the recorded
numbers attached.

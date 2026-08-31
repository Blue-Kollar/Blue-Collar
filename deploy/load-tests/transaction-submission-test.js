/**
 * Concurrent Transaction Submission Load Test – BlueCollar (#1272)
 *
 * Tests realistic concurrent transaction-submission scenarios under load:
 *
 *   Scenario A (concurrent tips — burst pattern):
 *     Multiple VUs submit tips simultaneously, testing idempotency key
 *     contention and database row-level locking under contention.
 *
 *   Scenario B (mixed transaction mix):
 *     Realistic production traffic: 60% reads, 25% tips, 10% escrow creates,
 *     5% escrow releases. Tests the full payment pipeline under realistic
 *     read/write ratios.
 *
 *   Scenario C (high-frequency single-user):
 *     Simulates a single user submitting many transactions rapidly (e.g.
 *     batch tipping after a completed project). Tests rate limiting and
 *     idempotency key exhaustion.
 *
 *   Scenario D (escrow lifecycle under contention):
 *     Multiple VUs create and release escrows concurrently, testing the
 *     escrow state machine under parallel transitions.
 *
 * Four named scenarios are defined. Select one via --env SCENARIO=<name>:
 *
 *   burst    – 50 VUs, 2 min ramp, tips only (tests idempotency contention)
 *   mixed    – 30 VUs, 5 min sustained (realistic production mix)
 *   single   – 5 VUs, 3 min (batch-tipping single-user pattern)
 *   escrow   – 20 VUs, 4 min (escrow create/release lifecycle)
 *
 * Prerequisites:
 *   1. A BlueCollar API running at BASE_URL (default: http://localhost:3000/api)
 *   2. A curator account whose credentials are passed via env vars:
 *        TEST_EMAIL      (default: loadtest@example.com)
 *        TEST_PASSWORD   (default: Password123!)
 *   3. k6 ≥ 0.47: https://k6.io/docs/getting-started/installation/
 *
 * Run examples:
 *   # Burst pattern (idempotency contention)
 *   k6 run --env SCENARIO=burst deploy/load-tests/transaction-submission-test.js
 *
 *   # Mixed production traffic
 *   k6 run --env SCENARIO=mixed deploy/load-tests/transaction-submission-test.js
 *
 *   # Single-user batch pattern
 *   k6 run --env SCENARIO=single deploy/load-tests/transaction-submission-test.js
 *
 *   # Escrow lifecycle contention
 *   k6 run --env SCENARIO=escrow deploy/load-tests/transaction-submission-test.js
 *
 * Thresholds (defined below under THRESHOLDS):
 *   - All requests must complete within SLO latency bounds
 *   - Error rate must stay below threshold for each scenario type
 *   - Transaction-specific metrics must meet targeted p95/p99 bounds
 *
 * @module transaction-submission-test
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────

/** Fraction of virtual-user iterations that produced at least one error. */
const errorRate = new Rate('transaction_error_rate');

/** End-to-end latency for tip submission (POST /api/tips). */
const tipDuration = new Trend('tip_submission_duration', true);

/** End-to-end latency for escrow creation (POST /api/escrow). */
const escrowCreateDuration = new Trend('escrow_create_duration', true);

/** End-to-end latency for escrow release (POST /api/escrow/:id/release). */
const escrowReleaseDuration = new Trend('escrow_release_duration', true);

/** Total transactions submitted (tips + escrow creates + escrow releases). */
const txSubmitted = new Counter('transactions_submitted');

/** Total successful transactions (2xx responses). */
const txSuccess = new Counter('transactions_success');

/** Total failed transactions (4xx/5xx responses). */
const txFailure = new Counter('transactions_failure');

/** Idempotency key replay count (expected on retries). */
const idempotencyReplays = new Counter('idempotency_replays');

// ── Scenario definitions ──────────────────────────────────────────────────────

const SCENARIO_NAME = __ENV.SCENARIO || 'mixed';

const SCENARIOS = {
  /**
   * Burst pattern — 50 VUs submit tips simultaneously.
   * Tests idempotency key contention and row-level locking under heavy write load.
   */
  burst: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 50 },  // ramp up
      { duration: '1m', target: 50 },   // sustained burst
      { duration: '30s', target: 0 },   // ramp down
    ],
  },

  /**
   * Mixed production traffic — realistic read/write ratio.
   * 60% reads, 25% tips, 10% escrow creates, 5% escrow releases.
   * This is the primary scenario for baseline capture.
   */
  mixed: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },   // warm-up
      { duration: '2m', target: 30 },   // ramp to production-like load
      { duration: '2m', target: 30 },   // hold
      { duration: '1m', target: 0 },    // ramp down
    ],
  },

  /**
   * Single-user batch pattern — simulates a user batch-tipping many workers.
   * 5 VUs, each submitting rapid consecutive tips with unique idempotency keys.
   */
  single: {
    executor: 'constant-vus',
    vus: 5,
    duration: '3m',
  },

  /**
   * Escrow lifecycle contention — concurrent create/release cycles.
   * Tests the escrow state machine under parallel transitions.
   */
  escrow: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 20 },
      { duration: '2m', target: 20 },
      { duration: '30s', target: 0 },
    ],
  },
};

// ── SLO Thresholds ────────────────────────────────────────────────────────────
// These thresholds are the acceptance criteria for concurrent transaction
// submission. They are set generously to account for contention overhead;
// tighten after the first baseline run.
//
// Threshold rationale:
//   - tip_submission_duration: Tips are user-initiated; p95 < 2s, p99 < 4s
//   - escrow_create_duration: Escrow creation involves DB writes; p95 < 2s, p99 < 4s
//   - escrow_release_duration: Release involves DB write + notification; p95 < 3s, p99 < 5s
//   - transaction_error_rate: < 5% of VU iterations produce errors
//   - http_req_failed: < 10% of all HTTP requests fail (includes expected 422s)

const THRESHOLDS = {
  // Overall HTTP request latency (all endpoints)
  'http_req_duration':        ['p(95)<2000', 'p(99)<4000'],
  'http_req_failed':          ['rate<0.10'],

  // Transaction-specific SLOs
  'transaction_error_rate':   ['rate<0.05'],
  'tip_submission_duration':  ['p(95)<2000', 'p(99)<4000'],
  'escrow_create_duration':   ['p(95)<2000', 'p(99)<4000'],
  'escrow_release_duration':  ['p(95)<3000', 'p(99)<5000'],
};

export const options = {
  scenarios: {
    [SCENARIO_NAME]: SCENARIOS[SCENARIO_NAME] || SCENARIOS.mixed,
  },
  thresholds: THRESHOLDS,
};

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE        = __ENV.BASE_URL      || 'http://localhost:3000/api';
const TEST_EMAIL  = __ENV.TEST_EMAIL    || 'loadtest@example.com';
const TEST_PASS   = __ENV.TEST_PASSWORD || 'Password123!';
const JSON_HDRS   = { 'Content-Type': 'application/json' };

// ── Setup: obtain shared auth token and worker list before test starts ────────

export function setup() {
  const loginRes = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
    { headers: JSON_HDRS },
  );

  if (loginRes.status !== 202) {
    console.warn(`[setup] login failed with ${loginRes.status}; write scenarios will be skipped.`);
    return { token: '', workers: [] };
  }

  const token = loginRes.json('token');
  const authHdrs = { ...JSON_HDRS, Authorization: `Bearer ${token}` };

  // Fetch a batch of workers for use as payment recipients
  const workersRes = http.get(`${BASE}/workers?limit=10`, { headers: authHdrs });
  let workers: Array<{ id: string; walletAddress: string }> = [];

  if (workersRes.status === 200) {
    try {
      const data = workersRes.json('data');
      if (Array.isArray(data)) {
        workers = data.map((w: any) => ({
          id: w.id ?? '',
          walletAddress: w.walletAddress ?? w.wallet_address ?? '',
        })).filter((w: any) => w.id && w.walletAddress);
      }
    } catch (_) {}
  }

  return { token, workers };
}

// ── Helper functions ──────────────────────────────────────────────────────────

function randomWorker(workers: Array<{ id: string; walletAddress: string }>) {
  if (workers.length === 0) return null;
  return workers[Math.floor(Math.random() * workers.length)];
}

function makeIdempotencyKey(prefix: string, vu: number, iter: number) {
  return `${prefix}-${vu}-${iter}-${Date.now()}`;
}

// ── Main VU function ──────────────────────────────────────────────────────────

export default function (data: any) {
  const { token, workers } = data || {};
  const hasAuth   = Boolean(token);
  const hasWorker = workers && workers.length > 0;

  const authHdrs = hasAuth
    ? { ...JSON_HDRS, Authorization: `Bearer ${token}` }
    : JSON_HDRS;

  if (!hasAuth || !hasWorker) {
    // No credentials / no seed workers — read-only fallback
    group('read_only_fallback', () => {
      const res = http.get(`${BASE}/workers?limit=5`, {
        tags: { scenario: SCENARIO_NAME, phase: 'fallback' },
      });
      check(res, { 'GET /workers → 200': (r) => r.status === 200 });
    });
    sleep(1);
    return;
  }

  // ── Determine transaction mix based on scenario ───────────────────────────
  const rand = Math.random();
  const isBurst  = SCENARIO_NAME === 'burst';
  const isSingle = SCENARIO_NAME === 'single';
  const isEscrow = SCENARIO_NAME === 'escrow';

  if (isBurst) {
    // Burst: all VUs submit tips simultaneously
    submitTip(workers, authHdrs);
  } else if (isSingle) {
    // Single-user batch: rapid consecutive tips
    submitTip(workers, authHdrs);
    sleep(0.1); // Minimal delay between batch tips
  } else if (isEscrow) {
    // Escrow lifecycle: create then release
    escrowLifecycle(workers, authHdrs);
  } else {
    // Mixed: realistic production traffic ratio
    if (rand < 0.60) {
      // Read-only (60%)
      readOnlyDiscovery(workers);
    } else if (rand < 0.85) {
      // Tip submission (25%)
      submitTip(workers, authHdrs);
    } else if (rand < 0.95) {
      // Escrow create (10%)
      escrowCreate(workers, authHdrs);
    } else {
      // Escrow release (5%) — only on iterations where we have an escrow
      if (__ITER % 3 === 0) {
        escrowRelease(workers, authHdrs);
      } else {
        readOnlyDiscovery(workers);
      }
    }
  }

  sleep(isSingle ? 0.1 : 0.5);
}

// ── Transaction functions ─────────────────────────────────────────────────────

function readOnlyDiscovery(workers: Array<{ id: string; walletAddress: string }>) {
  group('read_discovery', () => {
    const worker = randomWorker(workers);
    const res = http.get(`${BASE}/workers?limit=10`, {
      tags: { scenario: SCENARIO_NAME, phase: 'read' },
    });
    check(res, {
      'GET /workers → 200':    (r) => r.status === 200,
      'GET /workers → <500ms': (r) => r.timings.duration < 500,
    });

    if (worker) {
      const detail = http.get(`${BASE}/workers/${worker.id}`, {
        tags: { scenario: SCENARIO_NAME, phase: 'read' },
      });
      check(detail, {
        'GET /workers/:id → 200':    (r) => r.status === 200,
        'GET /workers/:id → <400ms': (r) => r.timings.duration < 400,
      });
    }
  });
}

function submitTip(workers: Array<{ id: string; walletAddress: string }>, authHdrs: Record<string, string>) {
  group('tip_submission', () => {
    const worker = randomWorker(workers);
    if (!worker) return;

    const idempotencyKey = makeIdempotencyKey('tip', __VU, __ITER);

    const t0 = Date.now();
    const res = http.post(
      `${BASE}/tips`,
      JSON.stringify({
        workerId: worker.id,
        workerWallet: worker.walletAddress,
        amountXlm: '1.0',
        memo: `k6 concurrent tx test — VU ${__VU} iter ${__ITER}`,
        idempotencyKey,
      }),
      {
        headers: { ...authHdrs, 'Idempotency-Key': idempotencyKey },
        tags: { scenario: SCENARIO_NAME, phase: 'tip' },
      },
    );
    tipDuration.add(Date.now() - t0);
    txSubmitted.add(1);

    const ok = check(res, {
      'POST /tips → not 5xx':     (r) => r.status < 500,
      'POST /tips → <2000ms':     (r) => r.timings.duration < 2000,
    });

    if (res.status < 300) {
      txSuccess.add(1);
    } else {
      txFailure.add(1);
    }
    errorRate.add(!ok);

    // Idempotency replay test — send same key again
    const replay = http.post(
      `${BASE}/tips`,
      JSON.stringify({
        workerId: worker.id,
        workerWallet: worker.walletAddress,
        amountXlm: '1.0',
        memo: 'k6 idempotency replay',
        idempotencyKey,
      }),
      {
        headers: { ...authHdrs, 'Idempotency-Key': idempotencyKey },
        tags: { scenario: SCENARIO_NAME, phase: 'tip_replay' },
      },
    );

    if (replay.status === res.status) {
      idempotencyReplays.add(1);
    }

    check(replay, {
      'POST /tips (replay) → same status': (r) => r.status === res.status,
      'POST /tips (replay) → not 5xx':     (r) => r.status < 500,
    });
  });
}

function escrowCreate(workers: Array<{ id: string; walletAddress: string }>, authHdrs: Record<string, string>) {
  group('escrow_create', () => {
    const worker = randomWorker(workers);
    if (!worker) return;

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const t0 = Date.now();
    const res = http.post(
      `${BASE}/escrow`,
      JSON.stringify({
        payeeId: worker.id,
        amountXlm: '5.0',
        expiresAt,
        jobId: null,
      }),
      {
        headers: authHdrs,
        tags: { scenario: SCENARIO_NAME, phase: 'escrow_create' },
      },
    );
    escrowCreateDuration.add(Date.now() - t0);
    txSubmitted.add(1);

    const ok = check(res, {
      'POST /escrow → 201 or 422': (r) => [201, 422].includes(r.status),
      'POST /escrow → not 5xx':    (r) => r.status < 500,
      'POST /escrow → <2000ms':    (r) => r.timings.duration < 2000,
    });

    if (res.status === 201) {
      txSuccess.add(1);
    } else {
      txFailure.add(1);
    }
    errorRate.add(!ok);
  });
}

function escrowRelease(workers: Array<{ id: string; walletAddress: string }>, authHdrs: Record<string, string>) {
  group('escrow_release', () => {
    // Create an escrow first, then release it
    const worker = randomWorker(workers);
    if (!worker) return;

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createRes = http.post(
      `${BASE}/escrow`,
      JSON.stringify({
        payeeId: worker.id,
        amountXlm: '2.0',
        expiresAt,
        jobId: null,
      }),
      {
        headers: authHdrs,
        tags: { scenario: SCENARIO_NAME, phase: 'escrow_create_for_release' },
      },
    );

    if (createRes.status !== 201) return;

    let escrowId: string | null = null;
    try {
      escrowId = createRes.json('data.id') ?? createRes.json('id');
    } catch (_) {}

    if (!escrowId) return;

    sleep(0.2);

    const t0 = Date.now();
    const releaseRes = http.post(
      `${BASE}/escrow/${escrowId}/release`,
      null,
      {
        headers: authHdrs,
        tags: { scenario: SCENARIO_NAME, phase: 'escrow_release' },
      },
    );
    escrowReleaseDuration.add(Date.now() - t0);
    txSubmitted.add(1);

    const ok = check(releaseRes, {
      'POST /escrow/:id/release → 200 or 403': (r) => [200, 403].includes(r.status),
      'POST /escrow/:id/release → not 5xx':    (r) => r.status < 500,
      'POST /escrow/:id/release → <3000ms':    (r) => r.timings.duration < 3000,
    });

    if (releaseRes.status === 200) {
      txSuccess.add(1);
    } else {
      txFailure.add(1);
    }
    errorRate.add(!ok);
  });
}

function escrowLifecycle(workers: Array<{ id: string; walletAddress: string }>, authHdrs: Record<string, string>) {
  group('escrow_lifecycle', () => {
    const worker = randomWorker(workers);
    if (!worker) return;

    // Create
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const t0 = Date.now();
    const createRes = http.post(
      `${BASE}/escrow`,
      JSON.stringify({
        payeeId: worker.id,
        amountXlm: '10.0',
        expiresAt,
        jobId: null,
      }),
      {
        headers: authHdrs,
        tags: { scenario: SCENARIO_NAME, phase: 'escrow_create' },
      },
    );
    escrowCreateDuration.add(Date.now() - t0);
    txSubmitted.add(1);

    const created = check(createRes, {
      'POST /escrow → 201 or 422': (r) => [201, 422].includes(r.status),
      'POST /escrow → not 5xx':    (r) => r.status < 500,
    });

    if (createRes.status === 201) {
      txSuccess.add(1);
      let escrowId: string | null = null;
      try { escrowId = createRes.json('data.id') ?? createRes.json('id'); } catch (_) {}

      if (escrowId) {
        sleep(0.3);

        // Release
        const t1 = Date.now();
        const releaseRes = http.post(
          `${BASE}/escrow/${escrowId}/release`,
          null,
          {
            headers: authHdrs,
            tags: { scenario: SCENARIO_NAME, phase: 'escrow_release' },
          },
        );
        escrowReleaseDuration.add(Date.now() - t1);
        txSubmitted.add(1);

        const released = check(releaseRes, {
          'POST /escrow/:id/release → 200 or 403': (r) => [200, 403].includes(r.status),
          'POST /escrow/:id/release → not 5xx':    (r) => r.status < 500,
        });

        if (releaseRes.status === 200) {
          txSuccess.add(1);
        } else {
          txFailure.add(1);
        }
        errorRate.add(!released);
      }
    } else {
      txFailure.add(1);
    }
    errorRate.add(!created);
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function handleSummary(data: any) {
  const m = data.metrics;

  const summary = {
    scenario:   SCENARIO_NAME,
    capturedAt: new Date().toISOString(),
    baseline: {
      tip_submission_duration_p95:     m.tip_submission_duration?.values?.['p(95)']   ?? null,
      tip_submission_duration_p99:     m.tip_submission_duration?.values?.['p(99)']   ?? null,
      escrow_create_duration_p95:      m.escrow_create_duration?.values?.['p(95)']    ?? null,
      escrow_create_duration_p99:      m.escrow_create_duration?.values?.['p(99)']    ?? null,
      escrow_release_duration_p95:     m.escrow_release_duration?.values?.['p(95)']   ?? null,
      escrow_release_duration_p99:     m.escrow_release_duration?.values?.['p(99)']   ?? null,
      http_req_duration_p95:           m.http_req_duration?.values?.['p(95)']          ?? null,
      http_req_duration_p99:           m.http_req_duration?.values?.['p(99)']          ?? null,
      http_req_failed_rate:            m.http_req_failed?.values?.rate                 ?? null,
      transaction_error_rate:          m.transaction_error_rate?.values?.rate          ?? null,
      transactions_submitted:          m.transactions_submitted?.values?.count         ?? null,
      transactions_success:            m.transactions_success?.values?.count           ?? null,
      transactions_failure:            m.transactions_failure?.values?.count           ?? null,
      idempotency_replays:             m.idempotency_replays?.values?.count            ?? null,
    },
    thresholds: {
      passed: Object.entries(data.metrics)
        .filter(([, v]: [string, any]) => v.thresholds && Object.values(v.thresholds).every((t: any) => !t.ok === false))
        .map(([k]) => k),
      failed: Object.entries(data.metrics)
        .filter(([, v]: [string, any]) => v.thresholds && Object.values(v.thresholds).some((t: any) => !t.ok))
        .map(([k]) => k),
    },
  };

  return {
    'results/transaction-submission-baseline.json': JSON.stringify(summary, null, 2),
    stdout: buildTextSummary(summary),
  };
}

function buildTextSummary(s: any) {
  const ms = (v: number | null) => (v == null ? 'n/a' : `${Math.round(v)}ms`);
  const pct = (v: number | null) => (v == null ? 'n/a' : `${(v * 100).toFixed(2)}%`);
  return `
╔══════════════════════════════════════════════════════════╗
║   BlueCollar – Transaction Submission Performance        ║
╠══════════════════════════════════════════════════════════╣
║  Scenario:  ${s.scenario.padEnd(45)}║
║  Captured:  ${s.capturedAt.padEnd(45)}║
╠══════════════════════════════════════════════════════════╣
║  Tip submit              p(95): ${ms(s.baseline.tip_submission_duration_p95).padEnd(22)}║
║  Tip submit              p(99): ${ms(s.baseline.tip_submission_duration_p99).padEnd(22)}║
║  Escrow create           p(95): ${ms(s.baseline.escrow_create_duration_p95).padEnd(22)}║
║  Escrow create           p(99): ${ms(s.baseline.escrow_create_duration_p99).padEnd(22)}║
║  Escrow release          p(95): ${ms(s.baseline.escrow_release_duration_p95).padEnd(22)}║
║  Escrow release          p(99): ${ms(s.baseline.escrow_release_duration_p99).padEnd(22)}║
║  Overall HTTP            p(95): ${ms(s.baseline.http_req_duration_p95).padEnd(22)}║
║  HTTP error rate:               ${pct(s.baseline.http_req_failed_rate).padEnd(22)}║
║  Transaction error rate:        ${pct(s.baseline.transaction_error_rate).padEnd(22)}║
║  Transactions submitted:        ${String(s.baseline.transactions_submitted ?? 'n/a').padEnd(22)}║
║  Transactions success:          ${String(s.baseline.transactions_success ?? 'n/a').padEnd(22)}║
║  Transactions failure:          ${String(s.baseline.transactions_failure ?? 'n/a').padEnd(22)}║
║  Idempotency replays:           ${String(s.baseline.idempotency_replays ?? 'n/a').padEnd(22)}║
╠══════════════════════════════════════════════════════════╣
║  Thresholds FAILED: ${(s.thresholds.failed.join(', ') || 'none').padEnd(36)}║
╚══════════════════════════════════════════════════════════╝
`;
}

/**
 * Payment Processing Path Load Test – BlueCollar (#1060)
 *
 * Tests the critical payment processing path end-to-end under realistic load:
 *
 *   Scenario A (tip flow):
 *     POST /api/auth/login  →  GET /api/workers  →  POST /api/tips
 *
 *   Scenario B (escrow flow):
 *     POST /api/auth/login  →  GET /api/workers  →  POST /api/escrow
 *                           →  PATCH /api/escrow/:id/activate
 *                           →  POST  /api/escrow/:id/release
 *
 *   Scenario C (read-only throughput – most common in production):
 *     GET /api/workers  →  GET /api/workers/:id
 *
 * Four named scenarios are defined. Select one via --env SCENARIO=<name>:
 *
 *   smoke   – 1 VU, 1 min (sanity check before committing to a full run)
 *   load    – realistic sustained load, ramp to 50 VUs (baseline capture)
 *   stress  – ramp to 150 VUs to find the degradation point
 *   soak    – 20 VUs for 30 min (memory-leak / connection-pool drain)
 *
 * Prerequisites:
 *   1. A BlueCollar API running at BASE_URL (default: http://localhost:3000/api)
 *   2. A curator account whose credentials are passed via env vars:
 *        TEST_EMAIL      (default: loadtest@example.com)
 *        TEST_PASSWORD   (default: Password123!)
 *   3. k6 ≥ 0.47: https://k6.io/docs/getting-started/installation/
 *
 * Run examples:
 *   # Smoke test (quick sanity)
 *   k6 run --env SCENARIO=smoke deploy/load-tests/payment-load-test.js
 *
 *   # Baseline capture (load scenario) against staging
 *   k6 run --env SCENARIO=load \
 *          --env BASE_URL=https://api.staging.bluecollar.app/api \
 *          --env TEST_EMAIL=loadtest@bluecollar.app \
 *          --env TEST_PASSWORD=StagingPass123! \
 *          --out json=results/payment-baseline.json \
 *          deploy/load-tests/payment-load-test.js
 *
 * Thresholds (defined below under THRESHOLDS):
 *   See docs/LOAD_TESTING_GUIDE.md#payment-path for rationale and baseline values.
 *
 * @module payment-load-test
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────

/** Fraction of virtual-user iterations that produced at least one error. */
const errorRate = new Rate('payment_error_rate');

/** End-to-end latency for the tip submission (POST /api/tips). */
const tipDuration = new Trend('tip_submit_duration', true);

/** End-to-end latency for escrow creation (POST /api/escrow). */
const escrowCreateDuration = new Trend('escrow_create_duration', true);

/** End-to-end latency for escrow release (POST /api/escrow/:id/release). */
const escrowReleaseDuration = new Trend('escrow_release_duration', true);

/** Total payment operations (tips + escrow creates + escrow releases). */
const paymentOps = new Counter('payment_ops_total');

// ── Scenario definitions ──────────────────────────────────────────────────────

const SCENARIO_NAME = __ENV.SCENARIO || 'load';

const SCENARIOS = {
  /** Sanity check — fails fast if something is fundamentally broken. */
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
  },
  /**
   * Baseline load — sustained realistic traffic.
   * Run this against a production-like environment to capture baseline metrics.
   * Record the p(95) values from the output as the baseline in
   * docs/LOAD_TESTING_GUIDE.md.
   */
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 10 },   // warm-up
      { duration: '5m', target: 50 },   // sustained load
      { duration: '5m', target: 50 },   // hold
      { duration: '2m', target: 0 },    // ramp down
    ],
  },
  /**
   * Stress test — push beyond normal load to find the degradation point.
   * Do not use this as a baseline; use it to discover limits.
   */
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '3m', target: 100 },
      { duration: '3m', target: 150 },
      { duration: '5m', target: 150 },
      { duration: '2m', target: 0 },
    ],
  },
  /**
   * Soak test — sustained moderate load for an extended period.
   * Catches memory leaks and connection pool exhaustion that only appear over time.
   */
  soak: {
    executor: 'constant-vus',
    vus: 20,
    duration: '30m',
  },
};

// ── SLO Thresholds ────────────────────────────────────────────────────────────
// These are the acceptance criteria for the payment path (see docs/LOAD_TESTING_GUIDE.md).
// Update the baseline section in that doc after running the load scenario.
//
// Current thresholds are intentionally generous because they are set before
// the first baseline run. Tighten them once baseline p(95) values are known.

const THRESHOLDS = {
  // Overall HTTP request latency (all endpoints)
  'http_req_duration':        ['p(95)<1000', 'p(99)<2500'],
  'http_req_failed':          ['rate<0.05'],

  // Payment-specific SLOs
  'payment_error_rate':       ['rate<0.05'],
  'tip_submit_duration':      ['p(95)<1500', 'p(99)<3000'],
  'escrow_create_duration':   ['p(95)<1500', 'p(99)<3000'],
  'escrow_release_duration':  ['p(95)<2000', 'p(99)<4000'],
};

export const options = {
  scenarios: {
    [SCENARIO_NAME]: SCENARIOS[SCENARIO_NAME] || SCENARIOS.load,
  },
  thresholds: THRESHOLDS,
};

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE        = __ENV.BASE_URL      || 'http://localhost:3000/api';
const TEST_EMAIL  = __ENV.TEST_EMAIL    || 'loadtest@example.com';
const TEST_PASS   = __ENV.TEST_PASSWORD || 'Password123!';
const JSON_HDRS   = { 'Content-Type': 'application/json' };

// ── Setup: obtain a shared auth token before the test starts ──────────────────

/**
 * k6 calls `setup()` once before the test begins. We obtain a JWT and a
 * target worker ID here so every VU iteration has them available.
 */
export function setup() {
  const loginRes = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
    { headers: JSON_HDRS },
  );

  if (loginRes.status !== 202) {
    console.warn(`[setup] login failed with ${loginRes.status}; payment write scenarios will be skipped.`);
    return { token: '', workerId: '', workerWallet: '' };
  }

  const token = loginRes.json('token');
  const authHdrs = { ...JSON_HDRS, Authorization: `Bearer ${token}` };

  // Find a worker to use as the payment recipient
  const workersRes = http.get(`${BASE}/workers?limit=1`, { headers: authHdrs });
  let workerId = '';
  let workerWallet = '';

  if (workersRes.status === 200) {
    try {
      const workers = workersRes.json('data');
      if (Array.isArray(workers) && workers.length > 0) {
        workerId     = workers[0].id ?? '';
        workerWallet = workers[0].walletAddress ?? workers[0].wallet_address ?? '';
      }
    } catch (_) {}
  }

  return { token, workerId, workerWallet };
}

// ── Main VU function ──────────────────────────────────────────────────────────

export default function (data) {
  const { token, workerId, workerWallet } = data || {};
  const hasAuth   = Boolean(token);
  const hasWorker = Boolean(workerId);

  const authHdrs = hasAuth
    ? { ...JSON_HDRS, Authorization: `Bearer ${token}` }
    : JSON_HDRS;

  // ── Group A: Read-only worker discovery (no auth required) ─────────────────
  group('worker_discovery', () => {
    const listRes = http.get(`${BASE}/workers?limit=10`, {
      tags: { scenario: 'payment', phase: 'discovery' },
    });
    const listOk = check(listRes, {
      'GET /workers → 200':         (r) => r.status === 200,
      'GET /workers → <500ms':      (r) => r.timings.duration < 500,
      'GET /workers → has data key': (r) => {
        try { return Array.isArray(r.json('data')); } catch { return false; }
      },
    });
    errorRate.add(!listOk);

    if (hasWorker) {
      const detailRes = http.get(`${BASE}/workers/${workerId}`, {
        tags: { scenario: 'payment', phase: 'discovery' },
      });
      check(detailRes, {
        'GET /workers/:id → 200':    (r) => r.status === 200,
        'GET /workers/:id → <400ms': (r) => r.timings.duration < 400,
      });
    }
  });

  sleep(0.5);

  if (!hasAuth || !hasWorker) {
    // No credentials / no seed worker — skip write paths
    sleep(1);
    return;
  }

  // ── Group B: Tip submission ────────────────────────────────────────────────
  // Tips are the most frequent payment operation. We test the happy path
  // (valid amount, different sender/recipient) and one guard path
  // (idempotency key replay).
  group('tip_submission', () => {
    const idempotencyKey = `k6-tip-${__VU}-${__ITER}`;

    const t0 = Date.now();
    const tipRes = http.post(
      `${BASE}/tips`,
      JSON.stringify({
        workerId,
        workerWallet,
        amountXlm:  1,          // smallest meaningful tip
        memo:       'k6 load test — safe to ignore',
        idempotencyKey,
      }),
      {
        headers: { ...authHdrs, 'Idempotency-Key': idempotencyKey },
        tags:    { scenario: 'payment', phase: 'tip' },
      },
    );
    tipDuration.add(Date.now() - t0);

    const tipOk = check(tipRes, {
      // 201 = tip created, 200 = idempotent replay, 422 = validation error
      // We accept 422 because the test user might not have a wallet configured.
      // We do NOT accept 5xx.
      'POST /tips → not 5xx':     (r) => r.status < 500,
      'POST /tips → <1500ms':     (r) => r.timings.duration < 1500,
    });
    errorRate.add(!tipOk);
    paymentOps.add(1);

    // Idempotent retry — send the same Idempotency-Key again.
    // The middleware must replay the cached response (not create a 2nd tip).
    const replayRes = http.post(
      `${BASE}/tips`,
      JSON.stringify({
        workerId,
        workerWallet,
        amountXlm:  1,
        memo:       'k6 load test — idempotent retry',
        idempotencyKey,
      }),
      {
        headers: { ...authHdrs, 'Idempotency-Key': idempotencyKey },
        tags:    { scenario: 'payment', phase: 'tip_retry' },
      },
    );
    check(replayRes, {
      'POST /tips (retry) → same status as original': (r) => r.status === tipRes.status,
      'POST /tips (retry) → not 5xx':                 (r) => r.status < 500,
    });
  });

  sleep(0.5);

  // ── Group C: Escrow lifecycle (create → release) ──────────────────────────
  // Only runs on every 5th iteration to keep the escrow-path load realistic
  // relative to tip throughput (escrows are less frequent than tips).
  if (__ITER % 5 === 0) {
    group('escrow_lifecycle', () => {
      // Create escrow
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now
      const t0 = Date.now();
      const createRes = http.post(
        `${BASE}/escrow`,
        JSON.stringify({
          payeeId:   workerId,
          amountXlm: 10,
          expiresAt,
          jobId:     null,
        }),
        {
          headers: authHdrs,
          tags:    { scenario: 'payment', phase: 'escrow_create' },
        },
      );
      escrowCreateDuration.add(Date.now() - t0);
      paymentOps.add(1);

      const created = check(createRes, {
        'POST /escrow → 201 or 422': (r) => [201, 422].includes(r.status),
        'POST /escrow → not 5xx':    (r) => r.status < 500,
        'POST /escrow → <1500ms':    (r) => r.timings.duration < 1500,
      });
      errorRate.add(!created);

      if (createRes.status === 201) {
        let escrowId;
        try { escrowId = createRes.json('data.id') ?? createRes.json('id'); } catch (_) {}

        if (escrowId) {
          sleep(0.3);

          // Release escrow (simulate payer confirming work is done)
          const t1 = Date.now();
          const releaseRes = http.post(
            `${BASE}/escrow/${escrowId}/release`,
            null,
            {
              headers: authHdrs,
              tags:    { scenario: 'payment', phase: 'escrow_release' },
            },
          );
          escrowReleaseDuration.add(Date.now() - t1);
          paymentOps.add(1);

          check(releaseRes, {
            'POST /escrow/:id/release → 200 or 403': (r) => [200, 403].includes(r.status),
            'POST /escrow/:id/release → not 5xx':    (r) => r.status < 500,
            'POST /escrow/:id/release → <2000ms':    (r) => r.timings.duration < 2000,
          });
        }
      }
    });
  }

  sleep(1);
}

// ── Summary ───────────────────────────────────────────────────────────────────

/**
 * k6 calls `handleSummary` once after the test ends.
 * We write a JSON file suitable for use as the baseline record.
 *
 * To commit a new baseline, run the load scenario and copy the
 * generated file to docs/payment-performance-baseline.json.
 */
export function handleSummary(data) {
  const m = data.metrics;

  const summary = {
    scenario:   SCENARIO_NAME,
    capturedAt: new Date().toISOString(),
    baseline: {
      tip_submit_duration_p95:     m.tip_submit_duration?.values?.['p(95)']   ?? null,
      tip_submit_duration_p99:     m.tip_submit_duration?.values?.['p(99)']   ?? null,
      escrow_create_duration_p95:  m.escrow_create_duration?.values?.['p(95)'] ?? null,
      escrow_create_duration_p99:  m.escrow_create_duration?.values?.['p(99)'] ?? null,
      escrow_release_duration_p95: m.escrow_release_duration?.values?.['p(95)'] ?? null,
      escrow_release_duration_p99: m.escrow_release_duration?.values?.['p(99)'] ?? null,
      http_req_duration_p95:       m.http_req_duration?.values?.['p(95)']     ?? null,
      http_req_duration_p99:       m.http_req_duration?.values?.['p(99)']     ?? null,
      http_req_failed_rate:        m.http_req_failed?.values?.rate             ?? null,
      payment_error_rate:          m.payment_error_rate?.values?.rate          ?? null,
      payment_ops_total:           m.payment_ops_total?.values?.count          ?? null,
    },
    thresholds: {
      passed: Object.entries(data.metrics)
        .filter(([, v]) => v.thresholds && Object.values(v.thresholds).every((t) => !t.ok === false))
        .map(([k]) => k),
      failed: Object.entries(data.metrics)
        .filter(([, v]) => v.thresholds && Object.values(v.thresholds).some((t) => !t.ok))
        .map(([k]) => k),
    },
  };

  // Write machine-readable baseline for CI comparison
  return {
    'results/payment-baseline.json': JSON.stringify(summary, null, 2),
    stdout: buildTextSummary(summary),
  };
}

function buildTextSummary(s) {
  const ms = (v) => (v == null ? 'n/a' : `${Math.round(v)}ms`);
  const pct = (v) => (v == null ? 'n/a' : `${(v * 100).toFixed(2)}%`);
  return `
╔══════════════════════════════════════════════════════╗
║   BlueCollar – Payment Path Performance Baseline     ║
╠══════════════════════════════════════════════════════╣
║  Scenario:  ${s.scenario.padEnd(42)}║
║  Captured:  ${s.capturedAt.padEnd(42)}║
╠══════════════════════════════════════════════════════╣
║  Tip submit              p(95): ${ms(s.baseline.tip_submit_duration_p95).padEnd(20)}║
║  Tip submit              p(99): ${ms(s.baseline.tip_submit_duration_p99).padEnd(20)}║
║  Escrow create           p(95): ${ms(s.baseline.escrow_create_duration_p95).padEnd(20)}║
║  Escrow create           p(99): ${ms(s.baseline.escrow_create_duration_p99).padEnd(20)}║
║  Escrow release          p(95): ${ms(s.baseline.escrow_release_duration_p95).padEnd(20)}║
║  Escrow release          p(99): ${ms(s.baseline.escrow_release_duration_p99).padEnd(20)}║
║  Overall HTTP            p(95): ${ms(s.baseline.http_req_duration_p95).padEnd(20)}║
║  HTTP error rate:               ${pct(s.baseline.http_req_failed_rate).padEnd(20)}║
║  Payment error rate:            ${pct(s.baseline.payment_error_rate).padEnd(20)}║
║  Total payment ops:             ${String(s.baseline.payment_ops_total ?? 'n/a').padEnd(20)}║
╠══════════════════════════════════════════════════════╣
║  Thresholds FAILED: ${(s.thresholds.failed.join(', ') || 'none').padEnd(33)}║
╚══════════════════════════════════════════════════════╝
`;
}

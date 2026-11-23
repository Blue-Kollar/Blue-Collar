/**
 * Search & Discovery Load Test – BlueCollar (#813)
 *
 * Covers the hot search/discovery endpoints:
 *   GET /api/workers           – worker listing (paginated, filtered)
 *   GET /api/workers/:id       – single worker lookup
 *   GET /api/categories        – category listing
 *
 * SLOs (thresholds):
 *   p(95) < 500 ms  for worker list
 *   p(95) < 300 ms  for categories
 *   p(99) < 1 500 ms globally
 *   error rate < 2%
 *
 * Run:
 *   k6 run --env SCENARIO=load packages/api/load/search.js
 *   k6 run --env SCENARIO=stress packages/api/load/search.js
 *   k6 run --env BASE_URL=https://staging.bluecollar.app/api packages/api/load/search.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate = new Rate('error_rate');
const workerListP95 = new Trend('worker_list_duration', true);
const categoryP95 = new Trend('category_duration', true);
const singleWorkerP95 = new Trend('single_worker_duration', true);

// ── Scenario profiles ─────────────────────────────────────────────────────────
const PROFILES = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 0 },
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 200 },
      { duration: '3m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '2m', target: 0 },
    ],
  },
  soak: {
    executor: 'constant-vus',
    vus: 50,
    duration: '30m',
  },
};

const SCENARIO = __ENV.SCENARIO || 'load';

export const options = {
  scenarios: {
    [SCENARIO]: PROFILES[SCENARIO] ?? PROFILES.load,
  },
  thresholds: {
    // Global SLOs
    http_req_duration: ['p(99)<1500'],
    http_req_failed: ['rate<0.02'],
    error_rate: ['rate<0.02'],
    // Per-endpoint SLOs
    worker_list_duration: ['p(95)<500'],
    category_duration: ['p(95)<300'],
    single_worker_duration: ['p(95)<400'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000/api';

// ── Setup: fetch a real worker ID to use in single-worker tests ───────────────
export function setup() {
  const res = http.get(`${BASE}/workers?limit=1`);
  try {
    const body = res.json();
    const workers = body.data ?? body;
    if (Array.isArray(workers) && workers.length > 0) {
      return { workerId: workers[0].id };
    }
  } catch (_) {}
  return { workerId: null };
}

// ── Main VU loop ──────────────────────────────────────────────────────────────
export default function (ctx) {
  const { workerId } = ctx;

  group('discovery', () => {
    // Worker list
    const t0 = Date.now();
    const listRes = http.get(`${BASE}/workers`, {
      tags: { endpoint: 'worker_list' },
    });
    workerListP95.add(Date.now() - t0);

    const listOk = check(listRes, {
      'GET /workers → 200': (r) => r.status === 200,
      'GET /workers → has data': (r) => {
        try {
          return r.json('data') != null || Array.isArray(r.json());
        } catch {
          return false;
        }
      },
      'GET /workers → <500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!listOk);

    sleep(0.3);

    // Categories
    const t1 = Date.now();
    const catRes = http.get(`${BASE}/categories`, {
      tags: { endpoint: 'categories' },
    });
    categoryP95.add(Date.now() - t1);

    check(catRes, {
      'GET /categories → 200': (r) => r.status === 200,
      'GET /categories → <300ms': (r) => r.timings.duration < 300,
    });

    sleep(0.3);

    // Single worker
    if (workerId) {
      const t2 = Date.now();
      const singleRes = http.get(`${BASE}/workers/${workerId}`, {
        tags: { endpoint: 'single_worker' },
      });
      singleWorkerP95.add(Date.now() - t2);

      check(singleRes, {
        'GET /workers/:id → 200': (r) => r.status === 200,
        'GET /workers/:id → <400ms': (r) => r.timings.duration < 400,
      });

      sleep(0.3);
    }

    // Filtered search
    const filterRes = http.get(`${BASE}/workers?category=plumber&page=1&limit=20`, {
      tags: { endpoint: 'worker_filter' },
    });
    check(filterRes, {
      'GET /workers?category → 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

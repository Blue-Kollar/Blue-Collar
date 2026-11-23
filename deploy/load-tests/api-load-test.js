/**
 * Comprehensive API Load Test – BlueCollar
 * Closes #406
 *
 * Scenarios:
 *   1. smoke    – 1 VU, 1 min  (sanity check)
 *   2. load     – ramp to 100 VUs over 16 min
 *   3. stress   – ramp to 300 VUs to find breaking point
 *   4. soak     – 50 VUs for 30 min (memory/leak detection)
 *   5. spike    – instant jump to 500 VUs
 *
 * Run: k6 run --env SCENARIO=load deploy/load-tests/api-load-test.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate = new Rate('error_rate');
const workerListDuration = new Trend('worker_list_duration');
const authDuration = new Trend('auth_duration');
const categoryDuration = new Trend('category_duration');
const totalRequests = new Counter('total_requests');

// ── Scenario selection ────────────────────────────────────────────────────────
const SCENARIO = __ENV.SCENARIO || 'load';

const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 20 },
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
      { duration: '2m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '2m', target: 0 },
    ],
  },
  soak: {
    executor: 'constant-vus',
    vus: 50,
    duration: '30m',
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 500 },
      { duration: '1m', target: 500 },
      { duration: '10s', target: 0 },
    ],
  },
};

export const options = {
  scenarios: {
    [SCENARIO]: SCENARIOS[SCENARIO] || SCENARIOS.load,
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.05'],
    error_rate: ['rate<0.05'],
    worker_list_duration: ['p(95)<400'],
    auth_duration: ['p(95)<600'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

// ── Shared state ──────────────────────────────────────────────────────────────
let authToken = '';

export function setup() {
  // Obtain a token once before the test
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'loadtest@example.com',
      password: __ENV.TEST_PASSWORD || 'Password123!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status === 202) {
    return { token: res.json('token') };
  }
  return { token: '' };
}

// ── Main VU function ──────────────────────────────────────────────────────────
export default function (data) {
  const token = data?.token || '';
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  group('Public endpoints', () => {
    // Workers list
    const t0 = Date.now();
    const workersRes = http.get(`${BASE_URL}/workers`, { headers });
    workerListDuration.add(Date.now() - t0);
    totalRequests.add(1);

    const workersOk = check(workersRes, {
      'GET /workers → 200': (r) => r.status === 200,
      'GET /workers → has data': (r) => {
        try {
          return Array.isArray(r.json('data'));
        } catch {
          return false;
        }
      },
      'GET /workers → <500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!workersOk);

    sleep(0.5);

    // Categories
    const t1 = Date.now();
    const catRes = http.get(`${BASE_URL}/categories`, { headers });
    categoryDuration.add(Date.now() - t1);
    totalRequests.add(1);

    check(catRes, {
      'GET /categories → 200': (r) => r.status === 200,
      'GET /categories → <300ms': (r) => r.timings.duration < 300,
    });

    sleep(0.5);

    // Single worker (if list returned results)
    try {
      const workers = workersRes.json('data');
      if (Array.isArray(workers) && workers.length > 0) {
        const id = workers[0].id;
        const singleRes = http.get(`${BASE_URL}/workers/${id}`, { headers });
        totalRequests.add(1);
        check(singleRes, {
          'GET /workers/:id → 200': (r) => r.status === 200,
          'GET /workers/:id → <400ms': (r) => r.timings.duration < 400,
        });
      }
    } catch (_) {}
  });

  group('Auth endpoints', () => {
    // Login attempt (with wrong password to avoid creating sessions)
    const t2 = Date.now();
    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: 'nonexistent@example.com', password: 'WrongPass!' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    authDuration.add(Date.now() - t2);
    totalRequests.add(1);

    check(loginRes, {
      'POST /auth/login (invalid) → 401 or 400': (r) => [400, 401].includes(r.status),
      'POST /auth/login → <600ms': (r) => r.timings.duration < 600,
    });
  });

  sleep(1);
}

export function teardown(data) {
  console.log(`Load test complete. Total requests: ${totalRequests}`);
}

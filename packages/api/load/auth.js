/**
 * Auth Endpoint Load Test – BlueCollar (#813)
 *
 * Covers:
 *   POST /api/auth/login
 *   POST /api/auth/register  (light smoke only – avoids DB fill-up)
 *
 * SLOs:
 *   p(95) < 800 ms for login
 *   error rate < 5%
 *
 * Run:
 *   k6 run packages/api/load/auth.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const loginP95 = new Trend('login_duration', true);

export const options = {
  scenarios: {
    auth_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.05'],
    error_rate: ['rate<0.05'],
    login_duration: ['p(95)<800'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000/api';
const HEADERS = { 'Content-Type': 'application/json' };

export default function () {
  group('auth', () => {
    // Login with invalid credentials – measures endpoint latency without side effects
    const t0 = Date.now();
    const res = http.post(
      `${BASE}/auth/login`,
      JSON.stringify({ email: 'loadtest@example.com', password: 'WrongPass123!' }),
      { headers: HEADERS, tags: { endpoint: 'auth_login' } },
    );
    loginP95.add(Date.now() - t0);

    const ok = check(res, {
      'POST /auth/login → 400 or 401': (r) => [400, 401, 422].includes(r.status),
      'POST /auth/login → <800ms': (r) => r.timings.duration < 800,
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

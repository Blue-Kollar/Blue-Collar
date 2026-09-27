/**
 * Database Performance Load Test – BlueCollar
 * Closes #406
 *
 * Tests DB-heavy endpoints under concurrent load to surface
 * slow queries, connection pool exhaustion, and N+1 issues.
 *
 * Run: k6 run deploy/load-tests/db-performance-test.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const dbQueryDuration = new Trend('db_query_duration');
const dbErrorRate = new Rate('db_error_rate');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.02'],
    db_query_duration: ['p(95)<600'],
    db_error_rate: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export default function () {
  group('DB-heavy read operations', () => {
    // Paginated worker list (DB query with joins)
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/workers?page=1&limit=20`);
    dbQueryDuration.add(Date.now() - t0);

    const ok = check(res, {
      'paginated workers → 200': (r) => r.status === 200,
      'paginated workers → <500ms': (r) => r.timings.duration < 500,
      'paginated workers → has pagination': (r) => {
        try {
          const body = r.json();
          return body.data !== undefined && body.meta !== undefined;
        } catch { return false; }
      },
      'paginated workers → no N+1 (response time < 300ms)': (r) => r.timings.duration < 300,
    });
    dbErrorRate.add(!ok);

    sleep(0.3);

    // Category list (simple lookup)
    const catRes = http.get(`${BASE_URL}/categories`);
    check(catRes, {
      'categories → 200': (r) => r.status === 200,
      'categories → <100ms': (r) => r.timings.duration < 100,
    });

    sleep(0.3);

    // Search query with filters (full-text search + category filter)
    const searchRes = http.get(`${BASE_URL}/workers?search=plumber&limit=20`);
    check(searchRes, {
      'search → 200': (r) => r.status === 200,
      'search → <800ms': (r) => r.timings.duration < 800,
      'search → no N+1 (< 500ms)': (r) => r.timings.duration < 500,
    });

    sleep(0.3);

    // Rating-filtered search (triggers aggregation query)
    const ratingRes = http.get(`${BASE_URL}/workers?minRating=4`);
    check(ratingRes, {
      'rating filter → 200': (r) => r.status === 200,
      'rating filter → <800ms': (r) => r.timings.duration < 800,
    });

    sleep(0.3);

    // Paginated worker list with availability filter
    const availRes = http.get(`${BASE_URL}/workers?dayOfWeek=1&page=1&limit=10`);
    check(availRes, {
      'availability filter → 200': (r) => r.status === 200,
      'availability filter → <800ms': (r) => r.timings.duration < 800,
    });
  });

  sleep(1);
}

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
  scenarios: {
    // Original mixed DB-heavy workload (baseline coverage)
    db_heavy: {
      executor: 'ramping-vus',
      exec: 'dbHeavyScenario',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
    },
    // #1813: optimized worker list (joins + indexes, no N+1)
    worker_list: {
      executor: 'constant-vus',
      exec: 'workerListScenario',
      vus: 20,
      duration: '5m',
      startTime: '5m',
    },
    // #1813: optimized job list (indexed filters + pagination)
    job_list: {
      executor: 'constant-vus',
      exec: 'jobListScenario',
      vus: 20,
      duration: '5m',
      startTime: '5m',
    },
    // #1813: optimized reviews (aggregation + indexed lookups)
    reviews: {
      executor: 'constant-vus',
      exec: 'reviewsScenario',
      vus: 20,
      duration: '5m',
      startTime: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.02'],
    db_query_duration: ['p(95)<600'],
    db_error_rate: ['rate<0.02'],
    // #1813 optimized endpoint thresholds (post-index / post-N+1-fix)
    'http_req_duration{scenario:worker_list}': ['p(95)<300', 'p(99)<600'],
    'http_req_duration{scenario:job_list}': ['p(95)<300', 'p(99)<600'],
    'http_req_duration{scenario:reviews}': ['p(95)<250', 'p(99)<500'],
    'db_query_duration{scenario:worker_list}': ['p(95)<200'],
    'db_query_duration{scenario:job_list}': ['p(95)<200'],
    'db_query_duration{scenario:reviews}': ['p(95)<150'],
    'db_error_rate{scenario:worker_list}': ['rate<0.01'],
    'db_error_rate{scenario:job_list}': ['rate<0.01'],
    'db_error_rate{scenario:reviews}': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export function dbHeavyScenario() {
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
        } catch {
          return false;
        }
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

// #1813: Optimized worker list – asserts no N+1 and indexed query performance.
export function workerListScenario() {
  group('Optimized worker list', () => {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/workers?page=1&limit=20`);
    dbQueryDuration.add(Date.now() - t0);

    const ok = check(res, {
      'worker list → 200': (r) => r.status === 200,
      'worker list → <300ms (p95 target)': (r) => r.timings.duration < 300,
      'worker list → no N+1 (<200ms)': (r) => r.timings.duration < 200,
      'worker list → has pagination meta': (r) => {
        try {
          const body = r.json();
          return body.data !== undefined && body.meta !== undefined;
        } catch {
          return false;
        }
      },
    });
    dbErrorRate.add(!ok);

    sleep(0.2);

    // Indexed filter path (category + availability)
    const t1 = Date.now();
    const filtered = http.get(`${BASE_URL}/workers?category=1&dayOfWeek=1&page=1&limit=20`);
    dbQueryDuration.add(Date.now() - t1);
    check(filtered, {
      'worker list filtered → 200': (r) => r.status === 200,
      'worker list filtered → <300ms': (r) => r.timings.duration < 300,
    });
  });

  sleep(0.5);
}

// #1813: Optimized job list – indexed status/category filters + pagination.
export function jobListScenario() {
  group('Optimized job list', () => {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/jobs?page=1&limit=20`);
    dbQueryDuration.add(Date.now() - t0);

    const ok = check(res, {
      'job list → 200': (r) => r.status === 200,
      'job list → <300ms (p95 target)': (r) => r.timings.duration < 300,
      'job list → no N+1 (<200ms)': (r) => r.timings.duration < 200,
      'job list → has pagination meta': (r) => {
        try {
          const body = r.json();
          return body.data !== undefined && body.meta !== undefined;
        } catch {
          return false;
        }
      },
    });
    dbErrorRate.add(!ok);

    sleep(0.2);

    // Indexed status filter path
    const t1 = Date.now();
    const filtered = http.get(`${BASE_URL}/jobs?status=open&page=1&limit=20`);
    dbQueryDuration.add(Date.now() - t1);
    check(filtered, {
      'job list filtered → 200': (r) => r.status === 200,
      'job list filtered → <300ms': (r) => r.timings.duration < 300,
    });
  });

  sleep(0.5);
}

// #1813: Optimized reviews – aggregation + indexed lookups, no N+1.
export function reviewsScenario() {
  group('Optimized reviews', () => {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/reviews?page=1&limit=20`);
    dbQueryDuration.add(Date.now() - t0);

    const ok = check(res, {
      'reviews → 200': (r) => r.status === 200,
      'reviews → <250ms (p95 target)': (r) => r.timings.duration < 250,
      'reviews → no N+1 (<150ms)': (r) => r.timings.duration < 150,
      'reviews → has pagination meta': (r) => {
        try {
          const body = r.json();
          return body.data !== undefined && body.meta !== undefined;
        } catch {
          return false;
        }
      },
    });
    dbErrorRate.add(!ok);

    sleep(0.2);

    // Aggregation path (rating summary)
    const t1 = Date.now();
    const summary = http.get(`${BASE_URL}/reviews/summary?workerId=1`);
    dbQueryDuration.add(Date.now() - t1);
    check(summary, {
      'reviews summary → 200': (r) => r.status === 200,
      'reviews summary → <250ms': (r) => r.timings.duration < 250,
    });
  });

  sleep(0.5);
}

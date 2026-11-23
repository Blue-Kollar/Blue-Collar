/**
 * Worker CRUD Load Test – BlueCollar (#813)
 *
 * Tests curator-gated write paths under load:
 *   POST   /api/workers          (create)
 *   POST   /api/workers/:id  + X-HTTP-Method: PUT  (update)
 *   DELETE /api/workers/:id
 *
 * Requires a valid curator JWT via env:
 *   k6 run --env AUTH_TOKEN=<jwt> packages/api/load/workers.js
 *
 * SLOs:
 *   p(95) < 1 000 ms for writes
 *   error rate < 5%
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const createP95 = new Trend('create_worker_duration', true);
const deleteP95 = new Trend('delete_worker_duration', true);

export const options = {
  scenarios: {
    crud_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 20 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    error_rate: ['rate<0.05'],
    create_worker_duration: ['p(95)<1000'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000/api';
const TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  if (!TOKEN) {
    // Skip writes without a token; just read
    http.get(`${BASE}/workers`);
    sleep(1);
    return;
  }

  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

  group('worker_crud', () => {
    // Create
    const t0 = Date.now();
    const createRes = http.post(
      `${BASE}/workers`,
      JSON.stringify({
        name: `LoadTest Worker ${__VU}-${__ITER}`,
        category: 'plumber',
        location: 'Test City',
        bio: 'k6 load test worker – safe to delete',
      }),
      { headers: auth, tags: { endpoint: 'create_worker' } },
    );
    createP95.add(Date.now() - t0);

    const created = check(createRes, {
      'POST /workers → 201': (r) => r.status === 201,
    });
    errorRate.add(!created);

    if (createRes.status === 201) {
      let workerId;
      try {
        workerId = createRes.json('data.id') ?? createRes.json('id');
      } catch (_) {}

      if (workerId) {
        sleep(0.5);

        // Update
        http.post(
          `${BASE}/workers/${workerId}`,
          JSON.stringify({ bio: 'Updated by k6 load test' }),
          { headers: { ...auth, 'X-HTTP-Method': 'PUT' }, tags: { endpoint: 'update_worker' } },
        );

        sleep(0.5);

        // Delete
        const t1 = Date.now();
        const delRes = http.del(`${BASE}/workers/${workerId}`, null, {
          headers: auth,
          tags: { endpoint: 'delete_worker' },
        });
        deleteP95.add(Date.now() - t1);

        check(delRes, {
          'DELETE /workers/:id → 200 or 204': (r) => [200, 204].includes(r.status),
        });
      }
    }
  });

  sleep(1);
}

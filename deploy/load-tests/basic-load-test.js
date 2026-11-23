import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export default function () {
  // Test worker listing
  let res = http.get(`${BASE_URL}/workers`);
  check(res, {
    'GET /workers status is 200': (r) => r.status === 200,
    'GET /workers response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test category listing
  res = http.get(`${BASE_URL}/categories`);
  check(res, {
    'GET /categories status is 200': (r) => r.status === 200,
    'GET /categories response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}

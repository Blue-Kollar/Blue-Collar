import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 30 },
    { duration: '3m', target: 30 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';
const TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  };

  // Create worker
  const createRes = http.post(
    `${BASE_URL}/workers`,
    JSON.stringify({
      name: `Worker ${Math.random()}`,
      category: 'plumber',
      location: 'New York',
      bio: 'Experienced plumber',
    }),
    { headers },
  );

  check(createRes, {
    'Create worker status is 201': (r) => r.status === 201,
  });

  if (createRes.status === 201) {
    const workerId = createRes.json('id');

    sleep(1);

    // Get worker
    const getRes = http.get(`${BASE_URL}/workers/${workerId}`);
    check(getRes, {
      'Get worker status is 200': (r) => r.status === 200,
    });

    sleep(1);

    // Update worker
    const updateRes = http.post(
      `${BASE_URL}/workers/${workerId}`,
      JSON.stringify({
        bio: 'Updated bio',
      }),
      {
        headers: {
          ...headers,
          'X-HTTP-Method': 'PUT',
        },
      },
    );

    check(updateRes, {
      'Update worker status is 200': (r) => r.status === 200,
    });

    sleep(1);

    // Delete worker
    const deleteRes = http.del(`${BASE_URL}/workers/${workerId}`, { headers });
    check(deleteRes, {
      'Delete worker status is 204': (r) => r.status === 204,
    });
  }

  sleep(2);
}

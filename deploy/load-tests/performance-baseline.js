import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const baseUrl = 'http://localhost:3000';

  // Test worker list endpoint
  const listRes = http.get(`${baseUrl}/api/workers`);
  check(listRes, {
    'worker list 200': (r) => r.status === 200,
    'worker list p95 < 500ms': (r) => r.timings.duration < 500,
  });

  // Test worker detail endpoint
  const detailRes = http.get(`${baseUrl}/api/workers/1`);
  check(detailRes, {
    'worker detail 200': (r) => r.status === 200,
  });

  // Test health endpoint
  const healthRes = http.get(`${baseUrl}/health`);
  check(healthRes, {
    'health check 200': (r) => r.status === 200,
  });

  sleep(1);
}

export function handleSummary(data) {
  const metrics = {
    p95: data.metrics.http_req_duration.values['p(95)'],
    p99: data.metrics.http_req_duration.values['p(99)'],
    rps: data.metrics.http_reqs.value / 30,
  };

  const fs = require('fs');
  fs.writeFileSync('perf-metrics.json', JSON.stringify(metrics));

  return {};
}

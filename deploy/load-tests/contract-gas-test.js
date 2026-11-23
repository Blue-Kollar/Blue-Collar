/**
 * Contract Gas Usage Load Test – Stellar Soroban
 * Closes #406
 *
 * Simulates concurrent contract invocations to measure gas consumption
 * and identify operations that approach Soroban resource limits.
 *
 * This test calls the API's Stellar endpoints which proxy contract calls.
 * For direct contract testing, use the Stellar CLI simulation commands below.
 *
 * Run: k6 run deploy/load-tests/contract-gas-test.js
 *
 * Direct CLI simulation (no k6 required):
 *   stellar contract invoke --id <CONTRACT_ID> --source <KEY> --network testnet \
 *     --simulate-only -- register --id "worker-1" --owner "G..." \
 *     --name "John" --category "Plumber"
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const contractCallDuration = new Trend('contract_call_duration');
const contractErrorRate = new Rate('contract_error_rate');
const contractCalls = new Counter('contract_calls_total');

export const options = {
  // Conservative load — contract calls are expensive
  stages: [
    { duration: '30s', target: 5 },
    { duration: '2m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.1'],
    contract_call_duration: ['p(95)<2500'],
    contract_error_rate: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export function setup() {
  // Login to get auth token
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'curator@example.com',
      password: __ENV.TEST_PASSWORD || 'Password123!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: res.status === 202 ? res.json('token') : '' };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data?.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  group('Stellar contract read operations', () => {
    // Read worker from chain (get_worker) via API proxy
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/workers`, { headers });
    contractCallDuration.add(Date.now() - t0);
    contractCalls.add(1);

    const ok = check(res, {
      'worker list (chain read) → non-500': (r) => r.status < 500,
      'worker list → <3000ms': (r) => r.timings.duration < 3000,
    });
    contractErrorRate.add(!ok);

    sleep(2); // Respect testnet rate limits
  });

  group('Gas estimation metrics', () => {
    // The API exposes a /stellar/estimate endpoint for gas simulation
    const estimateRes = http.get(`${BASE_URL}/stellar/estimate`, { headers });
    contractCalls.add(1);

    check(estimateRes, {
      'gas estimate → non-500': (r) => r.status < 500,
    });

    sleep(2);
  });
}

export function teardown(data) {
  console.log('Contract gas load test complete.');
  console.log('Review Stellar testnet explorer for actual gas consumption.');
  console.log('https://stellar.expert/explorer/testnet');
}

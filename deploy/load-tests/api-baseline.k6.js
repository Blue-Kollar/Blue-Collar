import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const API_ROOT = BASE_URL.replace(/\/api(?:\/v\d+)?$/, '');
const HEALTH_URL = __ENV.HEALTH_URL || `${API_ROOT}/health`;
const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@example.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Password123!';
const JOBS_QUERY = __ENV.JOBS_QUERY || '';
const THINK_TIME = Number(__ENV.THINK_TIME ?? 1);
const SUMMARY_JSON = __ENV.SUMMARY_JSON === undefined
  ? 'results/api-baseline.json'
  : __ENV.SUMMARY_JSON;
const SCENARIO = __ENV.SCENARIO || 'load';

function intEnv(name, fallback) {
  const value = Number.parseInt(__ENV[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const PEAK_VUS = intEnv('PEAK_VUS', 50);
const STRESS_VUS = intEnv('STRESS_VUS', 150);

const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: intEnv('SMOKE_VUS', 1),
    duration: __ENV.SMOKE_DURATION || '1m',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: __ENV.WARMUP_DURATION || '1m', target: intEnv('WARMUP_VUS', 10) },
      { duration: __ENV.RAMP_UP_DURATION || '3m', target: PEAK_VUS },
      { duration: __ENV.HOLD_DURATION || '5m', target: PEAK_VUS },
      { duration: __ENV.RAMP_DOWN_DURATION || '1m', target: 0 },
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: __ENV.WARMUP_DURATION || '1m', target: intEnv('WARMUP_VUS', 10) },
      { duration: __ENV.RAMP_UP_DURATION || '3m', target: PEAK_VUS },
      { duration: '3m', target: STRESS_VUS },
      { duration: '5m', target: STRESS_VUS },
      { duration: __ENV.RAMP_DOWN_DURATION || '1m', target: 0 },
    ],
  },
  soak: {
    executor: 'constant-vus',
    vus: intEnv('SOAK_VUS', 20),
    duration: __ENV.SOAK_DURATION || '30m',
  },
};

const THRESHOLDS = {
  'http_req_duration': ['p(95)<500', 'p(99)<1500'],
  'http_req_failed': ['rate<0.05'],
  'api_error_rate': ['rate<0.05'],
  'health_duration': ['p(95)<200', 'p(99)<500'],
  'auth_duration': ['p(95)<600', 'p(99)<1500'],
  'jobs_list_duration': ['p(95)<500', 'p(99)<1500'],
  'jobs_detail_duration': ['p(95)<400', 'p(99)<1200'],
};

const activeScenario = SCENARIO in SCENARIOS ? SCENARIO : 'load';

export const options = {
  scenarios: { [activeScenario]: SCENARIOS[activeScenario] },
  thresholds: THRESHOLDS,
};

const apiErrorRate = new Rate('api_error_rate');
const healthDuration = new Trend('health_duration', true);
const authDuration = new Trend('auth_duration', true);
const jobsListDuration = new Trend('jobs_list_duration', true);
const jobsDetailDuration = new Trend('jobs_detail_duration', true);
const totalRequests = new Counter('api_requests_total');

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth_login_setup' },
      timeout: '10s',
    }
  );
  let token = '';
  try {
    token = res.json('token') || '';
  } catch (_) {
    token = '';
  }
  check(res, {
    'setup login → 200/202': (r) => [200, 202].includes(r.status),
    'setup login → token present': () => !!token,
  });
  if (!token) {
    console.warn('No auth token: using unauthenticated flow (auth/me expects 401, /jobs/me/posted skipped).');
  }
  return { token };
}

export default function (data) {
  const token = data?.token || '';
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  let iterationOk = true;

  group('health', () => {
    const res = http.get(HEALTH_URL, {
      tags: { endpoint: 'health' },
      timeout: '10s',
    });
    healthDuration.add(res.timings.duration);
    totalRequests.add(1);
    iterationOk = check(res, {
      'health → 200': (r) => r.status === 200,
    }) && iterationOk;
  });

  sleep(THINK_TIME);

  group('auth', () => {
    const res = http.get(`${BASE_URL}/auth/me`, {
      headers: authHeaders,
      tags: { endpoint: 'auth_me' },
      timeout: '10s',
    });
    authDuration.add(res.timings.duration);
    totalRequests.add(1);
    iterationOk = check(res, {
      [token ? 'auth/me → 200 with token' : 'auth/me → 401 without token']:
        (r) => token ? r.status === 200 : [401, 403].includes(r.status),
      'auth/me → not 5xx': (r) => r.status < 500,
    }) && iterationOk;
  });

  sleep(THINK_TIME);

  group('jobs', () => {
    const listRes = http.get(`${BASE_URL}/jobs${JOBS_QUERY}`, {
      tags: { endpoint: 'jobs_list' },
      timeout: '10s',
    });
    jobsListDuration.add(listRes.timings.duration);
    totalRequests.add(1);
    iterationOk = check(listRes, {
      'jobs list → 200': (r) => r.status === 200,
    }) && iterationOk;

    let jobId = null;
    try {
      const body = listRes.json();
      const rows = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body?.data?.jobs)
            ? body.data.jobs
            : [];
      jobId = rows.find((job) => job && job.id != null)?.id ?? null;
    } catch (_) {
      jobId = null;
    }

    if (jobId !== null) {
      const detailRes = http.get(`${BASE_URL}/jobs/${encodeURIComponent(String(jobId))}`, {
        tags: { endpoint: 'jobs_detail' },
        timeout: '10s',
      });
      jobsDetailDuration.add(detailRes.timings.duration);
      totalRequests.add(1);
      iterationOk = check(detailRes, {
        'jobs detail → 200': (r) => r.status === 200,
      }) && iterationOk;
    }

    if (token) {
      const mineRes = http.get(`${BASE_URL}/jobs/me/posted`, {
        headers: authHeaders,
        tags: { endpoint: 'jobs_mine' },
        timeout: '10s',
      });
      totalRequests.add(1);
      iterationOk = check(mineRes, {
        'jobs mine → 200': (r) => r.status === 200,
      }) && iterationOk;
    }
  });

  apiErrorRate.add(!iterationOk);
  sleep(THINK_TIME);
}

export function teardown(data) {
  if (data?.token) {
    http.del(
      `${BASE_URL}/auth/logout`,
      null,
      {
        headers: { Authorization: `Bearer ${data.token}` },
        tags: { endpoint: 'auth_logout' },
      }
    );
  }
}

export function handleSummary(data) {
  const metricValue = (name, key) => data.metrics[name]?.values?.[key] ?? null;
  const summary = {
    scenario: activeScenario,
    capturedAt: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      healthUrl: HEALTH_URL,
      jobsQuery: JOBS_QUERY,
      peakVus: PEAK_VUS,
      stressVus: STRESS_VUS,
      thinkTime: THINK_TIME,
      authenticated: data.metrics.api_error_rate !== undefined,
    },
    baseline: {
      http_req_duration_p95: metricValue('http_req_duration', 'p(95)'),
      http_req_duration_p99: metricValue('http_req_duration', 'p(99)'),
      http_req_failed_rate: metricValue('http_req_failed', 'rate'),
      api_error_rate: metricValue('api_error_rate', 'rate'),
      health_duration_p95: metricValue('health_duration', 'p(95)'),
      health_duration_p99: metricValue('health_duration', 'p(99)'),
      auth_duration_p95: metricValue('auth_duration', 'p(95)'),
      auth_duration_p99: metricValue('auth_duration', 'p(99)'),
      jobs_list_duration_p95: metricValue('jobs_list_duration', 'p(95)'),
      jobs_list_duration_p99: metricValue('jobs_list_duration', 'p(99)'),
      jobs_detail_duration_p95: metricValue('jobs_detail_duration', 'p(95)'),
      jobs_detail_duration_p99: metricValue('jobs_detail_duration', 'p(99)'),
      rps: metricValue('http_reqs', 'rate'),
      requests: metricValue('http_reqs', 'count'),
      iterations: metricValue('iterations', 'count'),
      api_requests_total: metricValue('api_requests_total', 'count'),
    },
    thresholds: {
      passed: Object.entries(data.metrics)
        .filter(([, v]) => v.thresholds && Object.values(v.thresholds).every((t) => t.ok))
        .map(([k]) => k),
      failed: Object.entries(data.metrics)
        .filter(([, v]) => v.thresholds && Object.values(v.thresholds).some((t) => !t.ok))
        .map(([k]) => k),
    },
  };

  const output = { stdout: buildTextSummary(summary) };
  if (SUMMARY_JSON && SUMMARY_JSON !== 'none') {
    output[SUMMARY_JSON] = JSON.stringify(summary, null, 2);
  }
  return output;
}

function buildTextSummary(s) {
  const ms = (v) => (v == null ? 'n/a' : `${Math.round(v)}ms`);
  const pct = (v) => (v == null ? 'n/a' : `${(v * 100).toFixed(2)}%`);
  const b = s.baseline;
  const width = 60;
  const row = (content) => `║ ${String(content).slice(0, width).padEnd(width)} ║`;
  const divider = (left, right) => `${left}${'═'.repeat(62)}${right}`;
  return [
    divider('╔', '╗'),
    row('BlueCollar - API Performance Baseline (#1877)'),
    divider('╠', '╣'),
    row(`Scenario:  ${s.scenario}`),
    row(`Captured:  ${s.capturedAt}`),
    row(`Target:    ${s.config.baseUrl}`),
    divider('╠', '╣'),
    row(`HTTP all         p95: ${ms(b.http_req_duration_p95)}`),
    row(`HTTP all         p99: ${ms(b.http_req_duration_p99)}`),
    row(`health           p95: ${ms(b.health_duration_p95)}`),
    row(`health           p99: ${ms(b.health_duration_p99)}`),
    row(`auth             p95: ${ms(b.auth_duration_p95)}`),
    row(`auth             p99: ${ms(b.auth_duration_p99)}`),
    row(`jobs list        p95: ${ms(b.jobs_list_duration_p95)}`),
    row(`jobs list        p99: ${ms(b.jobs_list_duration_p99)}`),
    row(`jobs detail      p95: ${ms(b.jobs_detail_duration_p95)}`),
    row(`jobs detail      p99: ${ms(b.jobs_detail_duration_p99)}`),
    row(`HTTP failed rate:      ${pct(b.http_req_failed_rate)}`),
    row(`API error rate:        ${pct(b.api_error_rate)}`),
    row(`Throughput:            ${Math.round(b.rps ?? 0)} rps`),
    row(`Requests / iterations: ${b.requests ?? 0} / ${b.iterations ?? 0}`),
    divider('╠', '╣'),
    row(`Thresholds FAILED: ${s.thresholds.failed.join(', ') || 'none'}`),
    divider('╚', '╝'),
    '',
  ].join('\n');
}

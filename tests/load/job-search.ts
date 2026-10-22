/**
 * Load test for the job search/listing endpoint (#1491).
 *
 * Usage:
 *   API_URL=http://localhost:8080 \
 *   SEARCH_PATH=/api/jobs?q=plumbing&city=Lagos \
 *   CONNECTIONS=50 DURATION=30 \
 *   npx tsx tests/load/job-search.ts
 */
import autocannon from 'autocannon';

const API_URL = process.env.API_URL ?? 'http://localhost:8080';
const SEARCH_PATH = process.env.SEARCH_PATH ?? '/api/jobs?q=plumbing';
const CONNECTIONS = parseInt(process.env.CONNECTIONS ?? '50', 10);
const DURATION = parseInt(process.env.DURATION ?? '30', 10);

const SLA = {
  p50: 50,   // ms
  p95: 200,  // ms
  p99: 500,  // ms
};

async function main() {
  const url = `${API_URL}${SEARCH_PATH}`;
  console.log(`Running load test`);
  console.log(`  URL:         ${url}`);
  console.log(`  Connections: ${CONNECTIONS}`);
  console.log(`  Duration:    ${DURATION}s`);
  console.log('');

  const result = await autocannon({
    url,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { 'Accept': 'application/json' },
  });

  const summary = {
    p50: result.latency.p50,
    p95: result.latency.p97_5 ?? result.latency.p95,
    p99: result.latency.p99,
    rps: Math.round(result.requests.average),
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
  };

  console.log('=== RESULTS ===');
  console.log(`Requests/sec:  ${summary.rps}`);
  console.log(`Latency p50:   ${summary.p50} ms   (SLA ${SLA.p50} ms)   ${summary.p50 <= SLA.p50 ? 'PASS' : 'FAIL'}`);
  console.log(`Latency p95:   ${summary.p95} ms   (SLA ${SLA.p95} ms)   ${summary.p95 <= SLA.p95 ? 'PASS' : 'FAIL'}`);
  console.log(`Latency p99:   ${summary.p99} ms   (SLA ${SLA.p99} ms)   ${summary.p99 <= SLA.p99 ? 'PASS' : 'FAIL'}`);
  console.log(`Errors:        ${summary.errors}`);
  console.log(`Timeouts:      ${summary.timeouts}`);
  console.log(`Non-2xx:       ${summary.non2xx}`);

  const fails = [];
  if (summary.p50 > SLA.p50) fails.push(`p50 ${summary.p50}ms > ${SLA.p50}ms`);
  if (summary.p95 > SLA.p95) fails.push(`p95 ${summary.p95}ms > ${SLA.p95}ms`);
  if (summary.p99 > SLA.p99) fails.push(`p99 ${summary.p99}ms > ${SLA.p99}ms`);

  if (fails.length > 0) {
    console.log('');
    console.log('SLA violations:');
    fails.forEach((f) => console.log('  - ' + f));
    console.log('');
    console.log('Open a follow-up issue per violation with the recorded numbers.');
    process.exit(1);
  }

  console.log('');
  console.log('All SLA checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

# Load Testing

Performance tests live in `tests/load/`. They are **not** part of the normal
test suite — run them manually against a seeded database.

## SLA

| Metric | Target | Notes |
|--------|--------|-------|
| p50    | ≤ 50 ms | median response |
| p95    | ≤ 200 ms | tail latency |
| p99    | ≤ 500 ms | worst-case expected |

Endpoints failing these targets get a follow-up issue with the recorded
numbers attached.

## Quick start

1. **Seed the database** with a realistic volume:
   ```bash
   DATABASE_URL=postgres://... SEED_ROWS=100000 npm run seed:jobs
API_URL=http://localhost:8080 \
SEARCH_PATH='/api/jobs?q=plumbing&city=Lagos' \
CONNECTIONS=50 \
DURATION=30 \
npm run test:load:jobs

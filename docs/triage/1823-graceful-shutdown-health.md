# Triage: graceful shutdown and health checks (#1823)

## Checked

- `src/app.ts` exposes `/healthz` (liveness), `/health` (legacy liveness) and `/readyz` (readiness).
- `src/index.ts` registers `createGracefulShutdownHandler` on both `SIGTERM` and `SIGINT`.
- `src/utils/shutdown.ts` waits for in-flight requests with a drain timeout, stops background jobs, and disconnects the database and Redis.

## Not verified

- Whether `/readyz` returns 503 once shutdown starts. This needs a test that sends a request during the drain.

## Not changed

No code change was made, because the behaviour the issue asks for is present. The open question above is the next step.

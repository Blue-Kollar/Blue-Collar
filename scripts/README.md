# scripts/

Utility scripts for local development, CI, and ops. Each entry below is
still referenced by a workflow or actively used by contributors; anything
that isn't has been removed (see "Removed" below).

| Script | Purpose | Usage |
|---|---|---|
| `check-openapi-fresh.sh` | Fails if `packages/api/openapi.json` is stale relative to the OpenAPI source definitions. Run in CI / pre-commit. | `./scripts/check-openapi-fresh.sh` |
| `verify-setup.sh` | Local dev environment smoke test: checks required tools, `/health` and `/ready`, and a public API endpoint. | `bash scripts/verify-setup.sh` |
| `start-monitoring.sh` | Brings up the local monitoring stack (Prometheus/Grafana/etc.) defined under `deploy/`. | `bash scripts/start-monitoring.sh` |
| `check-coverage.sh` | Runs the Soroban token contract test suite (`contracts/token`) with coverage features enabled. | `bash scripts/check-coverage.sh` |
| `audit-entrypoints.sh` | Scans `packages/contracts/contracts/*` for missing reentrancy/authorization checks on public entrypoints. | `bash scripts/audit-entrypoints.sh` |
| `analyze-dead-code.sh` | Generic static dead-code scan for a given path (defaults to `.`). | `bash scripts/analyze-dead-code.sh [path]` |

## Removed

The following one-off scripts were removed as part of a cleanup pass — they
were near-duplicate audits generated for individual, already-completed
module cleanup tickets and pointed at paths (`./packages/module-121` etc.)
that never existed in this repository:

- `audit-module-121.sh`
- `audit-module-122.sh`
- `audit-module-123.sh`
- `audit-module-124.sh`

No CI workflow, `package.json` script, or doc referenced them (verified via
repo-wide grep before removal), so no other changes were required.

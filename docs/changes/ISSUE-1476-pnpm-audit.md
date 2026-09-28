# Issue #1476 — pnpm audit: dependency vulnerability remediation

## Summary

Ran `pnpm audit --audit-level=high` across the monorepo, upgraded direct
dependencies with high/critical findings, added pnpm overrides for deeply
transitive packages, and documented accepted-risk exceptions for vulnerabilities
blocked on upstream releases.

---

## Audit results (before remediation)

```
Before: 5 critical | 57 high | 45 moderate | 7 low (114 total)
```

---

## Direct dependency upgrades

The following direct dependencies were upgraded to eliminate critical and high
findings:

| Package | Package file | Old → New | Severity | Advisory |
|---|---|---|---|---|
| `next` | `packages/app/package.json` | `^14.2.0` → `^15.5.24` | Critical | GHSA-p293-qw3h-jr36 |
| `vitest` | All packages | `^1.4.0` → `^3.2.6` | Critical | GHSA-5xrq-8626-4rwp |
| `nodemailer` | `packages/api` | `^6.9.9` → `^9.1.0` | High | GHSA-2x7j-588g-ccc2 |
| `sharp` | `packages/api` | `^0.34.5` → `^0.35.4` | High | GHSA-rgj7-g3m4-5g8c |
| `@opentelemetry/auto-instrumentations-node` | `packages/api` | `^0.40.0` → `^0.75.0` | High | Multiple OTEL advisories |
| `@opentelemetry/sdk-node` | `packages/api` | `^0.45.0` → `^0.217.0` | High | Prometheus exporter crash |
| `@faker-js/faker` | `packages/api` | `^9.0.0` → `^10.5.0` | High | GHSA in faker<10.5.0 |
| `eslint-config-next` | `packages/app` | `14.2.35` → `15.5.24` | High | GHSA-5j98-mcp5-4vw2 |

## pnpm overrides for transitive packages

Added to root `package.json` under `"pnpm": { "overrides": … }` to force
safe versions of packages that cannot be upgraded via direct dependency pins:

```json
"pnpm": {
  "overrides": {
    "tar": ">=7.5.19",
    "vite": ">=6.4.3",
    "protobufjs": ">=8.0.2"
  }
}
```

---

## Audit results (after remediation)

```
After:  0 critical | 28 high | 25 moderate | 4 low (57 total)
```

All remaining high findings are **transitive** — they exist inside the
dependency trees of `@storybook/nextjs`, `prisma`, `@stellar/stellar-sdk`,
`expo`/`jest-expo`, and `@stryker-mutator/core`. These cannot be resolved by
upgrading direct dependencies.

---

## Accepted-risk exceptions

Full documentation for each accepted exception, including risk assessment,
justification, and next review date, is in
[`docs/SECURITY_AUDIT_EXCEPTIONS.md`](../SECURITY_AUDIT_EXCEPTIONS.md).

| Package | Path | Justification summary | Review date |
|---|---|---|---|
| `@xmldom/xmldom` | `mobile > jest-expo` | Dev-only test runner, no production exposure | 2027-01-31 |
| `turbo-stream` | `mobile > expo-router` | Client-side mobile routing only, server runtime path unused | 2027-01-31 |
| `tmp` | `api > @stryker-mutator/core` | Dev-only mutation test tool, requires local filesystem access | 2027-01-31 |
| `@opentelemetry/propagator-jaeger` | `api > @opentelemetry/sdk-node` | Observability sidecar path only, not business logic | 2027-01-31 |
| `sharp` | `app > @storybook/nextjs` | Dev-only Storybook tooling, not production | 2027-01-31 |
| `postcss` | `app > next`, `mobile > expo` | Build toolchain only, no runtime exposure | 2027-01-31 |
| `deepmerge-ts` / `mysql2` | `api > prisma` | mysql2 is unused at runtime (PostgreSQL only); deepmerge-ts processes internal config | 2027-01-31 |
| `toml` | `app > @stellar/stellar-sdk` | Parses TOML from trusted Stellar anchors only | 2027-01-31 |
| `image-size` | `app > @storybook/nextjs` | Dev-only Storybook tooling, local machine only | 2027-01-31 |

---

## How to re-run the audit

```bash
# From monorepo root
pnpm audit --audit-level=high

# For a JSON report
pnpm audit --audit-level=high --json > audit-report.json
```

Expected result after this fix is applied:

```
0 critical | 28 high (all transitive, see SECURITY_AUDIT_EXCEPTIONS.md)
```

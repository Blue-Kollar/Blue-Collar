# Security Audit Exceptions

> **Issue**: #1476 — [Code Quality] Run npm audit/pnpm audit and remediate high/critical vulnerabilities
> **Audit tool**: `pnpm audit --audit-level=high`
> **Last run**: 2026-09-26
> **Reviewed by**: Blue-Collar Security Team

---

## Summary

After upgrading direct dependencies (see [Remediated section](#remediated)), no **critical**
vulnerabilities remain in the monorepo. The **high** vulnerabilities listed below are all
transitive — they exist inside the dependency tree of third-party tools
(`@storybook/nextjs`, `prisma`, `@stellar/stellar-sdk`, `expo`, `jest-expo`,
`@stryker-mutator/core`) whose upgrade timelines are controlled by upstream maintainers.

Accepted exceptions are documented here with risk assessment, justification, and a
scheduled review date of **2027-01-31** (or whenever the upstream package releases a fix).

---

## Remediated (Issue #1476)

The following vulnerabilities were fixed by upgrading direct dependencies:

| Package | Old version | New version | Severity | Advisory |
|---------|-------------|-------------|----------|----------|
| `next` | `^14.2.0` | `^15.5.24` | **Critical** | GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4 |
| `vitest` (all packages) | `^1.4.0` | `^3.2.6` | **Critical** | GHSA-5xrq-8626-4rwp |
| `nodemailer` | `^6.9.9` | `^9.1.0` | **High** | GHSA-2x7j-588g-ccc2 |
| `sharp` | `^0.34.5` | `^0.35.4` | **High** | GHSA-rgj7-g3m4-5g8c |
| `@opentelemetry/auto-instrumentations-node` | `^0.40.0` | `^0.75.0` | **High** | Multiple OTEL advisories |
| `@opentelemetry/sdk-node` | `^0.45.0` | `^0.217.0` | **High** | Prometheus exporter crash |
| `@faker-js/faker` | `^9.0.0 / ^10.2.0` | `^10.5.0` | **High** | GHSA in faker<10.5.0 |
| `eslint-config-next` | `14.2.35` | `15.5.24` | **High** (transitive glob) | GHSA-5j98-mcp5-4vw2 |

**pnpm overrides** were added in the root `package.json` to force safe versions of
deeply transitive packages that cannot be upgraded through direct dependency pins:

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

## Accepted-Risk Exceptions

### 1. `@xmldom/xmldom` — via `packages/mobile > jest-expo`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Advisory** | GHSA-xmldom (multiple — XML injection, uncontrolled recursion) |
| **Vulnerable version** | `<0.8.15` |
| **Fixed in** | `>=0.8.15` |
| **Path** | `packages/mobile > jest-expo > @expo/config > @expo/config-plugins > @expo/plist > @xmldom/xmldom` |
| **Justification** | `jest-expo` is a **dev-only** test runner dependency. It is never bundled into the mobile application binary and is not present in any production runtime. The XML injection surface requires an attacker to control XML input to a test-only code path, which has no production exposure. |
| **Risk level** | Low (dev-only, no production exposure) |
| **Blocked by** | Upstream `jest-expo` / `@expo/config-plugins` releasing a version that depends on `@xmldom/xmldom >= 0.8.15` |
| **Review date** | 2027-01-31 |

---

### 2. `turbo-stream` — via `packages/mobile > expo-router`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Advisory** | DoS via React Router |
| **Vulnerable version** | `<3.0.0` |
| **Fixed in** | `>=3.0.0` |
| **Path** | `packages/mobile > expo-router > @expo/server > @remix-run/node > turbo-stream` |
| **Justification** | `expo-router` is a mobile-app routing dependency. The DoS surface is in `@remix-run/server-runtime` (a server-side runtime); the mobile app uses `expo-router` only for client-side navigation. There is no server-side Remix runtime exposure in the BlueCollar mobile bundle. |
| **Risk level** | Low (client-side only in mobile context) |
| **Blocked by** | Upstream `expo-router` upgrading its `@remix-run` dependency |
| **Review date** | 2027-01-31 |

---

### 3. `tmp` — via `packages/api > @stryker-mutator/core`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Advisory** | GHSA-52f5-9888-hmc6 — arbitrary temp file/dir write via symlink |
| **Vulnerable version** | `<0.2.6` |
| **Fixed in** | `>=0.2.6` |
| **Path** | `packages/api > @stryker-mutator/core > @inquirer/prompts > @inquirer/editor > external-editor > tmp` |
| **Justification** | `@stryker-mutator/core` is a **dev-only** mutation-testing tool. It is never present in the production API bundle. Exploitation requires local filesystem access to place a symlink in the system temp directory before the tool runs — this attack surface does not exist in CI or production environments with controlled temp directories. |
| **Risk level** | Low (dev-only, requires local filesystem access to exploit) |
| **Blocked by** | Upstream `@inquirer/editor` / `external-editor` dependency upgrading `tmp` |
| **Review date** | 2027-01-31 |

---

### 4. `@opentelemetry/propagator-jaeger` — via `packages/api > @opentelemetry/sdk-node`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Advisory** | Upgrade to version 2.9.0 or later |
| **Path** | `packages/api > @opentelemetry/sdk-node > @opentelemetry/sdk-trace-node > @opentelemetry/propagator-jaeger` |
| **Justification** | The Jaeger propagator is a trace-context header parser. The vulnerability affects header parsing on the observability data path (not business logic or auth). Exploitation requires an attacker to inject malformed trace headers into requests reaching the API. The API is behind authentication and TLS; malformed trace headers are logged and discarded without impacting application state. |
| **Risk level** | Low-Medium (observability sidecar path only; requires authenticated/proxied request manipulation) |
| **Blocked by** | Upstream `@opentelemetry/sdk-node` bumping its `@opentelemetry/propagator-jaeger` dependency to `>=2.9.0` |
| **Review date** | 2027-01-31 |

---

### 5. `sharp` — via `packages/app > @storybook/nextjs`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Advisory** | GHSA-rgj7-g3m4-5g8c |
| **Vulnerable version** | `<0.35.4` |
| **Fixed in** | `>=0.35.4` |
| **Path** | `packages/app > @storybook/nextjs > sharp` |
| **Justification** | `@storybook/nextjs` is a **dev-only** Storybook adapter and never runs in production. The `sharp` instance used here processes story component screenshots locally; it is not exposed to untrusted input. The direct `sharp` dependency in `packages/api` has already been upgraded to `^0.35.4`. |
| **Risk level** | Low (dev-only Storybook tooling, local machine only) |
| **Blocked by** | Upstream `@storybook/nextjs` upgrading its bundled `sharp` dependency |
| **Review date** | 2027-01-31 |

---

### 6. `postcss` — via `packages/app > next` and `packages/mobile > expo`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Advisory** | Upgrade to version 8.5.18 or later |
| **Path** | `packages/app > next > postcss`, `packages/mobile > expo > @expo/metro-config > postcss` |
| **Justification** | `next@^15.5.24` and `expo` bundle an older `postcss` version. The PostCSS vulnerability requires an attacker to control the CSS input processed by the build toolchain — this only occurs during local development builds or CI. No user-controlled PostCSS processing happens at runtime in the deployed API or app. |
| **Risk level** | Low (build toolchain only; no runtime exposure) |
| **Blocked by** | Upstream `next` and `expo` upgrading their bundled `postcss` |
| **Review date** | 2027-01-31 |

---

### 7. `deepmerge-ts` and `mysql2` — via `packages/api > prisma`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Advisory** | `deepmerge-ts` — upgrade to 8.0.0+; `mysql2` — upgrade to 3.22.0+ |
| **Path** | `packages/api > prisma > deepmerge-ts / mysql2` |
| **Justification** | The BlueCollar API uses **PostgreSQL** exclusively — `mysql2` is a transitive dev-time dependency pulled in by Prisma's multi-adapter build but is never instantiated at runtime. `deepmerge-ts` is used by `@prisma/config` for internal Prisma configuration merging, not for user-controlled input. Neither package processes untrusted user data. |
| **Risk level** | Low (`mysql2` is unused at runtime; `deepmerge-ts` processes internal config only) |
| **Blocked by** | Upstream `prisma` upgrading its internal dependency versions |
| **Review date** | 2027-01-31 |

---

### 8. `toml` — via `packages/app > @stellar/stellar-sdk`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Advisory** | Upgrade to version 4.2.0 or later |
| **Path** | `packages/app > @stellar/stellar-sdk > toml` |
| **Justification** | The `toml` package is used by `@stellar/stellar-sdk` for parsing Stellar TOML files (`.well-known/stellar.toml`). These are fetched from known Stellar anchor domains over HTTPS. The vulnerability is a parsing DoS; an attacker would need to control a Stellar anchor's TOML file to trigger it. BlueCollar only fetches TOML from trusted Stellar-registered anchors. |
| **Risk level** | Low-Medium (requires compromised Stellar anchor TOML) |
| **Blocked by** | Upstream `@stellar/stellar-sdk` upgrading its `toml` dependency to `>=4.2.0` |
| **Review date** | 2027-01-31 |

---

### 9. `image-size` — via `packages/app > @storybook/nextjs`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Advisory** | GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr — DoS via infinite loops in JXL/HEIF/ICNS parsers |
| **Vulnerable version** | `<=2.0.2` |
| **Fixed in** | `>=2.0.3` |
| **Path** | `packages/app > @storybook/nextjs > image-size` |
| **Justification** | `@storybook/nextjs` is **dev-only** Storybook tooling. Image processing via `image-size` occurs only during local story rendering and CI snapshot builds, never in production. No user-controlled images are passed through this code path. |
| **Risk level** | Low (dev-only, no production exposure) |
| **Blocked by** | Upstream `@storybook/nextjs` upgrading its `image-size` dependency |
| **Review date** | 2027-01-31 |

---

## Post-Remediation Audit Status

```
Before:  5 critical | 57 high | 45 moderate | 7 low  (114 total)
After:   0 critical | 28 high | 25 moderate | 4 low  (57 total)
```

All 28 remaining high findings are transitive dependencies of third-party tools.
All have been triaged above. **No critical vulnerabilities remain.**

Next scheduled review: **2027-01-31**

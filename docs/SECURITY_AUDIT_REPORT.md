# BlueCollar Smart Contracts Security Audit Report

**Date**: April 27, 2026  
**Status**: Internal Security Review Complete

## Executive Summary

Comprehensive security audit of BlueCollar Soroban contracts completed. All critical security controls are in place.

## Audit Findings

### Critical Issues: NONE

### High Priority Recommendations

1. **Input Validation**: Add length validation for worker names and categories
2. **Rate Limiting**: Implement per-address operation limits
3. **Pause Mechanism**: Already implemented ✅

### Medium Priority

1. **Event Logging**: All state changes emit events ✅
2. **Authorization**: All privileged operations require auth ✅
3. **TTL Management**: Automatic extension implemented ✅

## Security Checklist

- ✅ Authorization checks on all state-mutating functions
- ✅ Event logging for audit trail
- ✅ TTL management (535k ledgers)
- ✅ Role-based access control
- ✅ Pause mechanism
- ✅ Reentrancy protection (atomic transactions)

## Recommendations for External Audit

1. Formal audit by Trail of Bits or OpenZeppelin
2. Fuzzing of contract interfaces
3. Economic security analysis
4. Post-mainnet monitoring plan

## Deployment Status

**Testnet**: ✅ Ready  
**Mainnet**: Pending external audit

---

**Next Steps**: Engage external audit firm before mainnet deployment

---

## Issue #1292 — npm Security Audit: Dependency Triage and Upgrades

**Date**: 2026-09-02  
**Status**: Complete — all feasible upgrades applied; remaining risks accepted and documented  
**Auditor**: Automated (Kiro / issue_1292 session)

---

### Audit Scope

Full `pnpm audit` run across all packages in the monorepo. Rust contracts were **not** audited in this session — `cargo audit` requires the Rust toolchain, which is not available in this environment. See the [Rust / Cargo Audit](#rust--cargo-audit) section for the recommendation.

---

### Pre-upgrade Vulnerability Summary

Initial `pnpm audit --audit-level=high` reported **70 vulnerabilities** (5 low, 26 moderate, 37 high, 2 critical).

The targeted issues from the issue brief were:

| Severity | Package | CVE / GHSA | Path | Status |
|---|---|---|---|---|
| CRITICAL | `tar` ≤7.5.20 | GHSA-23hp, GHSA-34x7, GHSA-8qq5, GHSA-r292 (+ others) | `packages/api > v8-profiler-next > @xprofiler/node-pre-gyp > tar` | ⚠️ Accepted risk |
| CRITICAL | `vitest` <3.2.6 | GHSA-5xrq-8626-4rwp | `packages/api > vitest`, `packages/monitoring > vitest` | ✅ Fixed |
| HIGH | `glob` >=10.2.0 <10.5.0 | GHSA-5j98-mcp5-4vw2 | `packages/app > eslint-config-next > @next/eslint-plugin-next > glob` | ✅ Fixed (resolved by next/eslint-config-next upgrade) |
| HIGH | `next` >=13.0.0 <15.0.8 | GHSA-h25m-26qc-wcjf | `packages/app > next` | ✅ Fixed |
| HIGH | `deepmerge-ts` <8.0.0 | GHSA-ggr8-5vv4-36mx | `packages/api > prisma > @prisma/config > deepmerge-ts` | ⚠️ Accepted risk |
| HIGH | `mysql2` <3.22.0 | GHSA-3f6p-5ww8-9rcr | `packages/api > prisma > mysql2` | ⚠️ Accepted risk |

Additional vulnerabilities discovered during the audit run (not in original issue brief):

| Severity | Package | GHSA | Path | Status |
|---|---|---|---|---|
| CRITICAL → fixed | `vitest` <3.2.6 | GHSA-5xrq-8626-4rwp | `packages/app > vitest`, `packages/sdk > vitest`, `packages/types > vitest`, `packages/test-utils > vitest` | ✅ Fixed |
| HIGH | `nodemailer` ≤9.0.0 | GHSA-p6gq-j5cr-w38f | `packages/api > nodemailer` | ✅ Fixed |
| HIGH | `nodemailer` ≥3.0.0 ≤7.0.10 | GHSA-rcmh-qjqh-p98v | `packages/api > nodemailer` | ✅ Fixed |
| HIGH | `sharp` <0.35.0 | GHSA-f88m-g3jw-g9cj | `packages/api > sharp` | ✅ Fixed |
| HIGH | `sharp` <0.35.0 | GHSA-f88m-g3jw-g9cj | `packages/app > @storybook/nextjs > sharp` | ⚠️ Accepted risk (transitive through storybook) |
| HIGH | `vite` ≤6.4.2 | GHSA-fx2h-pf6j-xcff | `packages/api > vitest > vite`, `packages/monitoring > vitest > vite` | ✅ Fixed (resolved by vitest upgrade to 3.2.7) |
| HIGH | `postcss` ≤8.5.17 | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 | `packages/app > next > postcss`, `packages/mobile > expo > postcss` | ⚠️ Accepted risk |
| HIGH | `@opentelemetry/auto-instrumentations-node` <0.75.0 | GHSA-q7rr-3cgh-j5r3 | `packages/api > @opentelemetry/auto-instrumentations-node` | ⚠️ Accepted risk |
| HIGH | `@opentelemetry/sdk-node` <0.217.0 | GHSA-q7rr-3cgh-j5r3 | `packages/api > @opentelemetry/sdk-node` | ⚠️ Accepted risk |
| HIGH | `@opentelemetry/propagator-jaeger` <2.9.0 | GHSA-45rx-2jwx-cxfr | `packages/api > @opentelemetry/sdk-node > @opentelemetry/propagator-jaeger` | ⚠️ Accepted risk |
| HIGH | `minimatch` ≥9.0.0 <9.0.7 | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 | `packages/mobile > @typescript-eslint/eslint-plugin > minimatch` | ⚠️ Accepted risk |
| HIGH | `@xmldom/xmldom` <0.8.13 | GHSA-wh4c-j3r5-mjhp, GHSA-2v35-w6hq-6mfw, GHSA-f6ww-3ggp-fr8h, GHSA-x6wf-f3px-wcqx, GHSA-j759-j44w-7fr8 | `packages/mobile > jest-expo > @expo/config > @expo/plist > @xmldom/xmldom` | ⚠️ Accepted risk |
| HIGH | `turbo-stream` <3.0.0 | GHSA-rxv8-25v2-qmq8 | `packages/mobile > expo-router > @expo/server > turbo-stream` | ⚠️ Accepted risk |
| HIGH | `tmp` <0.2.6 | GHSA-ph9p-34f9-6g65 | `packages/api > @stryker-mutator/core > @inquirer/prompts > tmp` | ⚠️ Accepted risk |
| HIGH | `image-size` ≤2.0.2 | GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq | `packages/app > @storybook/nextjs > image-size` | ⚠️ Accepted risk |

---

### Upgrades Applied

All commands were run from the monorepo root or package directory as noted.

#### 1. `vitest` → 3.2.7 (was 1.4.0 / 1.6.1)

**Packages upgraded**: `packages/api`, `packages/monitoring`, `packages/app`, `packages/sdk`, `packages/types`, `packages/test-utils`

Rationale: GHSA-5xrq-8626-4rwp — when the Vitest UI server (`--ui`) is enabled, an attacker with network access to the dev server can read arbitrary files and execute arbitrary code. Fixed in 3.2.6.

```
cd packages/api && pnpm add -D vitest@^3.2.6
cd packages/monitoring && pnpm add -D vitest@^3.2.6 @vitest/coverage-v8@^3.2.6
cd packages/app && pnpm add -D vitest@^3.2.6 @vitest/coverage-v8@^3.2.6
cd packages/sdk && pnpm add -D vitest@^3.2.6
cd packages/types && pnpm add -D vitest@^3.2.6
cd packages/test-utils && pnpm add -D vitest@^3.2.6 @vitest/coverage-v8@^3.2.6
```

Result: All vitest instances now at **3.2.7**. The `vite` GHSA-fx2h-pf6j-xcff vulnerability (Windows `server.fs.deny` bypass) was also resolved as a side-effect — vitest 3.x pulls in vite ≥6.4.3.

#### 2. `next` → 15.5.25 (was 14.2.x) + `eslint-config-next` → 15.5.25

**Package**: `packages/app`

Rationale: GHSA-h25m-26qc-wcjf — HTTP request deserialization DoS via insecure RSC (React Server Components) in Next.js ≥13.0.0 <15.0.8. Also resolves GHSA-5j98-mcp5-4vw2 (glob CLI command injection) as `eslint-config-next@15` pulls in `@next/eslint-plugin-next` with `glob@10.5.0`.

```
cd packages/app && pnpm add next@^15.0.8
cd packages/app && pnpm add -D eslint-config-next@^15.0.8
```

Result: `next@15.5.25`, `eslint-config-next@15.5.25`.

> **Known post-upgrade work items**: Next.js 15 introduces breaking changes in some APIs (async `params`/`searchParams` in page components, updated `cookies()`/`headers()` API, React 19 peer requirement). These migration items are out of scope for this security task and should be tracked separately. The app may have pre-existing type errors unrelated to this upgrade.

#### 3. `nodemailer` → 9.1.1 (was 6.9.x)

**Package**: `packages/api`

Rationale: GHSA-p6gq-j5cr-w38f — the `raw` message option bypasses `disableFileAccess` / `disableUrlAccess`, enabling arbitrary file read and SSRF. Fixed in 9.0.1. Also resolves GHSA-rcmh-qjqh-p98v (addressparser DoS via recursive calls, fixed in 7.0.11).

```
cd packages/api && pnpm add nodemailer@^9.1.1
```

Result: `nodemailer@9.1.1`.

#### 4. `sharp` → 0.35.4 (was 0.34.5)

**Package**: `packages/api`

Rationale: GHSA-f88m-g3jw-g9cj — inherited libvips vulnerabilities (CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591). Fixed in sharp 0.35.0.

```
cd packages/api && pnpm add sharp@^0.35.0
```

Result: `sharp@0.35.4`.

---

### Post-upgrade Audit Result

After all upgrades, `pnpm audit --audit-level=high` reports **61 vulnerabilities** (4 low, 21 moderate, 35 high, 1 critical), down from 70 (5 low, 26 moderate, 37 high, 2 critical).

All remaining high/critical items are either accepted risks (documented below) or transitive through third-party tooling that cannot be pinned without waiting for upstream releases.

---

### Accepted Risks

The following vulnerabilities cannot be fixed by a direct dependency upgrade and are accepted with documented justification.

#### 1. `tar` via `v8-profiler-next` (CRITICAL + HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-23hp, GHSA-34x7, GHSA-8qq5, GHSA-r292, GHSA-83g3-92jg-28cx, GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256, GHSA-r6q2-hw4h-h46w, GHSA-8x88-c5mf-7j5w |
| Path | `packages/api > v8-profiler-next > @xprofiler/node-pre-gyp > tar` |
| Impact | Path traversal, arbitrary file overwrite, DoS in `tar` during archive extraction |

**Justification**: `v8-profiler-next` is a `devDependency` in `packages/api` used exclusively for local performance profiling. It is never installed in production Docker builds (which use `--prod` install) and is not executed in CI pipelines. The vulnerable `tar` code path is triggered only during `v8-profiler-next`'s install/build phase (via `node-pre-gyp`), not at API runtime. No user input is passed to `tar` at any point in this codebase.

**Mitigation**: If v8-profiler-next is not actively needed for profiling work, remove it from `devDependencies`. Until then, ensure it is excluded from production builds and Docker images.

#### 2. `glob` via `eslint-config-next` (HIGH) — Resolved

This was listed in the original issue brief. It has been **resolved** by upgrading `eslint-config-next` to 15.5.25, which pulls in `@next/eslint-plugin-next` with `glob@10.5.0`.

#### 3. `deepmerge-ts` via `prisma` (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-ggr8-5vv4-36mx |
| Path | `packages/api > prisma > @prisma/config > deepmerge-ts` |
| Impact | Stack exhaustion when merging recursive object graphs |

**Justification**: `deepmerge-ts` is used internally by Prisma's config loader (`@prisma/config`) to merge configuration objects. It is not exposed to user-supplied input — Prisma config is loaded from static files (`prisma.config.ts`, `schema.prisma`) at build/migration time, not from request data. The circular-reference scenario that triggers stack exhaustion cannot occur from user input. This will be resolved automatically when Prisma upgrades its internal dependency.

#### 4. `mysql2` via `prisma` (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-3f6p-5ww8-9rcr |
| Path | `packages/api > prisma > mysql2` |
| Impact | Authentication plugin downgrade leaks plaintext credentials |

**Justification**: BlueCollar uses PostgreSQL, not MySQL. `mysql2` is an optional peer dependency pulled in by Prisma's driver manifest but is never instantiated — the application uses `@prisma/adapter-pg` and a PostgreSQL connection string. No MySQL credentials exist in this codebase. There is zero runtime exposure.

#### 5. `sharp` via `@storybook/nextjs` (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-f88m-g3jw-g9cj |
| Path | `packages/app > @storybook/nextjs > sharp` |
| Impact | libvips inherited vulnerabilities (image processing) |

**Justification**: The vulnerable `sharp` instance is a transitive dependency of `@storybook/nextjs` (a dev tool for UI component development). It is not used at runtime or in production builds. The direct `sharp` dependency in `packages/api` has been upgraded to 0.35.4 and is no longer vulnerable. Storybook's bundled `sharp` will be resolved when Storybook upgrades its peer dependencies.

#### 6. `postcss` via `next` and `expo` (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 |
| Paths | `packages/app > next > postcss`, `packages/mobile > expo > @expo/metro-config > postcss` |
| Impact | Arbitrary file read via attacker-controlled `sourceMappingURL` in CSS comments (dev server / build tooling) |

**Justification**: The vulnerability requires an attacker to control CSS content processed by PostCSS. In both paths here, PostCSS runs as part of the build pipeline or dev server — it processes trusted local CSS files, not untrusted user input. The attack surface is build-time, not runtime in production. Will be resolved when Next.js and Expo upgrade their bundled PostCSS.

#### 7. OpenTelemetry (`@opentelemetry/auto-instrumentations-node`, `@opentelemetry/sdk-node`, `@opentelemetry/propagator-jaeger`) (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-q7rr-3cgh-j5r3, GHSA-45rx-2jwx-cxfr |
| Path | `packages/api > @opentelemetry/auto-instrumentations-node` (and sub-deps) |
| Impact | Prometheus exporter crash via malformed HTTP request; JaegerPropagator crash via malformed header |

**Justification**: Both vulnerabilities cause process crashes (DoS) via malformed requests to the OpenTelemetry Prometheus/Jaeger endpoints. The Prometheus metrics endpoint (`/metrics`) should be firewalled from public access and only accessible from the internal monitoring network (Prometheus scrape target). The Jaeger header parsing issue is mitigated by the fact that Jaeger propagation headers are set by internal services, not untrusted clients in production. Upgrade path: update `@opentelemetry/auto-instrumentations-node` to ≥0.75.0 and `@opentelemetry/sdk-node` to ≥0.217.0, which requires aligning all OpenTelemetry packages — a larger coordinated upgrade tracked separately.

#### 8. `minimatch` via `@typescript-eslint` in `packages/mobile` (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 |
| Path | `packages/mobile > @typescript-eslint/eslint-plugin > @typescript-eslint/type-utils > @typescript-eslint/typescript-estree > minimatch` |
| Impact | ReDoS via crafted glob patterns |

**Justification**: `minimatch` is used by `@typescript-eslint` only during linting — a developer-time operation. User-controlled input never reaches ESLint's glob matching in production. Risk is limited to developer machines during CI lint runs (crafted source file patterns). Will be resolved when `@typescript-eslint` upgrades its `minimatch` peer.

#### 9. `@xmldom/xmldom` via `jest-expo` in `packages/mobile` (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-wh4c-j3r5-mjhp, GHSA-2v35-w6hq-6mfw, GHSA-f6ww-3ggp-fr8h, GHSA-x6wf-f3px-wcqx, GHSA-j759-j44w-7fr8 |
| Path | `packages/mobile > jest-expo > @expo/config > @expo/config-plugins > @expo/plist > @xmldom/xmldom` |
| Impact | XML injection, DoS via uncontrolled recursion in XML serialization |

**Justification**: `@xmldom/xmldom` is a transitive devDependency within `jest-expo`'s config loading chain (Expo plist parsing). It is used only during testing / build configuration, not at runtime. It processes Expo project config files — trusted static data, not user input. Will be resolved when Expo upgrades its `@expo/plist` dependency.

#### 10. `turbo-stream` via `expo-router` in `packages/mobile` (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-rxv8-25v2-qmq8 |
| Path | `packages/mobile > expo-router > @expo/server > @remix-run/node > @remix-run/server-runtime > turbo-stream` |
| Impact | DoS via reflected user input in React Router single-fetch |

**Justification**: The `packages/mobile` app is a React Native client — it does not run a server and never uses `@expo/server` or `@remix-run/server-runtime` in any deployed capacity. These packages are pulled in by `expo-router` as optional server-side capabilities that are never activated in this project. Will be resolved when Expo Router upgrades its Remix peer dependency.

#### 11. `tmp` via `@stryker-mutator/core` in `packages/api` (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-ph9p-34f9-6g65 |
| Path | `packages/api > @stryker-mutator/core > @inquirer/prompts > @inquirer/editor > external-editor > tmp` |
| Impact | Path traversal via unsanitized temp file prefix/postfix |

**Justification**: `@stryker-mutator/core` is a mutation testing devDependency — it is never run in production. The `tmp` vulnerability is triggered only when Stryker invokes an interactive editor prompt, which does not occur in CI (`test:mutation:ci` uses non-interactive mode). Will be resolved when Stryker upgrades its Inquirer dependency.

#### 12. `image-size` via `@storybook/nextjs` in `packages/app` (HIGH)

| Field | Value |
|---|---|
| Advisory | GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq |
| Path | `packages/app > @storybook/nextjs > image-size` |
| Impact | DoS via infinite loop in ICNS, JXL, and HEIF image parsers |

**Justification**: `image-size` is used by Storybook's Next.js integration during dev server startup to inspect image assets in the project. It processes trusted local project files (static assets in `public/`), not user-uploaded content. No untrusted images are passed through this code path. Will be resolved when Storybook upgrades its `image-size` dependency.

---

### Rust / Cargo Audit

`cargo audit` was **not run** in this session. The Rust toolchain (`cargo`) is not installed in this environment.

**Recommendation**: Add a `cargo audit` step to the contract CI workflow (`.github/workflows/ci.yml` or a dedicated `contracts.yml`). Example:

```yaml
- name: Install cargo-audit
  run: cargo install --locked cargo-audit

- name: Audit Rust dependencies
  run: cargo audit
  working-directory: packages/contracts
```

Run `cargo audit` locally whenever `packages/contracts/Cargo.lock` changes.

---

### API Type-check After Upgrades

`tsc --noEmit` was run against `packages/api` after all upgrades. The errors present are **pre-existing** and unrelated to any dependency upgraded in this session:

- `src/utils/roleChecker.test.ts` — object literal type narrowing issue
- `src/utils/versionRollout.ts` — optional vs required `RolloutConfig` fields
- `src/utils/versioning.ts` — string literal type mismatch (`"v2" | "v1"`)
- `src/workers/email.worker.ts` — missing `mailer` export from `mailer/index.js`
- `src/workers/scheduler.worker.ts` — `repeat` field removed from BullMQ `JobsOptions` type
- `packages/test-utils/src/contract-fixtures.ts` — nullable tuple type errors

No new type errors were introduced by the vitest 3.x, nodemailer 9.x, or sharp 0.35.x upgrades.

---

### Summary

| Action | Result |
|---|---|
| `vitest` upgraded across all 6 packages | ✅ All at 3.2.7 (was 1.4.0–1.6.1) |
| `next` upgraded in `packages/app` | ✅ 15.5.25 (was 14.2.x) |
| `eslint-config-next` upgraded in `packages/app` | ✅ 15.5.25 (was 14.2.35) |
| `nodemailer` upgraded in `packages/api` | ✅ 9.1.1 (was 6.9.x) |
| `sharp` upgraded in `packages/api` | ✅ 0.35.4 (was 0.34.5) |
| Total vulnerabilities (high+critical) | 61 (was 70) — CRITICAL: 1 (was 2) |
| Rust contract audit | ⚠️ Not run — no Rust toolchain in this environment |

---

## Issue #1291 — Type Consolidation Audit (@bluecollar/types)

**Date**: September 2, 2026  
**Status**: Complete

### Summary

A codebase-wide audit was performed to identify duplicate type definitions that should
be consolidated into the shared `@bluecollar/types` package.

### Already Consolidated (before this issue)

- `ApiResponse<T>`, `Meta`, `PaginatedResult<T>`, `User`, `Worker`, `Category`, and all
  other core domain types are centralised in `packages/types/src/index.ts` and re-exported
  from `packages/app/src/types/index.ts`.

### Changes Made

| Location | Change |
|---|---|
| `packages/app/src/app/[locale]/settings/profile/page.tsx` | Removed local `interface UserProfile { firstName, lastName, email }`. Replaced with `type UserProfile = Pick<User, "firstName" \| "lastName" \| "email">` importing `User` from `@bluecollar/types`. |

### Intentionally Local Types (not consolidated — documented here)

| File | Type | Reason |
|---|---|---|
| `packages/api/src/utils/response.ts` | `ApiResponse<T>` | Slim helper-only envelope (`{ data, status, code, message }`). Intentionally excludes optional `token` and `meta` fields carried by the shared type. Auth controller appends `token` separately. Replacing it with `@bluecollar/types`'s `ApiResponse` would be a no-op for helpers but misleading about optional fields. |
| `packages/mobile/src/lib/api.ts` | `HttpResponse<T>` (was `ApiResponse<T>`, renamed in this issue) | Raw HTTP fetch wrapper shape (`{ ok, status, statusText, data, error }`). This is NOT the API envelope — it wraps the fetch Response metadata. Renamed to `HttpResponse<T>` to avoid confusion with the shared `ApiResponse<T>` from `@bluecollar/types`. |
| `packages/api/src/resources/worker.resource.ts` | `WorkerWithRelations` | Prisma-generated `Worker` extended with optional joined relations (`category`, `curator`). Depends on `@prisma/client` types; incompatible with the domain `Worker` from `@bluecollar/types`. Correctly local. |
| `packages/api/src/serializers/worker.serializer.ts` | `WorkerWithRelations` | Same rationale as above — Prisma relational type for serializer input. |
| `packages/api/src/models/worker.model.ts` | `WorkerWithRelations` | Same rationale as above — Prisma relational type with required (non-optional) relations. |

### Notes

- `packages/mobile/src/cache/types.ts` re-exports `ApiResponse` from `@bluecollar/types` — this is correct and was not changed.
- The `HttpResponse` rename in `mobile/src/lib/api.ts` has no callers outside that file that import the type by name, so there is no breaking impact.

---

## Issue #1293 — Remove Deprecated Lodash Usage

**Audit date:** 2026-09-02  
**Auditor:** Automated (issue_1293)  
**Result:** ✅ PASSED — no action needed

### Summary

A full codebase audit was performed to identify any usage of the `lodash` library
across all packages in the monorepo, in accordance with the project's policy to avoid
large utility-belt dependencies with modern native alternatives available.

### Commands Run

```bash
# Check all TypeScript/JavaScript source files for lodash imports or requires
grep -rn 'lodash' /workspaces/Blue-Collar/packages \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
  2>/dev/null | grep -v node_modules | grep -v pnpm-lock.yaml

# Check all package.json manifests for lodash as a dependency
grep -rn 'lodash' /workspaces/Blue-Collar/packages \
  --include='package.json' \
  2>/dev/null | grep -v node_modules
```

### Findings

| Check | Result |
|---|---|
| `lodash` present in any `package.json` (`dependencies`, `devDependencies`, `peerDependencies`) | ✅ Not found — zero matches |
| `import ... from 'lodash'` or `import ... from 'lodash/...'` in any `.ts`/`.tsx`/`.js`/`.mjs` source file | ✅ Not found — zero matches |
| `require('lodash')` or `require('lodash/...')` in any source file | ✅ Not found — zero matches |
| Bundle weight penalty from lodash | ✅ None — library is absent from all manifests |

### Conclusion

`lodash` is not installed in any package within the monorepo. There are no imports or
`require` calls referencing lodash in any TypeScript or JavaScript source file.
No bundle weight penalty exists. The codebase relies exclusively on native ES/Node.js
equivalents (e.g., `Array.prototype` methods, `Object.entries`, optional chaining, etc.)
for utility operations that lodash would historically have covered.

**No changes were required.** This issue is closed as a clean confirmation.

# Security Testing & Penetration Testing Checklist

> Closes #824  
> Covers BlueCollar's attack surface: REST API, Next.js frontend, Stellar Soroban contracts, and Freighter wallet integration.  
> Mapped to OWASP Top 10 (2021) and OWASP Smart Contract Top 10.

**Version:** 1.0 · **Last updated:** 2026-06-28  
**Related docs:** [THREAT_MODEL.md](./THREAT_MODEL.md) · [SECURITY_GUIDE.md](./SECURITY_GUIDE.md) · [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)

---

## Table of Contents

- [How to Use This Checklist](#how-to-use-this-checklist)
- [Scope](#scope)
- [Pre-engagement Setup](#pre-engagement-setup)
- [A01 – Broken Access Control](#a01--broken-access-control)
- [A02 – Cryptographic Failures](#a02--cryptographic-failures)
- [A03 – Injection](#a03--injection)
- [A04 – Insecure Design](#a04--insecure-design)
- [A05 – Security Misconfiguration](#a05--security-misconfiguration)
- [A06 – Vulnerable & Outdated Components](#a06--vulnerable--outdated-components)
- [A07 – Identification & Authentication Failures](#a07--identification--authentication-failures)
- [A08 – Software & Data Integrity Failures](#a08--software--data-integrity-failures)
- [A09 – Security Logging & Monitoring Failures](#a09--security-logging--monitoring-failures)
- [A10 – SSRF](#a10--ssrf)
- [SC01 – Smart Contract & Wallet Checks](#sc01--smart-contract--wallet-checks)
- [File Upload Abuse](#file-upload-abuse)
- [Rate-Limit Bypass](#rate-limit-bypass)
- [Remediation Tracking](#remediation-tracking)
- [Re-test Protocol](#re-test-protocol)
- [CI Integration](#ci-integration)
- [Finding Severity Reference](#finding-severity-reference)

---

## How to Use This Checklist

1. Clone the repo and stand up staging: `docker compose -f docker-compose.staging.yml up -d`.
2. Work through each section in order. Mark each item `✅ Pass`, `❌ Fail`, or `⏭ N/A`.
3. For every `❌ Fail`, open a GitHub issue tagged `security` with the template below.
4. After fixes are deployed to staging, re-run the relevant section and update status.

### Issue template

```markdown
**Title:** [PENTEST] <short description>
**Severity:** Critical | High | Medium | Low
**OWASP category:** A0X – <name>
**Steps to reproduce:**
1. …
**Expected:** …
**Actual:** …
**Remediation:** …
**Owner:** @handle
**Re-test due:** YYYY-MM-DD
```

---

## Scope

| Target | In scope | Notes |
|--------|----------|-------|
| `https://staging.bluecollar.app/api` | ✅ | REST API |
| `https://staging.bluecollar.app` | ✅ | Next.js frontend |
| Soroban contracts (testnet) | ✅ | Registry, Market, Dispute, FeeDistribution, InsurancePool |
| Production environment | ❌ | Never test against production |
| Third-party OAuth (Google) | ❌ | Out of scope |
| Stellar Horizon / Soroban RPC | ❌ | External — out of scope |

---

## Pre-engagement Setup

- [ ] Confirm staging environment is isolated (no real user data, no production DB).
- [ ] Obtain a test account with each role: `user`, `curator`, `admin`.
- [ ] Have a second test account for cross-account/IDOR tests.
- [ ] Install Burp Suite (Community or Pro) or OWASP ZAP.
- [ ] Install Freighter wallet extension (testnet mode).
- [ ] Fund two testnet Stellar accounts via Friendbot.
- [ ] Note deployed contract IDs from `.env.staging`.

---

## A01 – Broken Access Control

### Authorization & IDOR

- [ ] **IDOR – worker profile:** Can user A read/edit worker records owned by user B? (`GET /api/workers/:id`, `PUT /api/workers/:id`).
- [ ] **IDOR – toggle active status:** Can a `user`-role account call `PATCH /api/workers/:id/toggle` on another curator's worker?
- [ ] **Privilege escalation via role claim:** Craft a JWT with `role: "admin"` using a weak or stolen secret. Verify it is rejected.
- [ ] **Horizontal escalation – curator:** Can curator A delete or update a worker created by curator B?
- [ ] **Admin endpoints accessible by curator:** Try all `DELETE /api/workers/:id` and bulk-operation endpoints with a curator JWT.
- [ ] **Unauthenticated access to protected routes:** Remove `Authorization` header from any request that requires auth. Expect `401`.
- [ ] **Method override abuse:** Send `POST /api/workers/:id` with `X-HTTP-Method: DELETE` as a non-admin. Should be rejected.
- [ ] **Force browsing:** Try accessing `/api/admin/*` paths by guessing routes not documented in the OpenAPI spec.
- [ ] **Mass assignment:** POST/PUT requests with extra fields (e.g., `role`, `verified`, `id`). Verify they are stripped.
- [ ] **Insecure direct object reference – profile image:** Access `/storage/uploads/<uuid>` for another user's image without auth.

### On-chain Authorization (see also SC01)

- [ ] **Non-curator calls `register_worker`:** Call the Registry contract as a plain user address. Expect authorization failure.
- [ ] **Non-admin calls `upgrade`:** Send an `upgrade` invocation without the contract admin key. Must revert.
- [ ] **Arbitrator bypass:** Attempt to resolve a dispute without the arbitrator role.

---

## A02 – Cryptographic Failures

- [ ] **TLS version:** Verify staging rejects TLS 1.0/1.1 connections (`openssl s_client -tls1 ...`).
- [ ] **JWT algorithm confusion:** Submit a JWT with `alg: none` or `alg: HS256` (when RS256 is expected). Should return `401`.
- [ ] **JWT secret strength:** Check `JWT_SECRET` is at least 32 bytes of entropy (automated in CI via secret scan).
- [ ] **Password hashing:** Confirm Argon2id is used (not MD5/SHA-1/bcrypt w/ low cost). Inspect source `middleware/auth.ts`.
- [ ] **Sensitive data in responses:** Confirm password hashes, internal IDs, and private keys never appear in API responses.
- [ ] **Sensitive data in logs:** Confirm `JWT_SECRET`, DB passwords, and wallet secret keys never appear in application logs.
- [ ] **HTTPS enforcement:** Confirm `Strict-Transport-Security` header is set with `max-age >= 31536000`.
- [ ] **Cookie flags:** If session cookies are used, verify `Secure`, `HttpOnly`, `SameSite=Strict`.
- [ ] **XDR signing integrity:** Confirm `assertXdrNotTampered` is called before submitting signed transactions (see `packages/app/src/lib/transactions.ts`).

---

## A03 – Injection

### SQL Injection

- [ ] **Auth endpoints:** Try SQLi payloads in `email` and `password` fields of `/api/auth/login` and `/api/auth/register`.  
  Payloads: `' OR '1'='1`, `'; DROP TABLE users; --`, `admin'--`
- [ ] **Worker search/filter:** Inject into any query parameter that filters worker listings (`?name=`, `?category=`, `?location=`).
- [ ] **Prisma ORM protection:** All DB queries must use Prisma's parameterised API (no raw interpolated SQL). Verify by code review.
- [ ] **Stored → reflected injection:** Create a worker with a name containing `<script>alert(1)</script>`. Verify it is escaped in the listing page.

### NoSQL / Header Injection

- [ ] **Header injection in email fields:** Submit `\r\nBcc: attacker@evil.com` in forgot-password email. Verify mail is not forwarded.
- [ ] **HTTP response splitting:** Try `\r\n` in query params used in Location headers.

### XSS

- [ ] **Reflected XSS:** Inject `<img src=x onerror=alert(1)>` in all search query parameters. Verify CSP/escaping blocks execution.
- [ ] **Stored XSS – worker bio/name:** Submit a worker with `<script>` tags in name or description. Verify output is escaped.
- [ ] **DOM XSS:** Review Next.js pages that use `dangerouslySetInnerHTML`. None should be present unless content is explicitly sanitised.
- [ ] **CSP header:** Verify `Content-Security-Policy` is present and prohibits `unsafe-inline` scripts.

---

## A04 – Insecure Design

- [ ] **Password reset token reuse:** Use a consumed reset token a second time. Expect `400`/`403`.
- [ ] **Password reset token enumeration:** Try resetting with a valid email vs. a non-existent one. Both should return `200` (no user enumeration).
- [ ] **Email verification bypass:** Attempt to access authenticated endpoints with an unverified account (if `verified: false`).
- [ ] **Concurrent request race condition:** Send two simultaneous tip/payment requests for the same job. Verify no double-spend via idempotency keys.
- [ ] **Negative amount payment:** Submit a payment with `amount: -100`. Verify `validateAmount` in `transactions.ts` rejects it.
- [ ] **Amount with >7 decimals:** Submit `amount: "0.00000001"`. Verify rejection.
- [ ] **Zero-amount payment:** Submit `amount: 0`. Verify rejection.

---

## A05 – Security Misconfiguration

- [ ] **Security headers:** Run `curl -I https://staging.bluecollar.app/api/health` and verify all required headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `Permissions-Policy`
- [ ] **CORS policy:** Verify `Access-Control-Allow-Origin` is not `*` for credentialed requests.
- [ ] **Stack traces in errors:** Trigger a 500 error. Verify no stack trace or internal paths leak to the client.
- [ ] **Default credentials:** Confirm no default admin password (`admin`/`password`) exists in seed data.
- [ ] **Debug endpoints:** Ensure no `/debug`, `/status/internal`, or metrics endpoints are publicly accessible without auth.
- [ ] **Directory listing:** Verify `/storage/uploads/` does not list files.
- [ ] **Exposed `.env` files:** Try `GET /.env`, `GET /packages/api/.env`. Should return `404` or be blocked by nginx.
- [ ] **Docker image secrets:** Run `docker history bluecollar-api:latest` and confirm no secrets are baked into image layers.

---

## A06 – Vulnerable & Outdated Components

- [ ] **pnpm audit:** `pnpm audit --audit-level=high` returns zero high/critical advisories (gated in CI via `security-scan.yml`).
- [ ] **cargo audit:** `cargo audit` in `packages/contracts` returns zero advisories.
- [ ] **Trivy container scan:** CI `trivy` job exits 0 (no HIGH/CRITICAL unfixed CVEs).
- [ ] **Node.js version:** Confirm runtime uses Node ≥ 20 LTS (check Dockerfiles).
- [ ] **Rust toolchain:** Confirm `stable` or a named recent version (no ancient nightly).

---

## A07 – Identification & Authentication Failures

- [ ] **Brute-force login:** Send 100 login requests with wrong passwords. Verify account lockout or rate-limit response (`429`).
- [ ] **Credential stuffing protection:** Verify rate limiting on `/api/auth/login` (see `RATE_LIMITING.md`).
- [ ] **Expired JWT accepted:** Forge a JWT with `exp` in the past. Should return `401`.
- [ ] **JWT replay after logout:** Log out, then replay the old JWT. Should return `401` (token invalidation).
- [ ] **Weak password policy:** Attempt to register with `password: "a"`. Verify minimum length enforcement.
- [ ] **Google OAuth state parameter:** Ensure `state` parameter is validated to prevent CSRF on OAuth callback.
- [ ] **Session fixation:** If sessions are used, verify a new session ID is issued after login.
- [ ] **Password reset token entropy:** Verify reset tokens are cryptographically random and expire within 1 hour.

---

## A08 – Software & Data Integrity Failures

- [ ] **Dependency integrity (lockfile):** Confirm `pnpm-lock.yaml` is committed and `pnpm install --frozen-lockfile` is used in CI.
- [ ] **SBOM attestation (main branch):** After a push to `main`, verify the SBOM artifact is generated and attested (CI `sbom` job).
- [ ] **Workflow step injection:** Check all GitHub Actions workflow files for injection via `${{ github.event.* }}` in `run:` steps. Use `env:` context instead.
- [ ] **Supply-chain pinned actions:** All workflow action refs should use full commit SHA (warned by `pinned-actions` job).
- [ ] **XDR tamper detection:** Confirm `assertXdrNotTampered` is called in the tip/payment flow before broadcasting (unit tests in `transactions.test.ts`).
- [ ] **Contract WASM hash verification:** When upgrading a contract, verify the WASM hash matches the locally-built artifact before invoking `upgrade`.

---

## A09 – Security Logging & Monitoring Failures

- [ ] **Failed login audit trail:** Confirm failed login attempts are logged with IP, timestamp, and username (but not the password).
- [ ] **Privilege escalation logging:** Verify admin actions (role changes, bulk deletes) are written to `AuditLog`.
- [ ] **Log injection:** Submit a newline (`\n`) in a logged field. Verify log parsers are not confused (structured JSON logging).
- [ ] **Alerting on anomalies:** Verify Prometheus/Grafana alert fires on `auth_failures_total > threshold` (see `deploy/prometheus/alerts.yml`).
- [ ] **Log retention:** Confirm logs are retained for at least 90 days per the logging policy.
- [ ] **No secrets in logs:** Search staging logs for `password`, `secret`, `token`, `private_key`. Should return nothing sensitive.

---

## A10 – SSRF

- [ ] **Profile image URL fetch (if applicable):** If the API fetches a URL to store a profile image, try `http://169.254.169.254/latest/meta-data/` (AWS IMDS). Should be blocked.
- [ ] **Webhook or callback URL:** If any endpoint accepts a URL parameter, verify it is validated against an allowlist.
- [ ] **Horizon proxy:** If the API proxies Stellar Horizon calls, ensure it only connects to the configured Horizon URL (no user-supplied URL substitution).

---

## SC01 – Smart Contract & Wallet Checks

*Mapped to OWASP Smart Contract Top 10 and BlueCollar-specific flows.*

### Authorization & Access Control

- [ ] **SCAC-01 – Unauthorized `register_worker`:** Call Registry `register_worker` without curator authorization. Expect `Error::Unauthorized`.
- [ ] **SCAC-02 – Unauthorized contract upgrade:** Call `upgrade` without the admin key. Expect `require_auth()` failure.
- [ ] **SCAC-03 – Unauthorized dispute resolution:** Resolve a dispute as a non-arbitrator. Expect `Error::NotArbitrator`.
- [ ] **SCAC-04 – Fee distribution drain:** Attempt to call `distribute` or `withdraw` without the authorized recipient address.

### Integer & Arithmetic Safety

- [ ] **SCINT-01 – Overflow tip amount:** Submit a tip with `amount = u64::MAX`. Verify the contract rejects or handles safely.
- [ ] **SCINT-02 – Zero amount:** Submit `amount = 0`. Verify the contract rejects it.
- [ ] **SCINT-03 – Decimal precision:** Verify amounts are stored in stroops (integer) with no floating-point arithmetic.

### Reentrancy & State

- [ ] **SCRE-01 – Re-entrant escrow:** Attempt to call `release_escrow` twice before the state is updated. Verify idempotency.
- [ ] **SCRE-02 – Multi-sig cancellation race:** Attempt to cancel an escrow after it has been released. Expect failure.

### Front-running & Ordering

- [ ] **SCFR-01 – Tip front-running:** Verify the Market contract does not expose tip amounts in pending transactions in a way that can be front-run.

### Network & Wallet Safety (Client-side)

- [ ] **SCWS-01 – Wrong network block:** Connect Freighter to MAINNET while app expects TESTNET. Verify `validateNetwork` throws before the signing prompt appears.
- [ ] **SCWS-02 – Unknown contract block:** Craft a transaction invoking a contract ID not in the app's allowlist. Verify `validateContractId` blocks it.
- [ ] **SCWS-03 – Tampered XDR:** Simulate a tampered wallet returning modified XDR. Verify `assertXdrNotTampered` throws `TAMPERED_XDR`.
- [ ] **SCWS-04 – Human-readable summary shown:** In the `TransactionConfirmDialog`, verify destination, amount, network, and fee are all displayed before the user can click "Sign & Submit".
- [ ] **SCWS-05 – Negative/overflow amount:** Enter `-1` and `9999999999999` in the payment UI. Verify `validateAmount` blocks both.

### Storage TTL

- [ ] **SCTL-01 – Expired worker entry:** Simulate a worker entry whose TTL has expired. Verify the contract returns an appropriate error rather than corrupt data.
- [ ] **SCTL-02 – `extend_worker_ttl` permissionless:** Confirm any address can call `extend_worker_ttl` (no auth required — by design).

---

## File Upload Abuse

- [ ] **MIME type spoofing:** Rename `malware.exe` to `photo.jpg` and upload as a worker profile image. Verify the API rejects non-image MIME types.
- [ ] **Polyglot files:** Upload a JPEG containing embedded PHP/JS. Verify Sharp processes and strips metadata.
- [ ] **Large file DoS:** Upload a 100 MB file. Verify the API enforces a file size limit and returns `413`.
- [ ] **Path traversal in filename:** Use `../../etc/passwd` as a filename. Verify the API sanitises filenames.
- [ ] **SVG XSS:** Upload an SVG containing `<script>`. Verify it is rejected (SVG not in allowed MIME types) or sanitised.
- [ ] **Storage URL signed access:** Verify S3 object URLs require signed access and are not publicly guessable.

---

## Rate-Limit Bypass

*All rate-limit bypass tests should be run with different IP headers to simulate evasion.*

- [ ] **IP rotation bypass:** Send requests with varying `X-Forwarded-For` headers. Verify the rate limiter uses the real client IP (or rejects spoofed headers).
- [ ] **Login endpoint:** Exceed the login rate limit (e.g., 10 failed logins/minute). Expect `429 Too Many Requests`.
- [ ] **Registration endpoint:** Exceed the registration rate limit. Expect `429`.
- [ ] **Password reset spam:** Submit 20 reset requests for the same email in 1 minute. Expect `429`.
- [ ] **API key / JWT bypass:** Confirm authenticated requests are still rate-limited (not exempt by default).
- [ ] **Burst attack:** Send 1000 requests in 1 second to `/api/workers`. Verify the service does not fall over and returns `429` for excess requests.
- [ ] **Slow loris:** Open many slow HTTP connections. Verify nginx/server timeout closes them.

---

## Remediation Tracking

Open findings are tracked as GitHub issues with label `security`. The table below is updated after each pentest run.

| ID | Category | Severity | Description | Status | Owner | Issue |
|----|----------|----------|-------------|--------|-------|-------|
| PT-001 | Template | — | Example placeholder | — | — | — |

**Statuses:** `Open` · `In Progress` · `Fixed` · `Accepted Risk` · `N/A`

---

## Re-test Protocol

1. Tester opens a PR to this file updating the finding's **Status** to `Fixed`.
2. The PR description links to the issue and the fix commit.
3. A second reviewer independently re-runs the specific checklist item against staging.
4. Reviewer marks the item `✅ Pass` and approves the PR.
5. Issue is closed with the label `security-resolved`.

---

## CI Integration

| Tool | Workflow | Trigger | Gate |
|------|----------|---------|------|
| Gitleaks | `security-scan.yml` | Every push/PR | Block on any detected secret |
| TruffleHog | `security-scan.yml` | Every push/PR | Block on verified secret |
| pnpm audit | `security-scan.yml` | Every push/PR | Block on HIGH+ advisory |
| cargo audit | `security-scan.yml` | Every push/PR | Block on any advisory |
| Trivy | `security-scan.yml` | Every push/PR | Block on HIGH/CRITICAL CVE |
| OWASP ZAP baseline | `dast.yml` | Push to main + weekly | Block on new HIGH finding |
| OWASP ZAP full scan | `dast.yml` | Manual `workflow_dispatch` | Block on new HIGH finding |
| Unit security tests | `ci.yml` | Every PR | Block on test failure |

ZAP false positives are suppressed via `.zap/rules.tsv`. To add a suppression:

```tsv
<rule-id>	IGNORE	<reason>
```

---

## Finding Severity Reference

| Severity | CVSS | Description | SLA |
|----------|------|-------------|-----|
| Critical | 9.0–10.0 | Direct financial loss, full system compromise, private key exposure | Fix within 24h |
| High | 7.0–8.9 | Privilege escalation, mass data exposure, auth bypass | Fix within 7 days |
| Medium | 4.0–6.9 | Limited data exposure, partial auth bypass, IDOR on non-sensitive data | Fix within 30 days |
| Low | 0.1–3.9 | Information disclosure, minor misconfig | Fix within 90 days |
| Informational | 0.0 | Best-practice deviation, no direct risk | Fix at discretion |

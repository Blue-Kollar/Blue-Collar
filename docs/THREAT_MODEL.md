# BlueCollar Threat Model

> Covers on-chain (Soroban contracts) and off-chain (API, database, wallet) surfaces.
> **Version**: 1.0 — Last updated: June 2026

---

## Table of Contents

- [Assets & Actors](#assets--actors)
- [Trust Boundaries](#trust-boundaries)
- [STRIDE Threat Analysis](#stride-threat-analysis)
  - [Boundary A: Client ↔ API](#boundary-a-client--api)
  - [Boundary B: API ↔ Database](#boundary-b-api--database)
  - [Boundary C: API ↔ Stellar (Horizon)](#boundary-c-api--stellar-horizon)
  - [Boundary D: User Wallet ↔ Soroban Contracts](#boundary-d-user-wallet--soroban-contracts)
  - [Boundary E: API ↔ Admin Panel](#boundary-e-api--admin-panel)
  - [Boundary F: API ↔ S3/CDN (File Uploads)](#boundary-f-api--s3cdn-file-uploads)
- [Key Custody & Admin Powers](#key-custody--admin-powers)
- [Abuse Scenarios](#abuse-scenarios)
- [Threat Tracking](#threat-tracking)
- [References](#references)

---

## Assets & Actors

### Assets

| #   | Asset                                                                 | Sensitivity | Location                            |
| --- | --------------------------------------------------------------------- | ----------- | ----------------------------------- |
| A1  | User accounts (email, Argon2id-hashed password, Google OAuth link)    | Critical    | PostgreSQL (`User` table)           |
| A2  | JWT signing secret (`JWT_SECRET`)                                     | Critical    | Vault / env                         |
| A3  | Stellar contract admin keys                                           | Critical    | Hardware wallet / multisig          |
| A4  | Stellar curator / privileged-role keys                                | High        | User-controlled wallets             |
| A5  | Worker on-chain profiles (reputation, staking, badges, subscriptions) | High        | Soroban Registry contract           |
| A6  | Escrowed & multi-sig escrow funds                                     | Critical    | Soroban Market contract             |
| A7  | API infrastructure secrets (DB creds, AWS keys, SMTP passwords)       | Critical    | Vault                               |
| A8  | PII (email, phone hashes, wallet addresses, location hashes)          | Medium      | PostgreSQL + Soroban                |
| A9  | Audit logs                                                            | Medium      | PostgreSQL (`AuditLog` table)       |
| A10 | Session tokens / refresh tokens                                       | High        | PostgreSQL (`RefreshToken` table)   |
| A11 | Idempotency keys                                                      | Low         | PostgreSQL (`IdempotencyKey` table) |
| A12 | Profile images (S3 / CDN)                                             | Low         | AWS S3 + CloudFront                 |

### Actors

| Actor                    | Description                                                                     | Trust Level        |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------ |
| **Unauthenticated user** | Any visitor without a session                                                   | Untrusted          |
| **Authenticated user**   | Logged-in user (client, worker)                                                 | Low                |
| **Curator**              | Off-chain trusted actor who approves worker registrations & verifies categories | Medium             |
| **Arbitrator**           | Resolves payment disputes on-chain                                              | Medium             |
| **API admin**            | User with `admin` role in the database; full API access                         | High               |
| **Contract admin**       | Stellar address holding `ROLE_ADMIN` / `ROLE_UPGRADER` on contracts             | Critical           |
| **Contract upgrader**    | `ROLE_UPGRADER` — can replace contract WASM                                     | Critical           |
| **Infra operator**       | DevOps with access to K8s, Vault, cloud console                                 | Critical           |
| **Stellar network**      | Validators / Horizon nodes                                                      | Trusted (external) |

---

## Trust Boundaries

```
                        ┌──────────────────────┐
                        │   User Wallet         │
                        │  (Freighter/ HW)      │
                        └─────────┬────────────┘
                                  │  Boundary D
                                  │  (on-chain)
                                  ▼
┌──────────┐   Boundary A   ┌──────────┐   Boundary B   ┌──────────┐
│  Browser  │◄─────────────►│   API    │◄──────────────►│ Postgres │
│  / App    │  (HTTPS/JWT)  │ (Express)│  (Prisma/SSL)  │    DB    │
└──────────┘               └────┬─────┘                └──────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              Boundary C   Boundary E   Boundary F
                    │           │           │
                    ▼           ▼           ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Stellar  │ │  Admin   │ │S3 / CDN  │
              │ Horizon  │ │  Panel   │ │ (Images) │
              │ (Network)│ │ (Next.js)│ │          │
              └──────────┘ └──────────┘ └──────────┘

  Contract Layer (Soroban):
  ┌─────────────────────────────────────────────────────────┐
  │  Registry    Market    Dispute    FeeDist    Insurance   │
  │  (worker     (tips,    (arbitra-  (fee       (claims,    │
  │   profiles)   escrow)   tion)      splits)    pool)      │
  └─────────────────────────────────────────────────────────┘
```

---

## STRIDE Threat Analysis

### Boundary A: Client ↔ API

| Threat                     | Scenario                                                              | Impact                                | Current Mitigations                                                                                                                                                                                           | Residual Risk                                                             | Follow-up                                   |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| **Spoofing**               | Attacker forges a JWT or steals a token to impersonate a user         | Account takeover, unauthorised access | JWT signed with HS256 (`JWT_SECRET`); JTI revocation set for logout; token expiry (7d); `authenticate` middleware verifies signature + expiry on every request; httpOnly cookie recommended over localStorage | Medium — token theft via XSS still possible if frontend uses localStorage | [#767] Migrate frontend to httpOnly cookies |
| **Tampering**              | Attacker modifies request body to bypass validation or escalate role  | Data corruption, privilege escalation | Zod validation schemas on all inputs; `sanitize` middleware strips XSS + blocks SQLi patterns + prototype pollution; `authorize` middleware enforces role gates                                               | Low                                                                       | —                                           |
| **Repudiation**            | User denies performing an action                                      | No audit trail for disputes           | `audit.ts` middleware logs action type + userId + IP + timestamp on every state-mutating call; idempotency keys prevent duplicate action claims                                                               | Low                                                                       | —                                           |
| **Information Disclosure** | Token or password leaked in logs, headers, or error messages          | Credential exposure                   | Pino HTTP logger configured to exclude `password`, `token`, `Authorization`; `sanitizeUser` strips sensitive fields from API responses; error handler returns generic messages for internal errors            | Low                                                                       | —                                           |
| **Denial of Service**      | Attacker floods auth endpoints to lock out legitimate users           | Service unavailability                | `authRateLimiter` (10 req / 15 min on login/register); `userRateLimit` with Redis + exponential backoff; `generalRateLimit` (200 req / 15 min auth); Helmet CSP blocks script injection                       | Medium — no global DDoS protection                                        | [#768] Add Cloudflare / WAF rate limiting   |
| **Elevation of Privilege** | Attacker modifies `role` claim in JWT or exploits missing role checks | Admin access                          | JWT signed server-side (cannot modify claims); `authorize` middleware checks `req.user.role` against required roles on every admin route; role is a non-mutable DB field                                      | Low                                                                       | —                                           |

### Boundary B: API ↔ Database

| Threat                     | Scenario                                        | Impact                         | Current Mitigations                                                                                                                                                 | Residual Risk | Follow-up                              |
| -------------------------- | ----------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------- |
| **Spoofing**               | Attacker connects to DB with stolen credentials | Full data breach               | DB connection uses least-privilege user; credentials stored in Vault, never in code; internal network only (not exposed publicly)                                   | Low           | —                                      |
| **Tampering**              | SQL injection via raw queries                   | Data exfiltration / corruption | Prisma uses parameterised queries by default; `$queryRaw` enforces tagged template literals; sanitize middleware blocks SQLi patterns as defence-in-depth           | Low           | —                                      |
| **Repudiation**            | DBA denies making manual changes                | Loss of forensic trail         | `AuditLog` table captures application-level actions; database audit logging via PostgreSQL `audit` extension (TBD)                                                  | Medium        | [#769] Enable PostgreSQL audit logging |
| **Information Disclosure** | DB dump exposes password hashes / tokens        | Credential compromise          | Passwords hashed with Argon2id (memory-hard); verification/reset tokens stored as SHA-256 hashes (raw token only in email); refresh tokens are opaque random values | Low           | —                                      |
| **Denial of Service**      | Connection pool exhaustion                      | API outage                     | Prisma connection pooling with `connection_limit`; monitoring alerts on connection count; `kubectl rollout restart` runbook for immediate recovery                  | Medium        | [#770] Add connection pool autoscaling |
| **Elevation of Privilege** | DB user has excessive grants                    | Unauthorised schema changes    | DB user restricted to `SELECT/INSERT/UPDATE/DELETE` on application tables; schema migrations run separately with elevated credentials                               | Low           | —                                      |

### Boundary C: API ↔ Stellar (Horizon)

| Threat                     | Scenario                                            | Impact                                            | Current Mitigations                                                                                                                                                      | Residual Risk           | Follow-up                                      |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------- |
| **Spoofing**               | Attacker runs a fake Horizon node                   | Incorrect contract state or transaction rejection | API connects to known Horizon URLs (configurable via env); Stellar network signatures validate transaction results                                                       | Low                     | —                                              |
| **Tampering**              | Man-in-the-middle modifies transaction XDR          | Funds misdirected                                 | All mutating contract calls use `require_auth()` — Stellar enforces caller signature on every operation; API constructs XDR locally and only submits signed transactions | Low                     | —                                              |
| **Information Disclosure** | On-chain data analysis reveals user behaviour       | Privacy loss                                      | `location_hash` and `contact_hash` are SHA-256 digests (not plaintext); wallet addresses are public by design on Stellar                                                 | Medium (accepted)       | —                                              |
| **Denial of Service**      | Horizon rate limits throttle API                    | Payment/registration delays                       | Retry logic with exponential backoff in payment service; monitoring alerts on Horizon error rates                                                                        | Medium                  | [#771] Add Horizon failover to secondary node  |
| **Elevation of Privilege** | Contract admin key used from API (if stored in env) | Full contract compromise                          | Admin key should NOT be stored in API env — contracts require `require_auth()` so the API cannot impersonate the admin                                                   | Medium if misconfigured | [#772] Audit that no admin keys are in API env |

### Boundary D: User Wallet ↔ Soroban Contracts

| Threat                     | Scenario                                                          | Impact                      | Current Mitigations                                                                                                                                                      | Residual Risk        | Follow-up                                                |
| -------------------------- | ----------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | -------------------------------------------------------- |
| **Spoofing**               | Attacker registers a worker under someone else's wallet address   | Identity theft              | `register()` requires `curator.require_auth()` (curator-gated); `owner` address is set at registration and immutable; wallet auth is required for all mutating functions | Low                  | —                                                        |
| **Tampering**              | Integer overflow in reward / fee calculations                     | Incorrect payouts           | All arithmetic uses Rust `checked_add`, `checked_sub`, `checked_mul`, `checked_div` with panic on overflow                                                               | Low                  | —                                                        |
| **Repudiation**            | Worker denies receiving a tip or escrow release                   | Unresolved payment dispute  | Every state change emits an event (`TipSent`, `EscRel`, `EscCnl`, etc.) — on-chain events are immutable; dispute contract provides formal arbitration path               | Low                  | —                                                        |
| **Information Disclosure** | Contract storage enumeration reveals reputation inputs            | Gaming of reputation system | `ReputationInputs` are stored on-chain and publicly readable by design (Soroban) — gating is considered but defered                                                      | Medium (accepted)    | [#773] Evaluate private reputation storage               |
| **Denial of Service**      | Gas griefing — attacker submits many micro-transactions           | Network fee spikes          | Soroban charges fees per operation; `batch_register` capped at 20; paginated read functions (`list_workers_paginated`, `list_workers_page`) prevent read-entry DoS       | Low                  | —                                                        |
| **Elevation of Privilege** | Curator or admin key compromise leads to unauthorised role grants | Full contract takeover      | RBAC with `require_role` on all privileged functions; `propose_upgrade` has 48-hour timelock; `ROLE_UPGRADER` should be a multisig in production                         | Critical if key lost | [#774] Implement multisig for all admin roles on mainnet |

### Boundary E: API ↔ Admin Panel

| Threat                     | Scenario                                              | Impact                     | Current Mitigations                                                                                                                  | Residual Risk | Follow-up                                             |
| -------------------------- | ----------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------- |
| **Spoofing**               | Stolen admin JWT used to access admin panel           | Full API admin access      | `authenticate` + `authorize('admin')` on all `/api/admin/*` routes; JWT expiry (7d); JTI revocation on logout                        | Medium        | [#767] httpOnly cookies                               |
| **Tampering**              | Admin performs destructive action (bulk delete, ban)  | Data loss                  | Admin routes are idempotent where possible; all admin actions logged to `AuditLog`; confirmation flows for destructive actions in UI | Low           | —                                                     |
| **Information Disclosure** | Admin exports user data CSV                           | Mass PII leak              | Export routes rate-limited (1/min); data includes only necessary fields; `sanitizeUser` strips sensitive fields                      | Medium        | [#775] Add admin action approval workflow for exports |
| **Denial of Service**      | Admin triggers expensive query (unpaginated list)     | DB performance degradation | Admin list endpoints use pagination (offset/limit); monitoring on query latency                                                      | Low           | —                                                     |
| **Elevation of Privilege** | Curator exploits admin panel bug to escalate to admin | Unauthorised admin access  | Role is server-verified via JWT + DB check on every request; no client-side role trust                                               | Low           | —                                                     |

### Boundary F: API ↔ S3/CDN (File Uploads)

| Threat                | Scenario                                         | Impact                         | Current Mitigations                                                                                                                                | Residual Risk | Follow-up |
| --------------------- | ------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------- |
| **Spoofing**          | Attacker uploads file impersonating another user | Unauthorised content           | Uploads gated by `authenticate` middleware; file ownership checked in controller                                                                   | Low           | —         |
| **Tampering**         | Malicious file upload (polyglot, SVG with XSS)   | Stored XSS / server compromise | Multer validates MIME type; Sharp re-encodes images (strips metadata); 5MB size limit; files served from separate CDN domain (no script execution) | Low           | —         |
| **Denial of Service** | Large file upload exhausts disk / memory         | Storage exhaustion             | 5MB limit; Sharp streams processing (no full-buffer); S3 has unlimited scale                                                                       | Low           | —         |

---

## Key Custody & Admin Powers

### Contract Admin Keys

| Role               | Power                                                            | Custody Recommendation               | Current Status                                            |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------- |
| `ROLE_ADMIN`       | Grant/revoke any role; set admin; migrate storage; withdraw fees | Hardware wallet (Ledger) or multisig | Single key on testnet; multisig planned for mainnet       |
| `ROLE_UPGRADER`    | Replace contract WASM (immediate or 48h timelock)                | Multisig (3-of-5)                    | Timelock is 48h on Registry; immediate on other contracts |
| `ROLE_PAUSER`      | Pause/unpause all contract operations                            | Separate key from admin              | Follows admin key currently                               |
| `ROLE_CURATOR_MGR` | Add/remove curators                                              | Admin-delegated                      | Admin holds this                                          |
| `ROLE_FEE_MANAGER` | Update protocol fee (max 500 bps)                                | Admin-delegated                      | Admin holds this                                          |
| `ROLE_CLAIMS_MGR`  | Approve/reject/pay insurance claims                              | Operational key                      | Separate from admin                                       |

### API Admin Powers

| Action                             | Gated By                              | Audit Trail                        |
| ---------------------------------- | ------------------------------------- | ---------------------------------- |
| User suspend / unsuspend / ban     | `authenticate` + `authorize('admin')` | `AuditLog` entry                   |
| Worker bulk toggle / delete        | Same                                  | `AuditLog` entry + idempotency key |
| User / worker CSV export           | Same + rate-limited (1/min)           | `AuditLog` entry                   |
| Worker CSV import                  | Same + Multer 5MB                     | `AuditLog` entry                   |
| Review moderation (approve/reject) | Same                                  | `AuditLog` entry                   |
| Dispute review                     | Same                                  | `AuditLog` entry                   |

### Key Rotation

| Secret             | Rotation Cadence           | Method                              | Impact                                               |
| ------------------ | -------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `JWT_SECRET`       | Quarterly or on compromise | Vault rotation script               | Invalidates all sessions — plan 24h migration window |
| Database password  | Monthly                    | Vault rotation script               | Brief connection drain on rotation                   |
| AWS credentials    | Every 90 days              | IAM key rotation                    | Requires pod restart                                 |
| Stellar admin keys | Only on compromise         | Transfer `set_admin` to new address | Instant — no downtime                                |

---

## Abuse Scenarios

### Scenario 1: Sybil Curator Attack

**Description**: A malicious curator registers fake worker profiles to spam the platform, boost fake reputations, or scam clients.

**Impact**: Low-quality listings erode trust; clients may send tips to fake workers.

**Mitigations**:

- Curators are added only by `ROLE_CURATOR_MGR` (a restricted admin role)
- Each registration requires `curator.require_auth()` — the Stellar network verifies the curator signed the transaction
- Off-chain: curator identity should be KYC'd before `add_curator` is called (process not in code)
- On-chain: `batch_register` capped at 20 workers per call to limit blast radius
- Reviews require a real authenticated user account; fake reviews can be flagged and moderated by admins

**Residual Risk**: Medium — if a curator key is compromised or a malicious actor becomes a curator, they can register unlimited workers until detected.

**Follow-up**: [#776] Add curator reputation/gatekeeping (e.g., bonding, time-locks, DAO vote).

### Scenario 2: Fake Listings & Impersonation

**Description**: An attacker creates a worker profile impersonating a real business or using stolen photos.

**Impact**: Fraud against clients; reputational damage to impersonated workers.

**Mitigations**:

- Curator-gated registration (not self-service)
- Location verification (`verify_location`) with expiry — can be challenged
- Category verification by curators with expiry
- Badge system allows trusted issuers to mark verified workers
- Off-chain: admin can suspend/ban users; workers can be bulk-deleted
- On-chain review system: low ratings auto-slash reputation (< 3000 bps)

**Residual Risk**: Medium — verification is optional; unverified workers can still be listed.

**Follow-up**: [#777] Mandate at least one verification type (location or category) before listing in search.

### Scenario 3: Admin Key Compromise

**Description**: Attacker gains access to a Stellar contract admin key (single point of failure).

**Impact**: Complete contract takeover — upgrade to malicious WASM, drain escrows, grant arbitrary roles.

**Mitigations**:

- `ROLE_UPGRADER` on Registry has a 48-hour timelock (anyone can monitor and cancel)
- All privileged functions require `require_auth()` — even admin must sign each call
- Recommended multisig setup for mainnet (not yet enforced in code)
- Admin transfer (`set_admin`) requires current admin auth

**Residual Risk**: Critical — without multisig, a single key compromise is catastrophic.

**Follow-up**: [#774] Implement on-chain multisig for admin roles before mainnet.

### Scenario 4: Escrow Abuse

**Description**: Payer creates escrow with insufficient expiry, then cancels before worker completes; or worker never releases escrow after job completion.

**Impact**: Worker unpaid for completed work; payer loses funds.

**Mitigations**:

- Either party can `release_escrow` (both `from` and `to` can trigger release)
- Payer can only `cancel_escrow` after expiry timestamp
- `cancel_expired_escrow` is callable by anyone (prevents stuck funds)
- Arbitration flow: either party can `request_arbitration` with an approved arbitrator
- Multi-sig escrows require threshold approvals before release

**Residual Risk**: Low — arbitration covers edge cases.

### Scenario 5: API Privilege Escalation

**Description**: A curator user exploits an API bug to perform admin actions.

**Impact**: Unauthorised data access, user bans, data export.

**Mitigations**:

- Role is signed into JWT at login (cannot be modified client-side)
- `authorize('admin')` middleware checks role on every request
- Roles map to numeric enums in DB; no inheritance ambiguity
- Admin routes are a separate file with explicit guards

**Residual Risk**: Low.

---

## Threat Tracking

| Ref                                              | Issue                                                        | Priority | Status |
| ------------------------------------------------ | ------------------------------------------------------------ | -------- | ------ |
| [#767](https://github.com/bluecollar/issues/767) | Migrate frontend to httpOnly cookies for JWT storage         | High     | Open   |
| [#768](https://github.com/bluecollar/issues/768) | Add Cloudflare / WAF rate limiting for global DDoS           | Medium   | Open   |
| [#769](https://github.com/bluecollar/issues/769) | Enable PostgreSQL audit logging                              | Medium   | Open   |
| [#770](https://github.com/bluecollar/issues/770) | Add connection pool autoscaling                              | Low      | Open   |
| [#771](https://github.com/bluecollar/issues/771) | Add Horizon failover to secondary node                       | Medium   | Open   |
| [#772](https://github.com/bluecollar/issues/772) | Audit that no admin keys are in API env                      | Critical | Open   |
| [#773](https://github.com/bluecollar/issues/773) | Evaluate private reputation storage on-chain                 | Low      | Open   |
| [#774](https://github.com/bluecollar/issues/774) | Implement multisig for all admin roles on mainnet            | Critical | Open   |
| [#775](https://github.com/bluecollar/issues/775) | Add admin action approval workflow for data exports          | Medium   | Open   |
| [#776](https://github.com/bluecollar/issues/776) | Add curator reputation / gatekeeping                         | Medium   | Open   |
| [#777](https://github.com/bluecollar/issues/777) | Mandate at least one verification type before search listing | Medium   | Open   |

---

## References

| Document                         | Link                                                                |
| -------------------------------- | ------------------------------------------------------------------- |
| Security Guide (developers)      | [SECURITY_GUIDE.md](./SECURITY_GUIDE.md)                            |
| Responsible Disclosure Policy    | [packages/api/SECURITY.md](../packages/api/SECURITY.md)             |
| Contract Security & Threat Model | [packages/contracts/SECURITY.md](../packages/contracts/SECURITY.md) |
| Incident Runbook                 | [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md)                        |
| Security Testing Guide           | [SECURITY_TESTING.md](./SECURITY_TESTING.md)                        |
| Security Audit Report            | [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)              |
| Secrets Management               | [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)                    |
| Rate Limiting                    | [RATE_LIMITING.md](./RATE_LIMITING.md)                              |
| Monitoring Setup                 | [MONITORING_SETUP.md](./MONITORING_SETUP.md)                        |
| Smart Contract Reference         | [CONTRACTS.md](./CONTRACTS.md)                                      |

---

> **Maintenance**: This threat model should be reviewed quarterly and updated whenever a new trust boundary is introduced, a new contract is deployed, or a significant security control changes.

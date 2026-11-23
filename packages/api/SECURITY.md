# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue.**

Email: **security@bluecollar.dev** — PGP key available on request.

Include: description, reproduction steps, impact, and optional fix.

### Response SLAs

| Stage            | SLA      |
| ---------------- | -------- |
| Acknowledgement  | 48 hours |
| Status update    | 7 days   |
| Patch (critical) | 30 days  |
| Patch (others)   | 90 days  |

Reporter credit in release notes upon request.

## Security Controls

| Control            | Implementation                                               |
| ------------------ | ------------------------------------------------------------ |
| Rate limiting      | express-rate-limit + Redis per-IP (default 100 req / 15 min) |
| CORS               | `ALLOWED_ORIGINS` allowlist                                  |
| Helmet             | HTTP security headers via `helmet`                           |
| Input sanitisation | Recursive XSS strip on `req.body` / `req.query` via `xss`    |
| Auth               | JWT (`JWT_SECRET`); Google OAuth via PKCE                    |
| Secrets            | HashiCorp Vault in production                                |

## Known Limitations & Accepted Risks

- Recognition-only programme — no monetary payouts
- Third-party Stellar / Horizon infrastructure is out of scope
- Network-level DoS is out of scope

## Bug Bounty Scope

**In scope**

- `packages/api` — REST endpoints and middleware
- `packages/contracts` — Registry and Market Soroban contracts
- `packages/app` — Next.js frontend (XSS, auth bypass, wallet leaks)

**Out of scope**

- Third-party dependency vulnerabilities (report upstream)
- Social engineering
- Denial-of-service / volumetric attacks
- Attacks requiring physical device access

# Security Guide

Security considerations for developers and users of the BlueCollar platform.

---

## Table of Contents

- [JWT Token Handling](#jwt-token-handling)
- [Password Requirements and Hashing](#password-requirements-and-hashing)
- [Wallet Security](#wallet-security)
- [CORS and CSP Policies](#cors-and-csp-policies)
- [Common Security Pitfalls](#common-security-pitfalls)

---

## JWT Token Handling

### How tokens are issued

After a successful login or Google OAuth callback, the API returns a signed JWT:

```json
{
  "status": "success",
  "token": "<jwt>",
  "data": { "id": "...", "role": "user" }
}
```

The token payload contains `{ id, role }` and is signed with `JWT_SECRET` using the default HS256 algorithm. Tokens expire after **7 days**.

### Sending tokens

All authenticated endpoints require the token in the `Authorization` header:

```
Authorization: Bearer <jwt>
```

### Best practices for developers

- **Never log tokens.** Avoid logging the `Authorization` header or the raw token string.
- **Use HTTPS in production.** Tokens sent over plain HTTP can be intercepted.
- **Store tokens securely on the client.** Prefer `httpOnly` cookies or secure in-memory storage over `localStorage`, which is accessible to JavaScript and vulnerable to XSS.
- **Validate on every request.** The `authenticate` middleware verifies the signature and expiry on every protected route — do not skip it.
- **Rotate `JWT_SECRET` carefully.** Changing the secret invalidates all existing tokens. Plan a migration window if rotating in production.
- **Keep `JWT_SECRET` strong.** Use at least 32 random bytes. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### Verification and email tokens

Email verification and password reset tokens are short-lived JWTs (24h and 1h respectively). The raw token is sent to the user's email; only its **SHA-256 hash** is stored in the database. This means a database breach does not expose usable tokens.

```
raw token  →  SHA-256  →  stored in DB
raw token  ←  email link  ←  sent to user
```

On verification, the API hashes the incoming token and compares it to the stored hash — the raw token never touches the database.

---

## Password Requirements and Hashing

### Hashing algorithm

Passwords are hashed with **Argon2id** via the [`argon2`](https://www.npmjs.com/package/argon2) npm package. Argon2id is the current OWASP-recommended algorithm for password hashing — it is memory-hard and resistant to GPU and side-channel attacks.

```ts
// Hashing on registration / password reset
const hashed = await argon2.hash(password);

// Verification on login
const valid = await argon2.verify(user.password, password);
```

The library uses secure defaults (memory cost, time cost, parallelism) automatically. No manual salt management is required — Argon2 handles salting internally.

### Password requirements

The API enforces the following minimum requirements at the validation layer:

- Minimum **8 characters**
- No maximum length restriction (Argon2 handles long inputs safely)

For stronger security, encourage users to use a passphrase or a password manager.

### OAuth users

Users who sign in via Google OAuth have `password: null` in the database. They cannot use the email/password login flow. If a Google account is linked to an existing email account, the `googleId` is attached and the account is marked as verified — no password change occurs.

### Developer checklist

- Never store plaintext passwords or reversible hashes (MD5, SHA-1, bcrypt with low cost).
- Never log passwords, even in debug mode.
- Always use `argon2.verify` for comparison — never compare hashes directly with `===`.
- The `sanitizeUser` helper strips `password`, `verificationToken`, `resetToken`, and related fields before any user object is returned in an API response.

---

## Wallet Security

### On-chain interactions

The Market and Registry Soroban contracts use `require_auth()` on every mutating function. This means the Stellar network enforces that the caller's keypair has signed the transaction — there is no way to bypass this at the contract level.

### Wallet address storage

`walletAddress` is stored as a plain string on both `User` and `Worker` models. It is used for display and for routing on-chain payments — it is not used for authentication.

### Recommendations for users

- **Use Freighter or a hardware wallet.** Never paste your secret key into any web form.
- **Keep your secret key offline.** The BlueCollar app only ever requests your public address and transaction signatures — it never asks for your secret key.
- **Verify transaction details before signing.** Always check the recipient address and amount in your wallet before approving a tip or escrow transaction.
- **Use testnet first.** Test payment flows on Stellar testnet before using real funds on mainnet.

### Recommendations for developers

- Never store or log Stellar secret keys.
- The `walletAddress` field should only be updated by the authenticated user who owns the account.
- Escrow funds are held by the Market contract address, not by any individual keypair. Only `release_escrow` and `cancel_escrow` can move them — both require the appropriate party's signature.
- The protocol fee is hard-capped at 500 bps (5%) in the contract source and cannot be bypassed by an admin.

---

## CORS and CSP Policies

### CORS

CORS behaviour differs between environments:

| Environment                               | Behaviour                                              |
| ----------------------------------------- | ------------------------------------------------------ |
| Development (`NODE_ENV !== 'production'`) | All origins allowed (`*`)                              |
| Production                                | Only origins listed in `ALLOWED_ORIGINS` are permitted |

Configure allowed origins in `packages/api/.env`:

```
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
```

Requests with no `Origin` header (e.g. mobile apps, server-to-server, curl) are always allowed in production.

**Developer note:** Never deploy with `NODE_ENV` unset or set to anything other than `production` in a production environment — doing so opens the API to all origins.

### Content Security Policy (CSP)

The API uses [Helmet](https://helmetjs.github.io/) with a strict CSP. Because the API serves only JSON (no HTML), the policy is intentionally restrictive:

```
Content-Security-Policy:
  default-src 'none';
  base-uri 'none';
  form-action 'none';
  frame-ancestors 'none';
```

This means:

- No scripts, styles, images, or frames can be loaded from this origin.
- The API cannot be embedded in an iframe (`frame-ancestors 'none'`).
- Form submissions to this origin are blocked (`form-action 'none'`).

These headers are set by Helmet automatically on every response.

### Other security headers set by Helmet

| Header                      | Value                                 |
| --------------------------- | ------------------------------------- |
| `X-Content-Type-Options`    | `nosniff`                             |
| `X-Frame-Options`           | `DENY`                                |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` |
| `X-DNS-Prefetch-Control`    | `off`                                 |
| `Referrer-Policy`           | `no-referrer`                         |

---

## Common Security Pitfalls

### 1. Weak or missing `JWT_SECRET`

A short or predictable secret allows attackers to forge tokens. Always use a cryptographically random secret of at least 32 bytes. The API will throw at startup if `JWT_SECRET` is missing.

### 2. Skipping email verification

The login endpoint returns `403` if the account is not verified. Do not remove this check — it prevents account takeover via email enumeration and ensures the user controls the email address.

### 3. Exposing sensitive fields in API responses

The `sanitizeUser` helper removes `password`, `verificationToken`, `verificationTokenExpiry`, `resetToken`, and `resetTokenExpiry` from user objects. Always use it before returning user data. Never return the raw Prisma `User` object directly.

### 4. Misconfigured CORS in production

Leaving `NODE_ENV` unset in production causes the API to accept requests from any origin. Always set `NODE_ENV=production` and configure `ALLOWED_ORIGINS` explicitly.

### 5. Storing tokens in `localStorage`

`localStorage` is accessible to any JavaScript running on the page, making it vulnerable to XSS attacks. Prefer `httpOnly` cookies or in-memory storage for JWTs on the frontend.

### 6. Not rate-limiting auth endpoints

The `authRateLimiter` middleware is applied to sensitive auth routes. Do not remove it. If you add new sensitive endpoints (e.g. OTP verification), apply the rate limiter there too.

### 7. Logging sensitive data

Avoid logging request bodies on auth endpoints. The Pino HTTP logger is configured at the app level — ensure it does not capture `password`, `token`, or `Authorization` header values in production logs.

### 8. Unvalidated file uploads

The upload middleware uses Multer with Sharp for image processing. Always validate MIME type and file size. Never serve uploaded files from the same origin as the API without proper content-type headers.

### 9. SQL injection via Prisma

Prisma uses parameterised queries by default. Avoid using `$queryRaw` with string interpolation. If raw queries are necessary, always use tagged template literals:

```ts
// Safe
await db.$queryRaw`SELECT * FROM users WHERE email = ${email}`;

// Unsafe — never do this
await db.$queryRaw(`SELECT * FROM users WHERE email = '${email}'`);
```

### 10. Admin key compromise (Stellar contracts)

The Stellar contract admin key controls upgrades, role management, curator management, fee configuration, and contract migration. Compromise of this key is the primary risk for the on-chain components. Protect it with a hardware wallet or multisig setup, and never store it in environment variables on a shared server.

See the [Threat Model](./THREAT_MODEL.md#key-custody--admin-powers) for a full breakdown of admin powers, key custody recommendations, and rotation cadences.

---

## Cross-References

| Document                                                            | Content                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [THREAT_MODEL.md](./THREAT_MODEL.md)                                | Full STRIDE threat model covering all trust boundaries (API, DB, contracts, wallet) |
| [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)              | Internal smart contract audit findings                                              |
| [SECURITY_TESTING.md](./SECURITY_TESTING.md)                        | Security test strategy (unit, DAST, dependency scan, secret scan)                   |
| [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md)                        | Production incident response procedures                                             |
| [packages/api/SECURITY.md](../packages/api/SECURITY.md)             | Responsible disclosure policy (`security@bluecollar.dev`)                           |
| [packages/contracts/SECURITY.md](../packages/contracts/SECURITY.md) | Contract-specific threat model & access control matrix                              |
| [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)                    | Vault-based secrets lifecycle                                                       |

# BlueCollar Public API Reference

This document provides the authoritative reference for all public HTTP REST endpoints exposed by `@bluecollar/api`, the OpenAPI 3.1 specification, authentication mechanisms, and API versioning policy.

---

## 1. Specification & Interactive Documentation

The canonical machine-readable specification is maintained in OpenAPI 3.1 format:

- **Source File**: [`packages/api/openapi.json`](../../packages/api/openapi.json)
- **Local Swagger UI (v1)**: `http://localhost:3000/api/v1/docs` (served in development/staging)
- **Local Swagger UI (v2)**: `http://localhost:3000/api/v2/docs`
- **Legacy / Unversioned Swagger UI**: `http://localhost:3000/api/docs`
- **Raw JSON Spec**: `http://localhost:3000/api/v1/docs/openapi.json`

### Code-First Spec Generation

The OpenAPI specification is generated directly from TypeScript route handlers and Zod validation schemas to prevent documentation drift:

```bash
# Generate openapi.json from route definitions
pnpm --filter @bluecollar/api openapi:generate
```

CI runs automated synchronization tests (`packages/api/src/__tests__/openapi-sync.test.ts`) to verify that all registered Express routes are documented in the OpenAPI schema.

---

## 2. API Versioning Policy

BlueCollar follows a predictable, backward-compatible API lifecycle governed by the following rules:

### 2.1 URI Path Versioning
- **Active Version**: `/api/v1/` is the primary stable API prefix.
- **Next Version / Candidate**: `/api/v2/` hosts new breaking features under gradual rollout.
- **Unversioned Prefix (`/api/*`)**: Marked as **deprecated**. Legacy endpoints under `/api/*` are retained for backward compatibility during transition but will be decommissioned.

### 2.2 Version Deprecation & Sunset Headers
When deprecated routes or versions are accessed, the API attaches standard HTTP deprecation headers:
- `X-API-Deprecation-Warning: 1`
- `Sunset: <HTTP-date>` (RFC 8594 standard sunset date)
- `Link: </docs/API_VERSIONING.md>; rel="sunset"`

### 2.3 Breaking Changes & Rollout
- Non-breaking changes (new optional fields, new endpoints) are added directly to the active version (`v1`).
- Breaking changes (field removals, type alterations, mandatory new fields) require a new major version prefix (`v2`).
- The API supports dynamic feature flags and gradual version rollout percentages (see `packages/api/src/utils/versionRollout.ts`).

---

## 3. Request & Response Standards

### 3.1 Standard Response Envelope
All JSON responses follow a consistent envelope structure:

**Success Response (HTTP 200/201):**
```json
{
  "status": "success",
  "code": 200,
  "data": { ... }
}
```

**Error Response (HTTP 4xx/5xx):**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "email": ["The email field is required."]
  }
}
```

### 3.2 Authentication & Security
- **Bearer Authentication**: Protected endpoints require `Authorization: Bearer <jwt_access_token>`.
- **Two-Factor Authentication (2FA)**: Time-based One-Time Password (TOTP) supported for account security.
- **Session Management**: Device session tracking and token revocation.
- **Rate Limiting**: Tiered IP and user-based rate limiters per endpoint.

### 3.3 The `X-HTTP-Method` Override Pattern
For `multipart/form-data` uploads (avatar, portfolio images) where client browser forms are constrained to `POST`, send:
- `POST /api/v1/workers/{id}`
- Header: `X-HTTP-Method: PUT` (or `PATCH`)

---

## 4. Endpoint Inventory by Domain

### 4.1 Authentication (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | None | Register a new user account |
| `POST` | `/api/v1/auth/login` | None | Authenticate with email/password and obtain JWT tokens |
| `DELETE` | `/api/v1/auth/logout` | Bearer | Invalidate refresh tokens and session |
| `GET` | `/api/v1/auth/me` | Bearer | Get current authenticated user profile |
| `POST` | `/api/v1/auth/refresh` | None | Refresh access token using refresh token |
| `POST` | `/api/v1/auth/forgot-password` | None | Request password reset email |
| `POST` | `/api/v1/auth/reset-password` | None | Reset password using reset token |
| `PUT` | `/api/v1/auth/verify-account` | None | Verify email address |
| `POST` | `/api/v1/auth/resend-verification` | None | Resend verification email |
| `POST` | `/api/v1/auth/enable-2fa` | Bearer | Initiate 2FA TOTP setup and return secret QR code |
| `POST` | `/api/v1/auth/verify-2fa` | Bearer | Verify TOTP code and enable 2FA |
| `POST` | `/api/v1/auth/disable-2fa` | Bearer | Disable 2FA |
| `GET` | `/api/v1/auth/google` | None | Initiate Google OAuth 2.0 flow |
| `GET` | `/api/v1/auth/google/callback` | None | Google OAuth 2.0 callback |
| `GET` | `/api/v1/auth/devices` | Bearer | List active device sessions |
| `DELETE` | `/api/v1/auth/devices/:id` | Bearer | Revoke specific device session |

### 4.2 Workers & Directory (`/api/v1/workers`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/workers` | None | Search and filter workers (query params: `category`, `location`, `rating`, `page`, `limit`) |
| `GET` | `/api/v1/workers/:id` | None | Get detailed worker profile |
| `POST` | `/api/v1/workers` | Bearer | Create a worker profile |
| `PUT` | `/api/v1/workers/:id` | Bearer | Update worker profile (supports `X-HTTP-Method` for multipart uploads) |
| `DELETE` | `/api/v1/workers/:id` | Bearer | Delete worker profile |
| `POST` | `/api/v1/workers/:id/favorite` | Bearer | Add worker to user favorites |
| `DELETE` | `/api/v1/workers/:id/favorite` | Bearer | Remove worker from favorites |
| `GET` | `/api/v1/workers/:id/reviews` | None | List paginated reviews for a worker |
| `GET` | `/api/v1/workers/:id/insurance` | None | Check worker insurance pool status |
| `POST` | `/api/v1/workers/:id/insurance/claim` | Bearer | Submit insurance claim against worker bond |
| `GET` | `/api/workers/:workerId/portfolio` | None | List worker portfolio items |
| `POST` | `/api/workers/:workerId/portfolio` | Bearer | Upload new portfolio item |
| `DELETE` | `/api/workers/:workerId/portfolio/:itemId` | Bearer | Delete portfolio item |
| `GET` | `/api/workers/events` | None | Query on-chain worker registration/status events |

### 4.3 Categories (`/api/v1/categories`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/categories` | None | List all service categories |
| `GET` | `/api/v1/categories/:id` | None | Get category details |
| `POST` | `/api/v1/categories` | Admin | Create a service category |
| `PUT` | `/api/v1/categories/:id` | Admin | Update service category |
| `DELETE` | `/api/v1/categories/:id` | Admin | Delete service category |

### 4.4 Users (`/api/v1/users`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/users/profile` | Bearer | Get current user's profile |
| `PUT` | `/api/v1/users/profile` | Bearer | Update user profile details |
| `GET` | `/api/v1/users/favorites` | Bearer | Get list of bookmarked workers |

### 4.5 Bookings & Jobs (`/api/v1/bookings`, `/api/v1/jobs`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/bookings` | Bearer | List user or worker bookings |
| `GET` | `/api/v1/bookings/:id` | Bearer | Get booking details |
| `POST` | `/api/v1/bookings` | Bearer | Create a new service booking |
| `PUT` | `/api/v1/bookings/:id/status` | Bearer | Update booking status (`accepted`, `rejected`, `completed`, `cancelled`) |
| `GET` | `/api/v1/jobs` | None | List public job postings |
| `POST` | `/api/v1/jobs` | Bearer | Post a new job request |
| `GET` | `/api/v1/jobs/:id` | None | Get job posting details |
| `PUT` | `/api/v1/jobs/:id` | Bearer | Update job posting |
| `DELETE` | `/api/v1/jobs/:id` | Bearer | Remove job posting |

### 4.6 Payments, Escrow & Wallet (`/api/v1/payments`, `/api/escrow`, `/api/wallet`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/payments` | Bearer | Process off-chain or fiat payment intent |
| `GET` | `/api/v1/payments/:id` | Bearer | Get payment status |
| `GET` | `/api/escrow` | Bearer | Query on-chain escrow records |
| `POST` | `/api/escrow` | Bearer | Create on-chain escrow record |
| `GET` | `/api/escrow/:id` | Bearer | Get escrow details |
| `POST` | `/api/escrow/:id/release` | Bearer | Release escrow funds to worker |
| `POST` | `/api/escrow/:id/refund` | Bearer | Refund escrow funds to client |
| `GET` | `/api/wallet/:address` | None | Query Stellar account balances, trustlines, and sequence |
| `POST` | `/api/wallet/broadcast` | None | Broadcast signed Stellar transaction XDR |

### 4.7 Disputes & Arbitration (`/api/v1/disputes`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/disputes` | Bearer | List disputes associated with user |
| `POST` | `/api/v1/disputes` | Bearer | File a new dispute for a job/escrow |
| `GET` | `/api/v1/disputes/:id` | Bearer | Get dispute status and evidence records |
| `POST` | `/api/v1/disputes/:id/evidence` | Bearer | Submit dispute evidence |
| `POST` | `/api/v1/disputes/:id/resolve` | Admin/Arb | Resolve dispute and trigger on-chain settlement |

### 4.8 Reviews & Recommendations (`/api/v1/reviews`, `/api/v1/recommendations`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/reviews` | Bearer | Submit worker review and rating |
| `GET` | `/api/v1/reviews/:id` | None | Get single review |
| `POST` | `/api/reviews/:id/helpful` | Bearer | Vote review as helpful |
| `GET` | `/api/v1/recommendations` | Bearer | Get AI/rule-based personalized worker recommendations |

### 4.9 Notifications, Messages & Preferences

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Bearer | List user notifications |
| `PATCH` | `/api/v1/notifications/:id/read` | Bearer | Mark notification as read |
| `GET` | `/api/notifications/preferences` | Bearer | Get notification preferences |
| `PUT` | `/api/notifications/preferences` | Bearer | Update notification channels (email, push, SMS) |
| `GET` | `/api/messages/:conversationId` | Bearer | Fetch conversation messages |
| `POST` | `/api/messages` | Bearer | Send message in booking/job conversation |

### 4.10 Platform Administration & System Telemetry

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/users` | Admin | Search and manage registered users |
| `GET` | `/api/v1/admin/analytics` | Admin | Get platform transaction, escrow, and volume analytics |
| `GET` | `/api/v1/audit` | Admin | Query security audit log trail |
| `GET` | `/api/v1/referrals/stats` | Bearer | Get user referral code and statistics |
| `POST` | `/api/v1/referrals/claim` | Bearer | Claim referral rewards |
| `GET` | `/api/events` | None | Query indexed Soroban smart contract events |
| `GET` | `/api/vitals` | None | Liveness and health check endpoint |
| `GET` | `/api/response-time` | None | Latency metrics and telemetry |
| `POST` | `/api/v1/webhooks/stellar` | HMAC | Ingest Stellar Horizon event callbacks |

---

## 5. Related Documentation

- [API Versioning Policy & Lifecycle](../API_VERSIONING.md)
- [Monorepo Package Boundaries (ADR 0001)](../adr/0001-monorepo-package-boundaries.md)
- [Local Developer Setup](./setup.md)
- [OpenAPI 3.1 Spec Source](../../packages/api/openapi.json)

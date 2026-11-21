# Blue-Collar API Reference

> **Generated file — do not edit by hand.**
> This document is generated from the OpenAPI specification by
> `packages/api/src/scripts/generate-openapi.ts`.
> Regenerate it with:
>
> ```bash
> pnpm --filter @bluecollar/api openapi:generate
> ```
>
> For an interactive, always-up-to-date reference, see the live Swagger UI at
> [`/docs`](/docs).

## Introduction

The Blue-Collar API is a RESTful JSON API that powers the Blue-Collar platform:
worker profiles, job postings, matching, wallets, payments, and messaging.
All request and response bodies are JSON (`application/json`) unless otherwise
noted. Schemas are defined with [Zod](https://zod.dev) and exported to OpenAPI
via [`zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi).

## Base URLs

| Environment | Base URL |
| ----------- | -------- |
| Local       | `http://localhost:3000/api` |
| Staging     | `https://staging-api.bluecollar.example/api` |
| Production  | `https://api.bluecollar.example/api` |

All endpoints below are relative to the base URL (e.g. `POST /auth/login`
resolves to `https://api.bluecollar.example/api/auth/login`).

## Authentication

The API uses short-lived **access tokens** (JWT, Bearer) plus long-lived
**refresh tokens** (rotating, stored server-side). Most endpoints require a
valid access token; endpoints marked **Public** do not.

### Token usage

Send the access token in the `Authorization` header on every protected request:

```http
Authorization: Bearer <access_token>
```

Access tokens expire after **15 minutes**. When a request returns `401` with
code `TOKEN_EXPIRED`, refresh the token (see below) and retry once.

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "worker@example.com",
  "password": "correct-horse-battery-staple"
}
```

Successful response (`200`):

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "rt_9f8c...",
  "expiresIn": 900,
  "tokenType": "Bearer",
  "user": {
    "id": "usr_123",
    "email": "worker@example.com",
    "role": "WORKER",
    "twoFactorEnabled": false
  }
}
```

If the account has 2FA enabled, the response is `200` with
`"twoFactorRequired": true` and a short-lived `challengeToken` instead of
tokens. Complete the flow via `POST /auth/2fa/verify` (see below).

### Refresh

Exchange a valid refresh token for a new access/refresh pair. Refresh tokens
are **single-use** and rotate on every call; reusing a consumed token revokes
the whole session family.

```http
POST /auth/refresh
Content-Type: application/json

{ "refreshToken": "rt_9f8c..." }
```

Response (`200`) has the same shape as login (without `user`).

### Logout

Revokes the current refresh token (and optionally all sessions).

```http
POST /auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{ "refreshToken": "rt_9f8c...", "allSessions": false }
```

Response: `204 No Content`.

### Two-factor authentication (2FA)

1. `POST /auth/login` returns `{ "twoFactorRequired": true, "challengeToken": "..." }`.
2. `POST /auth/2fa/verify` with `{ "challengeToken": "...", "code": "123456" }`
   returns the standard token pair.
3. Recovery codes may be used in place of `code` via `POST /auth/2fa/recover`.

2FA can be enabled/disabled from an authenticated session via
`POST /auth/2fa/enable` and `POST /auth/2fa/disable`.

### Auth flow summary

```
login ──► (2FA required?) ──► 2fa/verify ──► access + refresh tokens
   │                                              │
   └──────────────► access + refresh tokens ◄─────┘
                          │
        protected request │ Authorization: Bearer <access>
                          ▼
                  401 TOKEN_EXPIRED ──► POST /auth/refresh ──► retry
                          │
                          ▼
                   POST /auth/logout (revoke refresh token)
```

## Endpoint reference

Endpoints are grouped by OpenAPI tag. **Auth** column: `Public` = no token
required; `Bearer` = access token required; `Bearer (role)` = token plus role.

### Auth

| Method | Path | Summary | Auth |
| ------ | ---- | ------- | ---- |
| `POST` | `/auth/register` | Create a new account | Public |
| `POST` | `/auth/login` | Authenticate and obtain tokens (or 2FA challenge) | Public |
| `POST` | `/auth/refresh` | Rotate refresh token, issue new access token | Public |
| `POST` | `/auth/logout` | Revoke refresh token / all sessions | Bearer |
| `POST` | `/auth/2fa/verify` | Complete 2FA challenge | Public |
| `POST` | `/auth/2fa/recover` | Complete 2FA using a recovery code | Public |
| `POST` | `/auth/2fa/enable` | Enable 2FA for the current user | Bearer |
| `POST` | `/auth/2fa/disable` | Disable 2FA for the current user | Bearer |
| `GET`  | `/auth/me` | Get the authenticated user | Bearer |

**`POST /auth/register`** — request `RegisterRequest`:

```json
{
  "email": "worker@example.com",
  "password": "min-12-chars",
  "name": "Ada Lovelace",
  "role": "WORKER"
}
```

Response `201` → `AuthTokens` (same shape as login). Errors: `409 EMAIL_TAKEN`,
`422 VALIDATION_ERROR`.

**`POST /auth/login`** — request `LoginRequest`:

```json
{ "email": "worker@example.com", "password": "..." }
```

Response `200` → `AuthTokens` or `TwoFactorChallenge`. Errors:
`401 INVALID_CREDENTIALS`, `423 ACCOUNT_LOCKED`.

**`POST /auth/refresh`** — request `RefreshRequest`:

```json
{ "refreshToken": "rt_..." }
```

Response `200` → `AuthTokens`. Errors: `401 INVALID_REFRESH_TOKEN`,
`401 REFRESH_TOKEN_REUSED`.

**`POST /auth/logout`** — request `LogoutRequest`:

```json
{ "refreshToken": "rt_...", "allSessions": false }
```

Response `204`. Errors: `401 UNAUTHORIZED`.

**`POST /auth/2fa/verify`** — request `TwoFactorVerifyRequest`:

```json
{ "challengeToken": "...", "code": "123456" }
```

Response `200` → `AuthTokens`. Errors: `401 INVALID_2FA_CODE`,
`410 CHALLENGE_EXPIRED`.

**`GET /auth/me`** — response `200` → `User`:

```json
{
  "id": "usr_123",
  "email": "worker@example.com",
  "name": "Ada Lovelace",
  "role": "WORKER",
  "twoFactorEnabled": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Workers

| Method | Path | Summary | Auth |
| ------ | ---- | ------- | ---- |
| `GET`    | `/workers` | List workers (paginated, filterable) | Public |
| `GET`    | `/workers/{id}` | Get a worker profile | Public |
| `POST`   | `/workers` | Create the current user's worker profile | Bearer (WORKER) |
| `PATCH`  | `/workers/{id}` | Update a worker profile | Bearer (owner) |
| `DELETE` | `/workers/{id}` | Delete a worker profile | Bearer (owner) |
| `GET`    | `/workers/{id}/reviews` | List reviews for a worker | Public |

**`GET /workers`** — query params: `page` (int, default 1), `limit`
(int, default 20, max 100), `skill` (string), `location` (string),
`minRating` (number). Response `200` → `Paginated<Worker>`:

```json
{
  "items": [
    {
      "id": "wrk_123",
      "userId": "usr_123",
      "name": "Ada Lovelace",
      "skills": ["plumbing", "electrical"],
      "rating": 4.8,
      "location": "Berlin",
      "hourlyRate": 45
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 137
}
```

**`POST /workers`** — request `CreateWorkerRequest`:

```json
{
  "skills": ["plumbing"],
  "location": "Berlin",
  "hourlyRate": 45,
  "bio": "Licensed plumber, 10 years experience."
}
```

Response `201` → `Worker`. Errors: `409 PROFILE_EXISTS`,
`422 VALIDATION_ERROR`.

**`PATCH /workers/{id}`** — request `UpdateWorkerRequest` (all fields
optional, same shape as create). Response `200` → `Worker`. Errors:
`403 FORBIDDEN`, `404 NOT_FOUND`.

### Jobs

| Method | Path | Summary | Auth |
| ------ | ---- | ------- | ---- |
| `GET`    | `/jobs` | List open jobs | Public |
| `GET`    | `/jobs/{id}` | Get a job posting | Public |
| `POST`   | `/jobs` | Create a job posting | Bearer (CLIENT) |
| `PATCH`  | `/jobs/{id}` | Update a job posting | Bearer (owner) |
| `DELETE` | `/jobs/{id}` | Close/delete a job posting | Bearer (owner) |
| `POST`   | `/jobs/{id}/apply` | Apply to a job | Bearer (WORKER) |

**`POST /jobs`** — request `CreateJobRequest`:

```json
{
  "title": "Fix leaking kitchen sink",
  "description": "Sink under the counter leaks when running.",
  "budget": 120,
  "location": "Berlin",
  "skills": ["plumbing"]
}
```

Response `201` → `Job`. Errors: `422 VALIDATION_ERROR`.

**`POST /jobs/{id}/apply`** — request `ApplyRequest`:

```json
{ "message": "Available tomorrow morning.", "quote": 100 }
```

Response `201` → `Application`. Errors: `409 ALREADY_APPLIED`,
`404 NOT_FOUND`.

### Wallet

| Method | Path | Summary | Auth |
| ------ | ---- | ------- | ---- |
| `GET`  | `/wallet` | Get the current user's wallet balance | Bearer |
| `GET`  | `/wallet/transactions` | List wallet transactions | Bearer |
| `POST` | `/wallet/deposit` | Create a deposit (top-up) | Bearer |
| `POST` | `/wallet/withdraw` | Request a withdrawal | Bearer |
| `POST` | `/wallet/transfer` | Transfer funds to another user | Bearer |

**`GET /wallet`** — response `200` → `Wallet`:

```json
{
  "id": "wal_123",
  "userId": "usr_123",
  "balance": 25000,
  "currency": "EUR",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

Amounts are integers in the smallest currency unit (cents).

**`POST /wallet/deposit`** — request `DepositRequest`:

```json
{ "amount": 5000, "currency": "EUR", "paymentMethodId": "pm_123" }
```

Response `201` → `Transaction`. Errors: `402 PAYMENT_FAILED`,
`422 VALIDATION_ERROR`.

**`POST /wallet/transfer`** — request `TransferRequest`:

```json
{ "toUserId": "usr_456", "amount": 1000, "note": "Job #42" }
```

Response `201` → `Transaction`. Errors: `402 INSUFFICIENT_FUNDS`,
`404 NOT_FOUND`.

### Payments

| Method | Path | Summary | Auth |
| ------ | ---- | ------- | ---- |
| `POST` | `/payments/intent` | Create a payment intent for a job | Bearer |
| `GET`  | `/payments/{id}` | Get payment status | Bearer (owner) |
| `POST` | `/payments/{id}/refund` | Refund a payment | Bearer (CLIENT) |

**`POST /payments/intent`** — request `PaymentIntentRequest`:

```json
{ "jobId": "job_123", "amount": 12000, "currency": "EUR" }
```

Response `201` → `PaymentIntent`:

```json
{
  "id": "pi_123",
  "clientSecret": "pi_123_secret_...",
  "amount": 12000,
  "currency": "EUR",
  "status": "REQUIRES_CONFIRMATION"
}
```

### Messages

| Method | Path | Summary | Auth |
| ------ | ---- | ------- | ---- |
| `GET`  | `/conversations` | List the current user's conversations | Bearer |
| `GET`  | `/conversations/{id}/messages` | List messages in a conversation | Bearer (participant) |
| `POST` | `/conversations/{id}/messages` | Send a message | Bearer (participant) |

**`POST /conversations/{id}/messages`** — request `SendMessageRequest`:

```json
{ "body": "See you at 9am." }
```

Response `201` → `Message`:

```json
{
  "id": "msg_123",
  "conversationId": "cnv_123",
  "senderId": "usr_123",
  "body": "See you at 9am.",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Reviews

| Method | Path | Summary | Auth |
| ------ | ---- | ------- | ---- |
| `POST` | `/reviews` | Create a review for a completed job | Bearer |
| `GET`  | `/reviews/{id}` | Get a review | Public |

**`POST /reviews`** — request `CreateReviewRequest`:

```json
{ "jobId": "job_123", "rating": 5, "comment": "Great work!" }
```

Response `201` → `Review`. Errors: `409 ALREADY_REVIEWED`,
`422 VALIDATION_ERROR`.

### Health

| Method | Path | Summary | Auth |
| ------ | ---- | ------- | ---- |
| `GET` | `/health` | Liveness/readiness probe | Public |

Response `200` → `{ "status": "ok", "version": "1.0.0" }`.

## Error format

All errors use a consistent envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body is invalid.",
    "details": [
      { "path": "email", "message": "Invalid email address" }
    ],
    "requestId": "req_01H..."
  }
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `error.code` | string | Stable machine-readable error code |
| `error.message` | string | Human-readable message |
| `error.details` | array? | Optional field-level details (validation) |
| `error.requestId` | string | Correlation ID; include when contacting support |

### Common status codes

| Status | Meaning |
| ------ | ------- |
| `400` | Malformed request |
| `401` | Missing/invalid/expired token (`UNAUTHORIZED`, `TOKEN_EXPIRED`) |
| `403` | Authenticated but not permitted (`FORBIDDEN`) |
| `404` | Resource not found (`NOT_FOUND`) |
| `409` | Conflict (`EMAIL_TAKEN`, `ALREADY_APPLIED`, …) |
| `422` | Validation failed (`VALIDATION_ERROR`) |
| `429` | Rate limited (`RATE_LIMITED`) — respect `Retry-After` |
| `500` | Internal server error (`INTERNAL_ERROR`) |

## Regenerating this document

This file is produced by `packages/api/src/scripts/generate-openapi.ts`, which
builds the OpenAPI document from the Zod schemas registered with
`zod-to-openapi` and renders it to Markdown. To update it after changing any
route or schema:

```bash
pnpm --filter @bluecollar/api openapi:generate
```

The same script writes the machine-readable spec consumed by the Swagger UI
served at [`/docs`](/docs).
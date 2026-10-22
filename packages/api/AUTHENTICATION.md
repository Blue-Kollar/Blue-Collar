# Authentication

How to authenticate against the BlueCollar API. This consolidates and supersedes the
auth notes scattered across `README.md` / `SECURITY.md` and covers the flows that
weren't documented anywhere before: refresh tokens, 2FA, and device sessions.

## Overview

| Mechanism | Used for |
|---|---|
| JWT bearer token | All authenticated REST requests |
| Refresh token | Obtaining a new JWT without re-entering credentials |
| Google OAuth 2.0 | Alternative to email/password login |
| TOTP 2FA + backup codes | Optional second factor on top of password login |

Passwords are hashed with Argon2. JWTs are signed with `JWT_SECRET` (see `.env.example`).

## 1. Register or log in

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","email":"jane@example.com","password":"secret123"}'
```

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"secret123"}'
```

A successful login (`202`) returns:

```json
{
  "status": "success",
  "code": 202,
  "data": { "id": "...", "email": "jane@example.com", "role": "user", "verified": true },
  "token": "<jwt>",
  "refreshToken": "<refresh-token>",
  "deviceId": "<device-id>"
}
```

`token` is a short-lived JWT for the `Authorization` header. `refreshToken` is a
longer-lived, single-use rotation token. `deviceId` identifies this login session — see
[Device sessions](#4-device-sessions) below.

New accounts start unverified; `register` sends a verification email
(`PUT /api/v1/auth/verify-account` with the emailed token completes it). Verification
status does not currently block login.

## 2. Authenticate requests

Send the JWT on every authenticated request:

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <jwt>"
```

Endpoints that don't require auth (public browsing, category/worker listings, etc.) are
callable without this header — check the `security` field on each operation in
[openapi.json](./openapi.json) or the Swagger UI (see [API_REFERENCE.md](./API_REFERENCE.md)).

## 3. Refresh an expired token

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-token>"}'
```

Returns a new `{ token, refreshToken }` pair and rotates the old refresh token (it
cannot be reused). `DELETE /api/v1/auth/logout` (requires the bearer token) revokes the
current session's refresh token.

## 4. Device sessions

Each login records a device/session (`deviceId`, user agent, IP). Consumers building
multi-session UIs (e.g. "log out other devices") use:

- `GET /api/v1/auth/devices` — list active sessions for the current user
- `DELETE /api/v1/auth/devices/{deviceId}` — revoke one session
- `POST /api/v1/auth/devices/revoke-others` — revoke every session except the current one
  (body: `{ "currentDeviceId": "<deviceId>" }`)

## 5. Google OAuth 2.0

Alternative to email/password:

1. Redirect the user to `GET /api/v1/auth/google`.
2. Google redirects back to `GET /api/v1/auth/google/callback` after consent.
3. The callback issues a JWT/refresh token pair and redirects to the frontend
   (`APP_URL`) with the token attached — the frontend picks it up the same way it would
   from a normal login response.

## 6. Two-factor authentication (TOTP)

Opt-in, on top of password login. All 2FA endpoints are under `/api/v1/auth/2fa`:

| Endpoint | Auth required | Purpose |
|---|---|---|
| `POST /2fa/setup` | bearer | Generate a TOTP secret + QR code for an authenticator app |
| `POST /2fa/enable` | bearer | Verify the first TOTP code and activate 2FA (body: `{ token }`) |
| `POST /2fa/verify` | none | Verify a TOTP code during login (body: `{ userId, token }`) |
| `POST /2fa/verify-backup` | none | Verify a one-time backup code instead of a TOTP code (body: `{ userId, code }`) |
| `DELETE /2fa` | bearer | Disable 2FA (body: `{ token }`) |
| `POST /2fa/backup-codes/regenerate` | bearer | Invalidate and reissue backup codes (body: `{ token }`) |

Flow once 2FA is enabled: `POST /auth/login` succeeds as normal (2FA is enforced by the
client calling `/2fa/verify` with the `userId` from the login response before treating
the session as fully authenticated — the API does not currently gate other endpoints on
2FA verification status itself). Backup codes are single-use fallbacks for a lost
authenticator device.

## Password reset

```bash
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" -d '{"email":"jane@example.com"}'
# Always returns 200, whether or not the email exists, to prevent account enumeration.

curl -X PUT http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<reset-token>","password":"newpassword123"}'
```

# Rate Limiting

Documentation of rate limiting policies, response headers, and client retry strategies.

---

## Table of Contents

- [Overview](#overview)
- [Rate Limits by Endpoint Category](#rate-limits-by-endpoint-category)
- [Rate Limit Response Headers](#rate-limit-response-headers)
- [Handling 429 Responses](#handling-429-responses)
- [Retry Strategy Recommendations](#retry-strategy-recommendations)
- [Authenticated Users](#authenticated-users)
- [Configuration](#configuration)

---

## Overview

The BlueCollar API uses [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) to protect sensitive endpoints from brute-force and abuse. Rate limits are applied per IP address.

When a limit is exceeded the API responds with HTTP `429 Too Many Requests` and includes a `Retry-After` header indicating how long to wait before retrying.

---

## Rate Limits by Endpoint Category

### Auth endpoints (rate-limited)

The following endpoints are protected by the `authRateLimiter`:

| Endpoint                    | Method | Limit       | Window     |
| --------------------------- | ------ | ----------- | ---------- |
| `/api/auth/login`           | `POST` | 10 requests | 15 minutes |
| `/api/auth/register`        | `POST` | 10 requests | 15 minutes |
| `/api/auth/forgot-password` | `POST` | 10 requests | 15 minutes |

These limits exist to prevent brute-force attacks against user credentials and to slow down automated account creation.

### Public endpoints (no rate limit)

The following endpoints are publicly accessible and not currently rate-limited:

| Endpoint              | Method | Notes                    |
| --------------------- | ------ | ------------------------ |
| `/api/workers`        | `GET`  | Paginated worker listing |
| `/api/workers/:id`    | `GET`  | Single worker            |
| `/api/categories`     | `GET`  | Category listing         |
| `/api/categories/:id` | `GET`  | Single category          |
| `/health`             | `GET`  | Health check             |

### Authenticated endpoints (no rate limit)

Endpoints that require a valid JWT are not rate-limited beyond the auth endpoints. The authentication requirement itself acts as a barrier against anonymous abuse.

| Endpoint                      | Auth required   |
| ----------------------------- | --------------- |
| `POST /api/workers`           | Curator         |
| `PUT /api/workers/:id`        | Curator         |
| `DELETE /api/workers/:id`     | Curator         |
| `GET /api/workers/mine`       | Curator / Admin |
| `GET /api/admin/*`            | Admin           |
| `GET /api/users/me/bookmarks` | User            |

---

## Rate Limit Response Headers

When rate limiting is active, the API returns standard `RateLimit-*` headers on every response (not just when the limit is exceeded). Legacy `X-RateLimit-*` headers are disabled.

### Headers returned on normal responses

```
RateLimit-Limit: 10
RateLimit-Remaining: 7
RateLimit-Reset: 1714000800
```

| Header                | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `RateLimit-Limit`     | Maximum number of requests allowed in the current window |
| `RateLimit-Remaining` | Number of requests remaining in the current window       |
| `RateLimit-Reset`     | Unix timestamp (seconds) when the window resets          |

### Headers returned on 429 responses

When the limit is exceeded, the API adds a `Retry-After` header:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 900
RateLimit-Limit: 10
RateLimit-Remaining: 0
RateLimit-Reset: 1714000800
Content-Type: application/json
```

```json
{
  "status": "error",
  "message": "Too many requests from this IP, please try again later.",
  "code": 429
}
```

`Retry-After` is expressed in **seconds** and equals the full window duration (default: 900 seconds / 15 minutes). This is a conservative value — the actual wait may be shorter depending on when the window started.

---

## Handling 429 Responses

### Detect the 429

Check the HTTP status code before processing the response body:

```ts
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
  console.warn(`Rate limited. Retry after ${waitSeconds}s`);
  // surface a user-friendly message, do not retry immediately
}
```

### Read the `Retry-After` header

Always read `Retry-After` rather than hardcoding a wait time:

```ts
function getRetryDelay(headers: Headers): number {
  const retryAfter = headers.get('Retry-After');
  if (!retryAfter) return 60_000; // fallback: 60 seconds
  return parseInt(retryAfter, 10) * 1000; // convert to milliseconds
}
```

### Show a user-friendly message

For login and registration forms, display a clear message rather than a generic error:

```ts
if (response.status === 429) {
  const body = await response.json();
  showError('Too many attempts. Please wait a few minutes before trying again.');
}
```

---

## Retry Strategy Recommendations

### For automated clients / scripts

Use **exponential backoff with jitter** when retrying after a 429. Do not retry immediately — this will only extend the window reset time.

```ts
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status !== 429) return response;

    if (attempt === maxRetries) throw new Error('Max retries exceeded');

    const retryAfter = response.headers.get('Retry-After');
    const baseDelay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;
    // Add jitter: wait between 100% and 150% of the base delay
    const jitter = Math.random() * 0.5 * baseDelay;
    await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
  }
}
```

### For interactive UIs

- Do not auto-retry login or registration forms on 429 — show the user a message and let them retry manually.
- Disable the submit button and show a countdown timer using the `Retry-After` value:

```ts
function startRetryCountdown(seconds: number, buttonEl: HTMLButtonElement) {
  buttonEl.disabled = true;
  const interval = setInterval(() => {
    seconds--;
    buttonEl.textContent = `Try again in ${seconds}s`;
    if (seconds <= 0) {
      clearInterval(interval);
      buttonEl.disabled = false;
      buttonEl.textContent = 'Log in';
    }
  }, 1000);
}
```

### General rules

- Always respect `Retry-After`. Ignoring it and retrying immediately will keep triggering 429s.
- Cache the reset timestamp (`RateLimit-Reset`) and check it before making new requests.
- For non-auth endpoints that may be rate-limited in the future, build retry logic into your API client from the start.

---

## Authenticated Users

Currently, rate limits are applied per **IP address** regardless of authentication status. Authenticated requests to non-auth endpoints (workers, admin, etc.) are not rate-limited.

If you are building an integration that makes many authenticated requests in a short period (e.g. bulk worker imports), space requests out to avoid hitting any future global limits. A safe rate is **1 request per 100ms** (10 req/s).

### Auth endpoint bypass for authenticated users

The auth rate limiter applies to the login and registration endpoints even for users who are already authenticated. This is intentional — these endpoints are the primary brute-force targets.

If you need to call `/api/auth/me` or `/api/auth/logout` frequently, those endpoints are not rate-limited.

---

## Configuration

Rate limit parameters can be tuned via environment variables in `packages/api/.env`:

| Variable               | Default           | Description                    |
| ---------------------- | ----------------- | ------------------------------ |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Time window in milliseconds    |
| `RATE_LIMIT_MAX`       | `10`              | Max requests per window per IP |

Example — tighten limits in production:

```
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=5
```

Example — relax limits for local development:

```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

Changes take effect on the next server restart.

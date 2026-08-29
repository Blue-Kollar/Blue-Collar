# Error Handling & Logging Conventions

Status: **normative** — new code must follow this document; existing code is migrated opportunistically.

This document is the single source of truth for how BlueCollar reports errors and emits logs
across `packages/api` (Express + Prisma + Pino) and `packages/app` (Next.js + React).
It exists because the two packages historically grew several competing patterns —
three different error envelopes on the backend and bare `console.*` calls on the frontend —
and reviewers had nothing written down to point at.

---

## Table of Contents

- [Principles](#principles)
- [Backend: the error model](#backend-the-error-model)
  - [`AppError` and `ErrorCode`](#apperror-and-errorcode)
  - [The canonical error envelope](#the-canonical-error-envelope)
  - [Status code mapping](#status-code-mapping)
  - [How to write a route](#how-to-write-a-route)
  - [Deprecated patterns](#deprecated-patterns)
- [Backend: logging](#backend-logging)
  - [Log levels](#log-levels)
  - [Structured fields](#structured-fields)
  - [PII rules](#pii-rules)
- [Correlation ID propagation](#correlation-id-propagation)
- [Frontend: error handling](#frontend-error-handling)
- [Frontend: logging](#frontend-logging)
- [Before / after examples](#before--after-examples)
- [Review checklist](#review-checklist)
- [Testing requirements](#testing-requirements)

---

## Principles

1. **One envelope.** Every API error response has the same JSON shape, regardless of which
   controller, middleware, or serializer produced it.
2. **Throw, don't return.** Controllers throw `AppError`; a single global handler decides the
   wire format. Per-controller `try/catch` blocks that format their own response are the thing
   this document is trying to remove.
3. **Errors are typed, not stringly.** Clients branch on `errorCode`, never on `message`.
   Messages are human copy and may change or be translated; codes are contract.
4. **Logs are structured.** Every log line is JSON with a `context` field. No string
   concatenation, no `console.*` in application code.
5. **Never log PII.** No request bodies, headers, query params, tokens, emails, or IP
   addresses. This is enforced by convention and flagged in review.
6. **Every error is correlatable.** A `traceId` ties a client-visible failure to the exact
   server-side log lines and spans that produced it.

---

## Backend: the error model

### `AppError` and `ErrorCode`

`packages/api/src/utils/AppError.ts` defines the only error class application code should throw.
`packages/api/src/services/AppError.ts` re-exports it, so both import paths are equivalent —
prefer `../utils/AppError.js`.

```ts
import { AppError, ErrorCode } from '../utils/AppError.js'

throw new AppError('Worker not found', 404, true, ErrorCode.NOT_FOUND)
```

| Argument        | Meaning                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `message`       | Human-readable, safe to show a client. Use a constant from `constants/errors.ts` when one fits. |
| `statusCode`    | HTTP status. Default `500`.                                                                    |
| `isOperational` | `true` = expected failure (bad input, missing record). `false` = bug. Default `true`.           |
| `errorCode`     | Machine-readable `ErrorCode`. Default `ErrorCode.INTERNAL_ERROR`.                               |

`isOperational` is the switch that decides whether the client sees your message or a generic one.
An `AppError` with `isOperational: false` is serialized like an unexpected crash: generic message,
full details logged server-side only. Use it when you want the stack captured but the cause hidden.

The `ErrorCode` enum is the client-facing contract:

| Group      | Codes                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| Auth       | `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_CREDENTIALS`, `ACCOUNT_NOT_VERIFIED`, `TOKEN_EXPIRED`, `TOKEN_INVALID` |
| Resource   | `NOT_FOUND`, `CONFLICT`                                                                                     |
| Validation | `VALIDATION_ERROR`                                                                                          |
| Server     | `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`                                                                     |

Adding a code is a public API change: add the enum member, document it here, and note it in the
PR description so SDK and frontend consumers can react.

### The canonical error envelope

Produced by `serializers/error.serializer.ts` and written by the `errorHandler` middleware:

```jsonc
{
  "status": "error",           // always the literal "error"
  "message": "Worker not found", // human copy; do not branch on this
  "code": 404,                  // HTTP status, mirrored in the body
  "errorCode": "NOT_FOUND",     // ErrorCode — branch on this
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736" // present when tracing is active
}
```

In `NODE_ENV=development` only, unexpected (non-operational) errors additionally carry
`stack` and `originalMessage`. These must never appear in staging or production.

The success envelope is `utils/response.ts#sendSuccess`:

```jsonc
{ "data": { }, "status": "success", "code": 200, "message": "optional" }
```

Paginated endpoints add a sibling `meta` object. `status` and `code` are always present on both
envelopes, so a client can discriminate on `status` alone.

### Status code mapping

Use `HttpStatus` from `constants/index.ts` rather than integer literals.

| Situation                              | Status | `errorCode`           | Who produces it                        |
| -------------------------------------- | ------ | --------------------- | -------------------------------------- |
| Missing or malformed token             | 401    | `TOKEN_INVALID`       | `middleware/auth.ts`                   |
| Expired token                          | 401    | `TOKEN_EXPIRED`       | `middleware/auth.ts`                   |
| Wrong credentials                      | 401    | `INVALID_CREDENTIALS` | auth service                           |
| Authenticated but wrong role           | 403    | `FORBIDDEN`           | `authorize()`                          |
| Disallowed CORS origin                 | 403    | `FORBIDDEN`           | `serializeError` (`CORS:` prefix)      |
| Record does not exist                  | 404    | `NOT_FOUND`           | service layer, or Prisma `P2025`       |
| Unmatched route                        | 404    | `NOT_FOUND`           | `notFoundHandler`                      |
| Unique constraint violated             | 409    | `CONFLICT`            | Prisma `P2002`                         |
| Foreign key violated                   | 400    | `VALIDATION_ERROR`    | Prisma `P2003`                         |
| Schema validation failed               | 422    | `VALIDATION_ERROR`    | `middleware/validate.ts` — see below   |
| Business rule rejected valid input     | 422    | `VALIDATION_ERROR`    | service layer                          |
| Rate limit exceeded                    | 429    | —                     | `middleware/rateLimit.ts` — see below  |
| Unhandled exception                    | 500    | `INTERNAL_ERROR`      | `errorHandler`                         |
| Dependency (DB, Stellar, mail) is down | 503    | `SERVICE_UNAVAILABLE` | service layer                          |

Prisma error codes are mapped centrally in `serializeError`. Do not catch `P2002`/`P2025` in a
controller to rewrite the status — that duplicates the mapping and drifts.

Two middlewares write their response directly rather than throwing, so they bypass
`serializeError` and their bodies carry no `errorCode` or `traceId`:

```jsonc
// middleware/validate.ts — 422
{ "status": "error", "message": "Validation failed", "code": 422,
  "errors": { "email": ["Invalid email"] } }

// middleware/rateLimit.ts — 429
{ "status": "error", "message": "Too many requests. Please slow down.", "code": 429,
  "retryAfter": 120 }
```

Both are **documented exceptions, not patterns to copy**. Their extra keys (`errors`, `retryAfter`)
are additive and clients may rely on them, but any new middleware that rejects a request must throw
an `AppError` instead. Bringing these two onto the canonical envelope is tracked as follow-up work;
until then, clients handling 422 and 429 must not assume `errorCode` is present.

### How to write a route

The canonical shape is **`catchAsync` + throw + global `errorHandler`**. `catchAsync`
(`utils/catchAsync.ts`) forwards rejected promises to `next()`, which reaches `errorHandler`,
which calls `serializeError`. That is the whole path.

```ts
// controllers/workers.ts
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { sendSuccess } from '../utils/response.js'
import { ErrorMessages, HttpStatus } from '../constants/index.js'

export const getWorker = catchAsync(async (req, res) => {
  const worker = await workerService.getWorker(req.params.id)
  if (!worker) {
    throw new AppError(ErrorMessages.WORKER_NOT_FOUND, HttpStatus.NOT_FOUND, true, ErrorCode.NOT_FOUND)
  }
  return sendSuccess(res, WorkerResource(worker))
})
```

Rules:

- Controllers validate shape (via `middleware/validate.ts`) and translate service results to HTTP.
  Business rules and their errors belong in `services/`.
- Services throw `AppError` too. They must not import `express` or touch `res`.
- `errorHandler` must stay registered last, after `notFoundHandler`. See `app.ts`.

### Deprecated patterns

These exist in the codebase today. Do not add new instances; convert them when you touch a file.

| Pattern                                          | Why it's wrong                                                                | Replace with                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------- |
| `try { … } catch (err) { return handleError(res, err) }` | `utils/handleError.ts` drops `errorCode` and `traceId` — clients get a thinner envelope. | `catchAsync` + `throw`            |
| `sendError(res, msg, status)`                    | Emits `{status, message, code}` with no `errorCode`/`traceId`.                 | `throw new AppError(...)`         |
| `res.status(404).json({ error: 'Not found' })`   | A fourth envelope shape; `error` key exists nowhere else.                      | `throw new AppError(...)`         |
| `res.status(201).json({ data, status, code })`   | Hand-rolled success envelope, drifts from `sendSuccess`.                       | `sendSuccess(res, data, { statusCode: 201 })` |
| `catch (err) { console.error(err) }`             | Bypasses Pino: no level, no `context`, no trace correlation.                   | `logger.error({ err }, 'message')` |

`utils/handleError.ts` and `utils/response.ts#sendError` are retained only for the call sites that
still use them and should not gain new callers.

---

## Backend: logging

Two entry points, and nothing else:

- `config/logger.ts` — the root Pino instance. Import as `import { logger } from '../config/logger.js'`.
- `utils/logger.ts` — `createServiceLogger(name)`, which returns a `ServiceLogger` that stamps every
  line with `context`. **Prefer this in services.**

```ts
import { createServiceLogger } from '../utils/logger.js'

const log = createServiceLogger('escrow.service')

log.info('Escrow funded', { escrowId, amount })
log.error('Escrow funding failed', err, { escrowId })

const releaseLog = log.child('release')  // context becomes "escrow.service:release"
```

### Log levels

`LOG_LEVEL` (default `info`) sets the threshold. Development pretty-prints via `pino-pretty`;
production writes JSON to `storage/logs/api-<date>.log`.

| Level   | Use for                                                                                     | Example                                              | Paging? |
| ------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| `fatal` | Process cannot continue and is exiting.                                                      | Cannot connect to the database at boot.              | Yes     |
| `error` | An operation failed and a human needs to know. Unexpected exceptions, 5xx responses.         | Stellar submission threw after retries.              | Yes     |
| `warn`  | Degraded but handled: a retry succeeded, a fallback fired, a deprecated route was called.    | Idempotency key replayed; v1 endpoint hit.           | No      |
| `info`  | Business-significant state changes. The default for "this happened".                         | Worker verified; payout released; user registered.   | No      |
| `debug` | Developer detail: chosen branches, computed values, external payload sizes.                  | Cache miss for `workers:list:page=2`.                | No      |
| `trace` | Very high volume, local only. Never enabled in a deployed environment.                       | Per-iteration loop state.                            | No      |

Two rules that matter more than the table:

- **Client errors (4xx) are not `error`.** A 404 or a failed validation is the system working.
  `errorHandler` only logs at `error` when `statusCode >= 500`; keep it that way.
- **Log the failure once.** If you log and rethrow, the global handler logs it again. Either log
  and handle, or throw and let `errorHandler` log. Not both.

### Structured fields

Pass data as the first argument (the merging object), message as the second. Never interpolate.

```ts
logger.info({ workerId, categoryId }, 'Worker created')   // ✅
logger.info(`Worker ${workerId} created`)                 // ❌ unsearchable
```

Field names used across the API — reuse them so dashboards keep working:

| Field       | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `context`   | Emitting module, e.g. `escrow.service`. Set by `ServiceLogger`. |
| `traceId`   | Correlation ID. See below.                                 |
| `userId`    | Authenticated user id, or `null`. Set by `requestLogger`.  |
| `err`       | Serialized error (`message`, `type`).                      |
| `durationMs`| Elapsed time for a timed operation.                        |

### PII rules

`middleware/requestLogger.ts` deliberately serializes requests down to `{ method, url }` and
responses to `{ statusCode }`. **Do not widen those serializers.**

Never log: passwords or hashes, JWTs or refresh tokens, full request bodies, `Authorization` or
`Cookie` headers, email addresses, phone numbers, physical addresses, IP addresses, wallet secret
keys, Stellar transaction envelopes containing signatures.

Safe to log: opaque ids (`userId`, `workerId`, `escrowId`), enum values, counts, durations,
status codes, `traceId`, public Stellar addresses.

When a log line is deliberately narrow for privacy reasons, leave a `// PII SAFETY:` comment
explaining it — the codebase already uses that marker in `requestLogger`, `errorHandler`,
`handleError`, and `error.serializer`.

---

## Correlation ID propagation

The correlation ID is the **OpenTelemetry trace ID**. There is no separate home-grown request ID,
and none should be added.

### Where it comes from

`monitoring/tracing.ts` starts the OpenTelemetry Node SDK with auto-instrumentation for HTTP,
Express, and Prisma. `initializeTracing()` must run before any other import in the entry point.
The HTTP instrumentation reads the W3C [`traceparent`](https://www.w3.org/TR/trace-context/) header
on inbound requests and continues that trace; when the header is absent it starts a new one.

`getTraceId()` reads the active span and returns its 128-bit hex trace ID, or `undefined` when no
span is active (which is also what the all-zero invalid trace ID collapses to):

```ts
import { getTraceId } from '../monitoring/tracing.js'

const traceId = getTraceId()   // "4bf92f3577b34da6a3ce929d0e0e4736" | undefined
```

### How it propagates

```
Browser / SDK
    │  traceparent: 00-<traceId>-<spanId>-01        (optional; generated server-side if absent)
    ▼
Express  ── HTTP auto-instrumentation extracts or creates the trace
    │
    ├── requestLogger  ────────────────► log line carries traceId
    ├── controller ──► service ──► Prisma   (same async context, same traceId)
    │                    │
    │                    └── ServiceLogger lines carry traceId
    │
    └── errorHandler ──► serializeError ──► response body.traceId
                                     │
                                     └────► logger.error(...) at 5xx, same traceId
```

Because propagation rides on `AsyncLocalStorage`, it survives `await` without any manual threading.
The two things that break it:

- **Detached work.** Anything pushed onto a queue (`src/queue`), a `setTimeout`, or a worker
  (`src/workers`) leaves the request's async context. Pass the trace ID explicitly in the job
  payload and log it as `traceId` on the other side.
- **Outbound calls made outside instrumentation.** If you call an external service with a client
  the SDK does not instrument, inject the `traceparent` header yourself.

### Rules

1. Do not invent per-request UUIDs. Use `getTraceId()`.
2. Never derive behaviour from a trace ID; it is observability metadata only.
3. `traceId` is present on every error response when tracing is active, and is **absent, not null**,
   when it is not. Clients must treat it as optional.
4. Surface it to users on unexpected failures — it is what support asks for. The frontend
   `ErrorBoundary` copy-report button is the intended place.
5. When tracing is disabled (no collector configured in local dev), everything above degrades to
   "no `traceId` field". Nothing else changes.

---

## Frontend: error handling

`packages/app` has no `AppError`. It has one parser and one boundary.

**`lib/errors.ts#parseApiError`** turns anything thrown by `lib/api.ts` into a `ParsedApiError`:

```ts
interface ParsedApiError {
  message: string       // user-facing copy, already friendly
  toastType: ToastType  // "error" | "warning" | ...
  code?: string         // NETWORK_ERROR | RATE_LIMITED | UNAUTHORIZED | ...
  status?: number
  retryable: boolean
}
```

Rules:

- **Never render a raw thrown message.** Always go through `parseApiError` /
  `formatErrorMessage`. Backend copy is not written for end users and may be a generic 500 string.
- **Never branch on message text in components.** Branch on `parsed.code` or `parsed.retryable`.
  Only `lib/errors.ts` is allowed to pattern-match on message content, because that is its job.
- **Show retry only when `retryable`.** `isRetryable(error)` exists for exactly this.
- `lib/api.ts` owns the 401 path (clear token, redirect to `/auth/login`). Components must not
  reimplement it.
- Route-level failures render `components/ErrorBoundary.tsx`, which offers *Try again* (`reset()`)
  and a copyable report containing `message`, `name`, `stack`, `digest`, `url`, and `timestamp`.

## Frontend: logging

There is no logging infrastructure in the browser, and that is intentional — the log destination is
the developer console plus the analytics pipeline (`lib/analytics.ts`).

- `console.error` is acceptable **only** in a `catch` that has already handled the error, and the
  message must be prefixed with the module in brackets: `console.error("[useWallet] connect error:", err)`.
  This prefix convention is already used in `hooks/`, `context/`, and `lib/offlineQueue.ts`; follow it.
- `console.log` must not be committed. `console.warn` is for recoverable degradation
  (a missing i18n message, a failed background sync registration).
- Never `console.*` a token, a password field, or a full API response body.
- User-visible failure is a toast (`useToast`) or an `ErrorBoundary`, never a console line.

---

## Before / after examples

### 1. Controller: hand-rolled envelopes → thrown `AppError`

Both branches below produce different JSON shapes for the same endpoint. The `sendError` branch
omits `errorCode` and `traceId` entirely, so a client cannot programmatically distinguish
"category missing" from any other 404, and support cannot correlate the failure with logs.

**Before** (`controllers/categories.ts`):

```ts
export async function getCategory(req: Request, res: Response) {
  try {
    const category = await categoryService.getCategory(req.params.id as string)
    if (!category) {
      return sendError(res, ErrorMessages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND)
    }
    return sendSuccess(res, CategoryResource(category as any))
  } catch (err) {
    return handleError(res, err)
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const category = await categoryService.createCategory(req.body)
    return res.status(201).json({ data: CategoryResource(category as any), status: 'success', code: 201 })
  } catch (err) {
    return handleError(res, err)
  }
}
```

```jsonc
// before — 404 response
{ "status": "error", "message": "Category not found", "code": 404 }
```

**After**:

```ts
export const getCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.getCategory(req.params.id as string)
  if (!category) {
    throw new AppError(ErrorMessages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND, true, ErrorCode.NOT_FOUND)
  }
  return sendSuccess(res, CategoryResource(category as any))
})

export const createCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body)
  return sendSuccess(res, CategoryResource(category as any), { statusCode: HttpStatus.CREATED })
})
```

```jsonc
// after — 404 response
{
  "status": "error",
  "message": "Category not found",
  "code": 404,
  "errorCode": "NOT_FOUND",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

Nineteen lines become twelve, the Prisma unique-constraint case on `createCategory` now returns
409 `CONFLICT` for free instead of a generic 500, and both responses are correlatable.

### 2. Service: `console.error` → structured logger

**Before**:

```ts
export async function releaseEscrow(escrowId: string) {
  try {
    return await stellar.release(escrowId)
  } catch (err) {
    console.error('escrow release failed', escrowId, err)
    throw err
  }
}
```

The line has no level, no `context`, no `traceId`, is not JSON, does not reach the production log
file, and is logged twice — once here and once by `errorHandler`.

**After**:

```ts
const log = createServiceLogger('escrow.service')

export async function releaseEscrow(escrowId: string) {
  try {
    return await stellar.release(escrowId)
  } catch (err) {
    throw new AppError(
      ErrorMessages.ESCROW_RELEASE_FAILED,   // add the constant to constants/errors.ts
      HttpStatus.SERVICE_UNAVAILABLE,
      true,
      ErrorCode.SERVICE_UNAVAILABLE,
    )
  }
}
```

The escrow id is context `errorHandler` cannot see, so it is worth logging — but 503 is `>= 500`,
which means `errorHandler` will emit its own `error` line for the same failure. Log the extra
context at `warn` so the `error` level stays one line per failure:

```ts
  } catch (err) {
    log.warn('Escrow release failed, returning 503', { escrowId })  // context only
    throw new AppError(/* … */)                                     // errorHandler emits the error line
  }
```

### 3. Component: raw error text → `parseApiError`

**Before**:

```tsx
const [error, setError] = useState<string | null>(null)

try {
  await createReview(workerId, payload)
} catch (err) {
  setError((err as Error).message)   // renders "Request failed" or a 500 string
}

return error && <p className="text-red-600">{error}</p>
```

**After**:

```tsx
const [error, setError] = useState<ParsedApiError | null>(null)

try {
  await createReview(workerId, payload)
} catch (err) {
  setError(parseApiError(err, "Could not submit your review."))
}

return error && (
  <div role="alert" className="text-sm text-red-600">
    {error.message}
    {error.retryable && <button onClick={retry}>Try again</button>}
  </div>
)
```

The user now sees "Unable to connect. Please check your internet connection." instead of
"Failed to fetch", retry is offered only when retrying can help, and screen readers announce the
failure because of `role="alert"`.

### 4. Background job: losing the correlation ID

**Before** — the job's logs cannot be joined to the request that enqueued it:

```ts
await notificationQueue.add('send-email', { userId, template })
```

**After**:

```ts
await notificationQueue.add('send-email', { userId, template, traceId: getTraceId() })

// in the worker
const log = createServiceLogger('notification.worker')
log.info('Sending email', { userId, template, traceId: job.data.traceId })
```

---

## Review checklist

For the reviewer, and for you before you request review:

- [ ] No new `try/catch` in a controller that formats its own response.
- [ ] No new call sites for `handleError` or `sendError`.
- [ ] Every thrown `AppError` passes an explicit `ErrorCode`.
- [ ] Status codes come from `HttpStatus`, messages from `ErrorMessages`, not literals.
- [ ] No `console.*` added under `packages/api/src` outside `commands/`, `database/`, and `scripts/`.
- [ ] New `console.error` in `packages/app` is in a handled `catch` and carries a `[Module]` prefix.
- [ ] Log calls pass an object first, message second — no template literals.
- [ ] No PII in any new log field or error message.
- [ ] Client errors log at `warn` or below; only 5xx logs at `error`.
- [ ] The same failure is not logged twice.
- [ ] Work leaving the request context forwards `traceId` explicitly.
- [ ] Frontend renders `parseApiError(...).message`, never a raw thrown message.

## Testing requirements

- Error-shape changes are covered by `middleware/errorHandler.test.ts` and the `serializeError`
  suite in `serializers/serializers.test.ts`. Adding an `ErrorCode` or changing the envelope means
  updating those.
- `__tests__/error-logging-conventions.test.ts` asserts that this document stays in sync with the
  code: every `ErrorCode` member is documented here, the envelope fields listed here are the fields
  `serializeError` actually emits, and the `traceId` contract holds. It fails if the code and this
  file diverge.
- New controllers should have at least one test asserting the failure status **and** `errorCode`,
  not just the status.
- Frontend components with an error branch need a test rendering that branch — see
  [packages/app/CONTRIBUTING.md](../packages/app/CONTRIBUTING.md).

---

## Related documents

- [CONTRIBUTING.md](../CONTRIBUTING.md) — commit conventions and PR process
- [docs/MONITORING_AND_ALERTING.md](./MONITORING_AND_ALERTING.md) — where these logs and traces land
- [docs/SECURITY_GUIDE.md](./SECURITY_GUIDE.md) — threat context for the PII rules
- [packages/app/CONTRIBUTING.md](../packages/app/CONTRIBUTING.md) — frontend conventions

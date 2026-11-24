/**
 * HTTP status code constants.
 *
 * Use these symbolic names instead of bare numbers so that the intent
 * of each response is immediately clear and typos are caught at compile time.
 *
 * Only codes actively used in this codebase are listed; add others as needed.
 */
export const HttpStatus = {
  // ── 2xx Success ───────────────────────────────────────────────────────────
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // ── 3xx Redirection ───────────────────────────────────────────────────────
  MOVED_PERMANENTLY: 301,
  FOUND: 302,

  // ── 4xx Client Error ──────────────────────────────────────────────────────
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // ── 5xx Server Error ──────────────────────────────────────────────────────
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus]

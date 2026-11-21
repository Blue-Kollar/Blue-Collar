/**
 * Shared application constants — single source of truth.
 *
 * All magic numbers and repeated literals used across the monorepo
 * must be defined here rather than inlined at each call site.
 *
 * Issue: #1898
 */

// ── Rate limiting ─────────────────────────────────────────────────────────────

/** Window for sensitive operations: login, password reset (15 minutes). */
export const RATE_LIMIT_STRICT_WINDOW_MS = 15 * 60 * 1000;

/** Window for moderate operations: registration, verification (1 hour). */
export const RATE_LIMIT_MODERATE_WINDOW_MS = 60 * 60 * 1000;

/** Window for liberal/read operations: listings, details (1 hour). */
export const RATE_LIMIT_LIBERAL_WINDOW_MS = 60 * 60 * 1000;

/** Max requests per strict window (sensitive endpoints). */
export const RATE_LIMIT_STRICT_MAX = 5;

/** Max requests per moderate window. */
export const RATE_LIMIT_MODERATE_MAX = 20;

/** Max requests per liberal window (read endpoints). */
export const RATE_LIMIT_LIBERAL_MAX = 100;

/** Max requests per write window (side-effect endpoints). */
export const RATE_LIMIT_WRITE_MAX = 10;

/** HTTP status code for rate limit exceeded. */
export const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

// ── Server / API ──────────────────────────────────────────────────────────────

/** Default API server port. */
export const DEFAULT_API_PORT = 3000;

/** Default app (Next.js) port. */
export const DEFAULT_APP_PORT = 3001;

/** Default mail server port (SMTP). */
export const DEFAULT_MAIL_PORT = 587;

// ── File upload ──────────────────────────────────────────────────────────────

/** Max file upload size in bytes (5 MB). */
export const MAX_FILE_SIZE_BYTES = 5_242_880;

// ── Worker ────────────────────────────────────────────────────────────────────

/** Graceful shutdown timeout for background workers (ms). */
export const WORKER_SHUTDOWN_TIMEOUT_MS = 30_000;

// ── Storage ───────────────────────────────────────────────────────────────────

/** Default S3 signed URL TTL in seconds (1 hour). */
export const S3_SIGNED_URL_TTL_SECONDS = 3600;

// ── Time helpers ─────────────────────────────────────────────────────────────

/** One second in milliseconds. */
export const ONE_SECOND_MS = 1000;

/** One minute in milliseconds. */
export const ONE_MINUTE_MS = 60 * 1000;

/** One hour in milliseconds. */
export const ONE_HOUR_MS = 60 * 60 * 1000;

/** One day in milliseconds. */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** 15 minutes in milliseconds. */
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

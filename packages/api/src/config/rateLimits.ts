/**
 * Rate limit configuration — Issue #774
 *
 * Centralised per-endpoint and per-role rate limit settings.
 * All values configurable via environment variables — no redeploy needed.
 */

export interface RateLimitConfig {
  /** Sliding window size in seconds */
  windowSec: number
  /** Max requests per window for anonymous/unauthenticated callers */
  anonLimit: number
  /** Max requests per window for authenticated users */
  authLimit: number
  /** Max requests per window for admin role (0 = bypass) */
  adminLimit: number
  /** Burst allowance on top of the base limit (token-bucket style) */
  burstAllowance: number
}

const e = process.env

function num(val: string | undefined, fallback: number): number {
  const parsed = parseInt(val ?? '', 10)
  return isNaN(parsed) ? fallback : parsed
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

/** Login / register / forgot-password — strict to prevent brute-force */
export const AUTH_STRICT: RateLimitConfig = {
  windowSec: num(e.RL_AUTH_STRICT_WINDOW, 900),  // 15 min
  anonLimit:  num(e.RL_AUTH_STRICT_ANON,   5),
  authLimit:  num(e.RL_AUTH_STRICT_AUTH,   10),
  adminLimit: 0,   // bypass
  burstAllowance: 2,
}

/** Email verification / resend — moderate */
export const AUTH_MODERATE: RateLimitConfig = {
  windowSec: num(e.RL_AUTH_MOD_WINDOW, 3_600), // 1 hr
  anonLimit:  num(e.RL_AUTH_MOD_ANON,   3),
  authLimit:  num(e.RL_AUTH_MOD_AUTH,   10),
  adminLimit: 0,
  burstAllowance: 1,
}

// ── Worker / search endpoints ─────────────────────────────────────────────────

/** Public worker listing and search */
export const WORKERS_READ: RateLimitConfig = {
  windowSec: num(e.RL_WORKERS_READ_WINDOW, 60),
  anonLimit:  num(e.RL_WORKERS_READ_ANON,  30),
  authLimit:  num(e.RL_WORKERS_READ_AUTH,  120),
  adminLimit: 0,
  burstAllowance: 10,
}

/** Worker write operations (create/update/delete) */
export const WORKERS_WRITE: RateLimitConfig = {
  windowSec: num(e.RL_WORKERS_WRITE_WINDOW, 300),
  anonLimit:  num(e.RL_WORKERS_WRITE_ANON,  0),   // unauthenticated not allowed
  authLimit:  num(e.RL_WORKERS_WRITE_AUTH,  20),
  adminLimit: 0,
  burstAllowance: 5,
}

// ── Contact / messaging ───────────────────────────────────────────────────────

export const CONTACT: RateLimitConfig = {
  windowSec: num(e.RL_CONTACT_WINDOW, 3_600),
  anonLimit:  num(e.RL_CONTACT_ANON,   1),
  authLimit:  num(e.RL_CONTACT_AUTH,   5),
  adminLimit: 0,
  burstAllowance: 0,
}

// ── General API ───────────────────────────────────────────────────────────────

export const GENERAL_API: RateLimitConfig = {
  windowSec: num(e.RL_GENERAL_WINDOW, 900),
  anonLimit:  num(e.RL_GENERAL_ANON,   60),
  authLimit:  num(e.RL_GENERAL_AUTH,   200),
  adminLimit: 0,
  burstAllowance: 20,
}

// ── Booking endpoints ─────────────────────────────────────────────────────────

export const BOOKINGS: RateLimitConfig = {
  windowSec: num(e.RL_BOOKINGS_WINDOW, 3_600),
  anonLimit:  num(e.RL_BOOKINGS_ANON,   0),
  authLimit:  num(e.RL_BOOKINGS_AUTH,   10),
  adminLimit: 0,
  burstAllowance: 2,
}

// ── Admin allowlist ───────────────────────────────────────────────────────────

/**
 * IP addresses that bypass all rate limits.
 * Comma-separated in RL_ALLOWLIST env var.
 */
export const RATE_LIMIT_ALLOWLIST: Set<string> = new Set(
  (e.RL_ALLOWLIST ?? '').split(',').map(s => s.trim()).filter(Boolean),
)

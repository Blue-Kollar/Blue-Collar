import rateLimit from 'express-rate-limit'

// ── Rate limit windows ─────────────────────────────────────────────────────────
const STRICT_WINDOW_MS = 15 * 60 * 1000    // 15 minutes (for sensitive operations)
const MODERATE_WINDOW_MS = 60 * 60 * 1000  // 1 hour
const LIBERAL_WINDOW_MS = 60 * 60 * 1000   // 1 hour (for read operations)

const rateLimitResponse = {
  status: 'error',
  message: 'Too many requests, please try again later.',
  code: 429,
}

// ── Auth rate limiters ─────────────────────────────────────────────────────────
// Protect password-sensitive endpoints: login, password reset
export const strictAuthRateLimiter = rateLimit({
  windowMs: STRICT_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.setHeader('Retry-After', String(Math.ceil(STRICT_WINDOW_MS / 1000)))
    res.status(429).json(rateLimitResponse)
  },
})

// Moderate auth limiter: registration, verification
export const moderateAuthRateLimiter = rateLimit({
  windowMs: MODERATE_WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.setHeader('Retry-After', String(Math.ceil(MODERATE_WINDOW_MS / 1000)))
    res.status(429).json(rateLimitResponse)
  },
})

// ── Public read rate limiters ──────────────────────────────────────────────────
// For GET endpoints that are freely accessible (listings, details)
export const publicReadRateLimiter = rateLimit({
  windowMs: LIBERAL_WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.setHeader('Retry-After', String(Math.ceil(LIBERAL_WINDOW_MS / 1000)))
    res.status(429).json(rateLimitResponse)
  },
})

// ── Public write rate limiters ─────────────────────────────────────────────────
// For POST/PUT/DELETE operations that have side effects (testnet fund, wallet ops)
export const publicWriteRateLimiter = rateLimit({
  windowMs: STRICT_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.setHeader('Retry-After', String(Math.ceil(STRICT_WINDOW_MS / 1000)))
    res.status(429).json(rateLimitResponse)
  },
})

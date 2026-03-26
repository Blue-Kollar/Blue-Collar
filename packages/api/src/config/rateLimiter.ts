import rateLimit from 'express-rate-limit'

/**
 * Rate limiter configuration for authentication endpoints.
 * Protects against brute-force attacks by limiting the number of requests
 * from a single IP address within a time window.
 */

// Get configuration from environment variables with sensible defaults
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 10 // 10 requests

/**
 * Rate limiter for sensitive auth endpoints like login and forgot-password.
 * Limits to 10 requests per 15 minutes by default.
 */
export const authRateLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    message: {
        status: 'error',
        message: 'Too many requests from this IP, please try again later.',
        code: 429,
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Add Retry-After header
    handler: (req, res) => {
        res.status(429).set('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))).json({
            status: 'error',
            message: 'Too many requests from this IP, please try again later.',
            code: 429,
        })
    },
})

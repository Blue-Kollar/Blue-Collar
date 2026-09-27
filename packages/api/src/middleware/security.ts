import type { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { corsConfig } from '../config/cors.js'

export const MAX_BODY_SIZE = '100kb'
export const MAX_URLENCODED_SIZE = '100kb'
export const MAX_JSON_DEPTH = 20

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge: 15_552_000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  dnsPrefetchControl: { allow: false },
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
  hidePoweredBy: true,
  ieNoOpen: true,
})

export const strictCors = cors(corsConfig)

/**
 * Global rate limiter — defence-in-depth against DoS and brute-force.
 * Applies to all routes after security headers/CORS but before any
 * application middleware. Route-specific limiters (auth, export) apply
 * on top of this one.
 *
 * Rate: 200 requests per minute per IP.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.', code: 429 },
})

export function depthLimiter(req: Request, _res: Response, next: NextFunction) {
  function checkDepth(value: unknown, depth = 0): boolean {
    if (depth > MAX_JSON_DEPTH) return false
    if (Array.isArray(value)) return value.every((v) => checkDepth(v, depth + 1))
    if (value !== null && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).every((v) => checkDepth(v, depth + 1))
    }
    return true
  }
  if (req.body && typeof req.body === 'object' && !checkDepth(req.body)) {
    req.body = {}
  }
  next()
}

export function applySecurity(app: { use: (mw: unknown) => void; disable: (x: string) => void }) {
  app.disable('x-powered-by')
  app.use(securityHeaders)
  app.use(strictCors)
  app.use(globalRateLimiter)
}

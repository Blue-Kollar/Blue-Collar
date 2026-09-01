import type { NextFunction, Request, Response } from 'express'
import xss from 'xss'

type Sanitizable = string | number | boolean | null | undefined | Sanitizable[] | { [key: string]: Sanitizable }

// Maximum nesting depth — prevents prototype pollution and stack-overflow via deeply nested objects.
const MAX_DEPTH = 20

// Common SQL injection patterns — Prisma uses parameterized queries so this is
// a defence-in-depth layer, not the primary protection.
const SQL_INJECTION_RE =
  /(\b(select|insert|update|delete|drop|alter|create|truncate|exec|union|into|from|where)\b.*\b(from|table|database|schema|where|values)\b)|(-{2}|\/\*|\*\/|;)/i

// WAF-style patterns: path traversal, null bytes, SSTI/EL injection probes.
const WAF_RE = /(\.\.[/\\])|(\/etc\/passwd)|(%00|\x00)|(\{\{.*\}\})|\$\{.*\}|(eval\s*\()/i

/**
 * Returns true if the string contains recognisable SQL injection patterns.
 * Inputs that match are replaced with an empty string by sanitizeValue.
 */
function hasSqlInjection(value: string): boolean {
  return SQL_INJECTION_RE.test(value)
}

/** Returns true if the string matches WAF-blocked patterns. */
function hasWafPattern(value: string): boolean {
  return WAF_RE.test(value)
}

function sanitizeValue(value: Sanitizable, depth = 0): Sanitizable {
  if (depth > MAX_DEPTH) return ''
  if (typeof value === 'string') {
    const xssCleaned = xss(value)
    if (hasSqlInjection(xssCleaned) || hasWafPattern(xssCleaned)) return ''
    return xssCleaned
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1))
  if (value !== null && typeof value === 'object') return sanitizeObject(value, depth + 1)
  return value
}

function sanitizeObject(obj: { [key: string]: Sanitizable }, depth = 0) {
  // Guard against prototype pollution via __proto__, constructor, prototype keys
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype')
      .map(([key, value]) => [key, sanitizeValue(value, depth)])
  )
}

/** Sanitize req.body and req.query (XSS + SQL injection + WAF pattern removal). */
export function sanitize(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeObject(req.body)
  if (req.query && typeof req.query === 'object')
    // Express types req.query as ParsedQs which is structurally compatible with
    // { [key: string]: Sanitizable } at runtime; the cast is intentional.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express ParsedQs<->Sanitizable structural mismatch
    req.query = sanitizeObject(req.query as { [key: string]: Sanitizable }) as any
  next()
}

/** Sanitize req.params (route parameters). */
export function sanitizeParams(req: Request, _res: Response, next: NextFunction) {
  if (req.params && typeof req.params === 'object')
    // Same intentional cast as above for req.params.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express params type<->Sanitizable structural mismatch
    req.params = sanitizeObject(req.params as { [key: string]: Sanitizable }) as any
  next()
}

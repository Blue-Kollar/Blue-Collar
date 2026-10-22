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

export function sanitizeValue(value: Sanitizable, depth = 0): Sanitizable {
  if (depth > MAX_DEPTH) return ''
  if (typeof value === 'string') return sanitizeText(value)
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1))
  if (value !== null && typeof value === 'object') return sanitizeObject(value, depth + 1)
  return value
}

export function sanitizeObject(obj: { [key: string]: Sanitizable }, depth = 0) {
  // Guard against prototype pollution via __proto__, constructor, prototype keys
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype')
      .map(([key, value]) => [key, sanitizeValue(value, depth)])
  )
}

/**
 * Sanitize a single free-text value (e.g. worker bio, message body) before
 * storage or display. Strips HTML tags, escapes dangerous characters via the
 * `xss` library, and blanks out SQL-injection / WAF probe payloads.
 *
 * Reusable from controllers and services for write paths that bypass the
 * `sanitize` middleware (e.g. internal calls, background jobs).
 */
export function sanitizeText(value: string): string {
  const cleaned = xss(value)
  if (hasSqlInjection(cleaned) || hasWafPattern(cleaned)) return ''
  return cleaned
}

/** Alias for {@link sanitizeText} — explicit name for free-text fields. */
export const sanitizeFreeText = sanitizeText

/**
 * Sanitize req.body and req.query (XSS + SQL injection + WAF pattern removal).
 * Apply to every route that accepts free text (bios, messages, names, etc.).
 */
export function sanitize(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeObject(req.body)
  if (req.query && typeof req.query === 'object')
    req.query = sanitizeObject(req.query as { [key: string]: Sanitizable }) as unknown as Request['query']
  next()
}

/** Alias for {@link sanitize} — explicit name for body-only free-text routes. */
export const sanitizeBody = sanitize

/** Sanitize req.params (route parameters). */
export function sanitizeParams(req: Request, _res: Response, next: NextFunction) {
  if (req.params && typeof req.params === 'object')
    req.params = sanitizeObject(req.params as { [key: string]: Sanitizable }) as unknown as Request['params']
  next()
}

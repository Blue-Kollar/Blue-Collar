import type { Request, Response, NextFunction } from 'express'
import type { Prisma } from '@prisma/client'
import { db } from '../db.js'

const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Idempotency middleware (#517).
 * Checks for a stored response keyed by `Idempotency-Key` header + userId.
 * On first request: processes normally and stores the response.
 * On retry: returns the cached response immediately.
 */
export function idempotency(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['idempotency-key'] as string | undefined
  if (!key) return next()

  const userId = req.user?.id ?? null

  // Intercept res.json to capture and store the response
  const originalJson = res.json.bind(res)
  res.json = function (body: Prisma.InputJsonValue) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const expiresAt = new Date(Date.now() + TTL_MS)
      db.idempotencyKey
        .upsert({
          where: { key_userId: { key, userId: userId ?? '' } },
          create: { key, userId, responseBody: body, statusCode: res.statusCode, expiresAt },
          update: { responseBody: body, statusCode: res.statusCode, expiresAt },
        })
        .catch(() => {})
    }
    return originalJson(body)
  }

  // Check for existing stored response
  const lookupKey = userId ?? ''
  db.idempotencyKey
    .findUnique({ where: { key_userId: { key, userId: lookupKey } } })
    .then((stored) => {
      if (stored && stored.expiresAt > new Date()) {
        return res.status(stored.statusCode).json(stored.responseBody)
      }
      next()
    })
    .catch(() => next())
}

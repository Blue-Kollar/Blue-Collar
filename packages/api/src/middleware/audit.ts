import type { Request, Response, NextFunction } from 'express'
import { log } from '../services/audit.service.js'

// Map HTTP method + route pattern to an audit action
const ACTION_MAP: Array<{ method: string; pattern: RegExp; action: string; resource: string }> = [
  { method: 'POST',   pattern: /^\/api\/auth\/login$/,           action: 'auth.login',           resource: 'User' },
  { method: 'POST',   pattern: /^\/api\/auth\/register$/,        action: 'auth.register',         resource: 'User' },
  { method: 'DELETE', pattern: /^\/api\/auth\/logout$/,          action: 'auth.logout',           resource: 'User' },
  { method: 'PUT',    pattern: /^\/api\/auth\/reset-password$/,  action: 'auth.password_reset',   resource: 'User' },
  { method: 'POST',   pattern: /^\/api\/workers$/,               action: 'worker.create',         resource: 'Worker' },
  { method: 'PUT',    pattern: /^\/api\/workers\/[^/]+$/,        action: 'worker.update',         resource: 'Worker' },
  { method: 'DELETE', pattern: /^\/api\/workers\/[^/]+$/,        action: 'worker.delete',         resource: 'Worker' },
  { method: 'PATCH',  pattern: /^\/api\/workers\/[^/]+\/toggle$/, action: 'worker.toggle',        resource: 'Worker' },
  { method: 'PATCH',  pattern: /^\/api\/verifications\/[^/]+\/review$/, action: 'admin.verification_review', resource: 'VerificationRequest' },
  { method: 'DELETE', pattern: /^\/api\/admin\//,                action: 'admin.action',          resource: 'Admin' },
  { method: 'PATCH',  pattern: /^\/api\/admin\//,                action: 'admin.action',          resource: 'Admin' },
]

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const match = ACTION_MAP.find(
    (m) => m.method === req.method && m.pattern.test(req.path),
  )
  if (!match) return next()

  const originalJson = res.json.bind(res)
  res.json = function (body: any) {
    // Only log on success (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const resourceId = req.params?.id ?? body?.data?.id ?? undefined
      log({
        userId: req.user?.id,
        action: match.action,
        resource: match.resource,
        resourceId,
        meta: {
          ip: req.ip,
          method: req.method,
          path: req.path,
        },
      }).catch(() => {})
    }
    return originalJson(body)
  }

  next()
}

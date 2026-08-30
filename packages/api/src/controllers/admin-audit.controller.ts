/**
 * Admin audit log controller — thin HTTP layer.
 *
 * Issue #1215: standardize error handling — wraps handler in `catchAsync` so
 * any rejection propagates to the global `errorHandler` middleware.
 */
import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'

export const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { userId, action, resource, from, to, page = '1', limit = '50' } = req.query as Record<string, string>
  const { queryLogs } = await import('../services/audit.service.js')
  const result = await queryLogs({
    userId,
    action,
    resource,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    page: Number(page),
    limit: Number(limit),
  })
  return res.json({ ...result, status: 'success', code: 200 })
})

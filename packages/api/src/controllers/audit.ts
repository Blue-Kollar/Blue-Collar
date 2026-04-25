import type { Request, Response } from 'express'
import * as auditService from '../services/audit.service.js'
import { handleError } from '../utils/handleError.js'

export async function queryLogs(req: Request, res: Response) {
  try {
    const { userId, action, resource, from, to, page = '1', limit = '50' } = req.query
    const result = await auditService.queryLogs({
      userId: userId as string | undefined,
      action: action as string | undefined,
      resource: resource as string | undefined,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
      page: Number(page),
      limit: Math.min(Number(limit), 200),
    })
    return res.json({ ...result, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

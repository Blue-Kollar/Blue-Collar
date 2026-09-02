import type { Request, Response } from 'express'

import { ErrorMessages } from '../constants/errors.js'
import { db } from '../db.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { catchAsync } from '../utils/catchAsync.js'
import { paginate } from '../utils/paginate.js'

export const listWorkers = catchAsync(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', search, status } = req.query as Record<string, string | undefined>

  const where: Record<string, unknown> = {}
  if (status === 'suspended') {
    where.deletedAt = { not: null }
  } else if (status === 'active' || !status) {
    where.deletedAt = null
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { bio: { contains: search, mode: 'insensitive' } },
    ]
  }

  const { data, meta } = await paginate({
    model: 'worker',
    where,
    page: Number(page),
    limit: Number(limit),
  })

  return res.json({ data, meta, status: 'success', code: 200 })
})

export const bulkToggleWorkers = catchAsync(async (req: Request, res: Response) => {
  const { ids, active } = req.body as { ids?: unknown; active?: unknown }

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError(ErrorMessages.IDS_MUST_BE_NON_EMPTY_ARRAY, 400, true, ErrorCode.VALIDATION_ERROR)
  }
  if (typeof active !== 'boolean') {
    throw new AppError(ErrorMessages.ACTIVE_MUST_BE_BOOLEAN, 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const result = await db.$transaction(async (tx) => {
    await tx.worker.updateMany({ where: { id: { in: ids as string[] } }, data: { isActive: active } })
    return tx.worker.count({ where: { id: { in: ids as string[] } } })
  })

  return res.json({ data: { updated: result, active }, status: 'success', code: 200 })
})

export const bulkDeleteWorkers = catchAsync(async (req: Request, res: Response) => {
  const { ids } = req.body as { ids?: unknown }

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError(ErrorMessages.IDS_MUST_BE_NON_EMPTY_ARRAY, 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const result = await db.$transaction(async (tx) => {
    const { count } = await tx.worker.deleteMany({ where: { id: { in: ids as string[] } } })
    return count
  })

  return res.json({ data: { deleted: result }, status: 'success', code: 200 })
})

export const moderateWorker = catchAsync(async (req: Request, res: Response) => {
  const { action, reason } = req.body as { action?: string; reason?: string }
  if (!action || !['approve', 'reject'].includes(action)) {
    throw new AppError(ErrorMessages.REVIEW_ACTION_INVALID, 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const worker = await db.worker.findUnique({ where: { id: req.params.id } })
  if (!worker) {
    throw new AppError(ErrorMessages.WORKER_NOT_FOUND, 404, true, ErrorCode.NOT_FOUND)
  }

  const isActive = action === 'approve'
  const updated = await db.worker.update({
    where: { id: req.params.id },
    data: { isActive, isVerified: isActive },
    select: { id: true, name: true, isActive: true, isVerified: true },
  })
  await db.auditLog.create({
    data: {
      userId: req.user!.id,
      action: `worker.${action}`,
      resource: 'worker',
      resourceId: req.params.id,
      meta: { reason: reason ?? null },
    },
  })
  return res.json({ data: updated, status: 'success', code: 200 })
})

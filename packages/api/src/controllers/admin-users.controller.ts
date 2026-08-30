/**
 * Admin users controller — thin HTTP layer.
 *
 * All handlers are wrapped with `catchAsync` so any thrown `AppError` (or
 * unexpected rejection) propagates to the global `errorHandler` middleware,
 * ensuring every error response has the standard
 * `{ status, message, code, errorCode, traceId }` shape.
 *
 * Issue #1215: standardize error handling — wraps all previously bare async
 * handlers in `catchAsync`.
 */
import type { Request, Response } from 'express'
import { db } from '../db.js'
import { paginate } from '../utils/paginate.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { catchAsync } from '../utils/catchAsync.js'

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', search, role, status } = req.query as Record<string, string | undefined>

  const where: Record<string, unknown> = {}
  if (status === 'suspended') {
    where.deletedAt = { not: null }
  } else if (status === 'active' || !status) {
    where.deletedAt = null
  }
  if (role && ['user', 'curator', 'admin'].includes(role)) {
    where.role = role
  }
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  const { data, meta } = await paginate({
    model: 'user',
    where,
    page: Number(page),
    limit: Number(limit),
  })

  return res.json({ data, meta, status: 'success', code: 200 })
})

export const suspendUser = catchAsync(async (req: Request, res: Response) => {
  const user = await db.user.findUnique({ where: { id: req.params.id } })
  if (!user) throw new AppError('User not found', 404, true, ErrorCode.NOT_FOUND)
  if (user.role === 'admin') throw new AppError('Cannot suspend another admin', 403, true, ErrorCode.FORBIDDEN)

  await db.user.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })
  await db.auditLog.create({
    data: { userId: req.user!.id, action: 'user.suspend', resource: 'user', resourceId: req.params.id },
  })
  return res.json({ data: { id: req.params.id, suspended: true }, status: 'success', code: 200 })
})

async function bulkSetUserSuspension(req: Request, res: Response, suspend: boolean) {
  const { ids } = req.body as { ids?: unknown }

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('ids must be a non-empty array', 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const targets = await db.user.findMany({
    where: { id: { in: ids as string[] }, ...(suspend ? { role: { not: 'admin' } } : {}) },
    select: { id: true },
  })
  const targetIds = targets.map((u) => u.id)

  if (targetIds.length === 0) {
    return res.json({ data: { updated: 0, suspended: suspend }, status: 'success', code: 200 })
  }

  await db.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: { in: targetIds } },
      data: { deletedAt: suspend ? new Date() : null },
    })
    await tx.auditLog.createMany({
      data: targetIds.map((id) => ({
        userId: req.user!.id,
        action: suspend ? 'user.bulk_suspend' : 'user.bulk_unsuspend',
        resource: 'user',
        resourceId: id,
      })),
    })
  })

  return res.json({ data: { updated: targetIds.length, suspended: suspend }, status: 'success', code: 200 })
}

export const bulkSuspendUsers = catchAsync(async (req: Request, res: Response) => {
  return bulkSetUserSuspension(req, res, true)
})

export const bulkUnsuspendUsers = catchAsync(async (req: Request, res: Response) => {
  return bulkSetUserSuspension(req, res, false)
})

export const unsuspendUser = catchAsync(async (req: Request, res: Response) => {
  const user = await db.user.findUnique({ where: { id: req.params.id } })
  if (!user) throw new AppError('User not found', 404, true, ErrorCode.NOT_FOUND)

  await db.user.update({ where: { id: req.params.id }, data: { deletedAt: null } })
  await db.auditLog.create({
    data: { userId: req.user!.id, action: 'user.unsuspend', resource: 'user', resourceId: req.params.id },
  })
  return res.json({ data: { id: req.params.id, suspended: false }, status: 'success', code: 200 })
})

export const banUser = catchAsync(async (req: Request, res: Response) => {
  const user = await db.user.findUnique({ where: { id: req.params.id } })
  if (!user) throw new AppError('User not found', 404, true, ErrorCode.NOT_FOUND)
  if (user.role === 'admin') throw new AppError('Cannot ban another admin', 403, true, ErrorCode.FORBIDDEN)

  await db.user.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date(), email: `banned-${user.id}@deleted.local` },
  })
  await db.auditLog.create({
    data: { userId: req.user!.id, action: 'user.ban', resource: 'user', resourceId: req.params.id },
  })
  return res.json({ data: { id: req.params.id, banned: true }, status: 'success', code: 200 })
})

export const changeRole = catchAsync(async (req: Request, res: Response) => {
  const { role } = req.body as { role?: string }
  if (!role || !['user', 'curator', 'admin'].includes(role)) {
    throw new AppError('role must be one of: user, curator, admin', 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const user = await db.user.findUnique({ where: { id: req.params.id } })
  if (!user) throw new AppError('User not found', 404, true, ErrorCode.NOT_FOUND)
  if (user.role === 'admin' && req.user!.id !== user.id) {
    throw new AppError('Cannot change role of another admin', 403, true, ErrorCode.FORBIDDEN)
  }

  const updated = await db.user.update({
    where: { id: req.params.id },
    data: { role: role as any },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  })
  await db.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'user.change_role',
      resource: 'user',
      resourceId: req.params.id,
      meta: { previousRole: user.role, newRole: role },
    },
  })
  return res.json({ data: updated, status: 'success', code: 200 })
})

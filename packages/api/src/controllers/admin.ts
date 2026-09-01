import type { Request, Response } from 'express'
import { paginate } from '../utils/paginate.js'
import { db } from '../db.js'
import { restoreWorker } from '../services/worker.service.js'

export async function listWorkers(req: Request, res: Response) {
  const { page = '1', limit = '20' } = req.query
  const { data, meta } = await paginate({
    model: 'worker',
    where: { deletedAt: null },
    include: { category: true, curator: true },
    page: Number(page),
    limit: Number(limit),
  })
  return res.json({ data, meta, status: 'success', code: 200 })
}

export async function listUsers(req: Request, res: Response) {
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
}

export async function restoreWorkerHandler(req: Request, res: Response) {
  const worker = await restoreWorker(req.params.id)
  return res.json({ data: worker, status: 'success', code: 200 })
}

export async function getStats(req: Request, res: Response) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    totalWorkers,
    activeWorkers,
    totalUsers,
    totalCurators,
    workersThisMonth,
    usersThisMonth,
    topCategories,
    recentWorkers,
    recentUsers,
  ] = await Promise.all([
    db.worker.count(),
    db.worker.count({ where: { isActive: true } }),
    db.user.count(),
    db.user.count({ where: { role: 'curator' } }),
    db.worker.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.category.findMany({
      select: { id: true, name: true, _count: { select: { workers: true } } },
      orderBy: { workers: { _count: 'desc' } },
      take: 5,
    }),
    db.worker.findMany({
      select: { id: true, name: true, createdAt: true, category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, role: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return res.json({
    data: {
      totalWorkers,
      activeWorkers,
      totalUsers,
      totalCurators,
      workersThisMonth,
      usersThisMonth,
      topCategories: topCategories.map((cat) => ({
        name: cat.name,
        count: cat._count.workers,
      })),
      recentWorkers,
      recentUsers,
    },
    status: 'success',
    code: 200,
  })
}

/**
 * POST /api/admin/workers/bulk-toggle
 * Activate or deactivate multiple workers in a single transaction.
 *
 * Body: { ids: string[], active: boolean }
 */
export async function bulkToggleWorkers(req: Request, res: Response) {
  const { ids, active } = req.body as { ids?: unknown; active?: unknown }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ status: 'error', message: 'ids must be a non-empty array', code: 400 })
  }
  if (typeof active !== 'boolean') {
    return res.status(400).json({ status: 'error', message: 'active must be a boolean', code: 400 })
  }

  const result = await db.$transaction(async (tx) => {
    await tx.worker.updateMany({ where: { id: { in: ids as string[] } }, data: { isActive: active } })
    return tx.worker.count({ where: { id: { in: ids as string[] } } })
  })

  return res.json({ data: { updated: result, active }, status: 'success', code: 200 })
}

/**
 * DELETE /api/admin/workers/bulk-delete
 * Delete multiple workers in a single transaction.
 *
 * Body: { ids: string[] }
 */
export async function bulkDeleteWorkers(req: Request, res: Response) {
  const { ids } = req.body as { ids?: unknown }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ status: 'error', message: 'ids must be a non-empty array', code: 400 })
  }

  const result = await db.$transaction(async (tx) => {
    const { count } = await tx.worker.deleteMany({ where: { id: { in: ids as string[] } } })
    return count
  })

  return res.json({ data: { deleted: result }, status: 'success', code: 200 })
}

export async function suspendUser(req: Request, res: Response) {
  const user = await db.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found', code: 404 })
  if (user.role === 'admin') return res.status(403).json({ status: 'error', message: 'Cannot suspend another admin', code: 403 })

  await db.user.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })
  await db.auditLog.create({
    data: { userId: req.user!.id, action: 'user.suspend', resource: 'user', resourceId: req.params.id },
  })
  return res.json({ data: { id: req.params.id, suspended: true }, status: 'success', code: 200 })
}

/**
 * POST /api/admin/users/bulk-suspend
 * PATCH /api/admin/users/bulk-unsuspend
 * Suspend or unsuspend multiple users in a single transaction.
 * Admins in the id list are skipped (cannot be suspended).
 *
 * Body: { ids: string[] }
 */
async function bulkSetUserSuspension(req: Request, res: Response, suspend: boolean) {
  const { ids } = req.body as { ids?: unknown }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ status: 'error', message: 'ids must be a non-empty array', code: 400 })
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

export async function bulkSuspendUsers(req: Request, res: Response) {
  return bulkSetUserSuspension(req, res, true)
}

export async function bulkUnsuspendUsers(req: Request, res: Response) {
  return bulkSetUserSuspension(req, res, false)
}

export async function unsuspendUser(req: Request, res: Response) {
  const user = await db.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found', code: 404 })

  await db.user.update({ where: { id: req.params.id }, data: { deletedAt: null } })
  await db.auditLog.create({
    data: { userId: req.user!.id, action: 'user.unsuspend', resource: 'user', resourceId: req.params.id },
  })
  return res.json({ data: { id: req.params.id, suspended: false }, status: 'success', code: 200 })
}

export async function banUser(req: Request, res: Response) {
  const user = await db.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found', code: 404 })
  if (user.role === 'admin') return res.status(403).json({ status: 'error', message: 'Cannot ban another admin', code: 403 })

  await db.user.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date(), email: `banned-${user.id}@deleted.local` },
  })
  await db.auditLog.create({
    data: { userId: req.user!.id, action: 'user.ban', resource: 'user', resourceId: req.params.id },
  })
  return res.json({ data: { id: req.params.id, banned: true }, status: 'success', code: 200 })
}

/**
 * PATCH /api/admin/users/:id/role
 * Change a user's role. Admins cannot demote other admins.
 * Body: { role: 'user' | 'curator' | 'admin' }
 */
export async function changeRole(req: Request, res: Response) {
  const { role } = req.body as { role?: string }
  if (!role || !['user', 'curator', 'admin'].includes(role)) {
    return res.status(400).json({ status: 'error', message: 'role must be one of: user, curator, admin', code: 400 })
  }

  const user = await db.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found', code: 404 })
  if (user.role === 'admin' && req.user!.id !== user.id) {
    return res.status(403).json({ status: 'error', message: 'Cannot change role of another admin', code: 403 })
  }

  const updated = await db.user.update({
    where: { id: req.params.id },
    // `role` is validated by the route schema as 'user'|'curator'|'admin'; Prisma expects the
    // Role enum. String cast is safe here given upstream validation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma Role enum cast validated by route schema
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
}

/**
 * PATCH /api/admin/workers/:id/moderate
 * Approve or reject a worker listing.
 * Body: { action: 'approve' | 'reject', reason?: string }
 */
export async function moderateWorker(req: Request, res: Response) {
  const { action, reason } = req.body as { action?: string; reason?: string }
  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ status: 'error', message: 'action must be approve or reject', code: 400 })
  }

  const worker = await db.worker.findUnique({ where: { id: req.params.id } })
  if (!worker) return res.status(404).json({ status: 'error', message: 'Worker not found', code: 404 })

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
}

/**
 * GET /api/admin/audit
 * Query audit logs with optional filters.
 */
export async function listAuditLogs(req: Request, res: Response) {
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
}

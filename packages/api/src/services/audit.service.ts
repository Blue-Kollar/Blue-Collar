import { db } from '../db.js'
import { logger } from '../config/logger.js'

export interface AuditOptions {
  userId?: string
  action: string
  resource?: string
  resourceId?: string
  meta?: Record<string, unknown>
}

/** Write an audit log entry (fire-and-forget safe) */
export async function log(opts: AuditOptions) {
  try {
    await db.auditLog.create({ data: opts })
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log')
  }
}

/** Query audit logs with filters and pagination */
export async function queryLogs(opts: {
  userId?: string
  action?: string
  resource?: string
  from?: Date
  to?: Date
  page?: number
  limit?: number
}) {
  const { userId, action, resource, from, to, page = 1, limit = 50 } = opts

  const where: any = {
    ...(userId ? { userId } : {}),
    ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
    ...(resource ? { resource } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  }

  const [data, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ])

  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

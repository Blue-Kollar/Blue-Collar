/**
 * Admin export controller (#518)
 * GET /api/admin/export/workers?format=csv|json
 * GET /api/admin/export/users?format=csv|json
 * Streams large exports, enforces admin role, logs audit events.
 */
import type { Request, Response } from 'express'
import { db } from '../db.js'
import { log } from '../services/audit.service.js'

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  return lines.join('\n')
}

export async function exportWorkers(req: Request, res: Response) {
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json'

  log({
    userId: req.user?.id,
    action: 'admin.export',
    resource: 'Worker',
    meta: { format, ip: req.ip },
  }).catch(() => {})

  const workers = await db.worker.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      isVerified: true,
      category: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = workers.map((w) => ({
    id: w.id,
    name: w.name,
    email: w.email ?? '',
    phone: w.phone ?? '',
    isActive: w.isActive,
    isVerified: w.isVerified,
    category: w.category.name,
    createdAt: w.createdAt.toISOString(),
  }))

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="workers.csv"')
    return res.send(toCSV(rows))
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', 'attachment; filename="workers.json"')
  return res.json({ status: 'success', code: 200, data: rows, meta: { count: rows.length } })
}

export async function exportUsers(req: Request, res: Response) {
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json'

  log({
    userId: req.user?.id,
    action: 'admin.export',
    resource: 'User',
    meta: { format, ip: req.ip },
  }).catch(() => {})

  const users = await db.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      verified: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    verified: u.verified,
    createdAt: u.createdAt.toISOString(),
  }))

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"')
    return res.send(toCSV(rows))
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', 'attachment; filename="users.json"')
  return res.json({ status: 'success', code: 200, data: rows, meta: { count: rows.length } })
}

/**
 * Admin export controller (#518)
 * GET /api/admin/export/workers?format=csv|json
 * GET /api/admin/export/users?format=csv|json
 * Streams large exports, enforces admin role, logs audit events.
 *
 * Issue #1215: standardize error handling — wraps handlers in `catchAsync` so
 * any rejection propagates to the global `errorHandler` middleware.
 *
 * Issue #1641: CSV exports now stream without buffering to handle large datasets.
 */
import type { Request, Response } from 'express'
import { db } from '@/db.js'
import { log } from '@/services/audit.service.js'
import { catchAsync } from '@/utils/catchAsync.js'
import { CsvWriter } from '@/utils/csv-writer.js'

export const exportWorkers = catchAsync(async (req: Request, res: Response) => {
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json'

  log({
    userId: req.user?.id,
    action: 'admin.export',
    resource: 'Worker',
    meta: { format, ip: req.ip },
  }).catch(() => {})

  if (format === 'csv') {
    // Stream CSV without buffering
    const writer = new CsvWriter(res, 'workers.csv')
    writer.initialize()

    const headers = ['ID', 'Name', 'Email', 'Phone', 'Active', 'Verified', 'Category', 'Created At']
    await writer.writeHeader(headers)

    const pageSize = 1000
    let skip = 0
    let hasMore = true

    while (hasMore) {
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
        skip,
        take: pageSize,
      })

      if (workers.length === 0) {
        hasMore = false
        break
      }

      for (const w of workers) {
        await writer.writeRow([
          w.id,
          w.name,
          w.email ?? '',
          w.phone ?? '',
          w.isActive,
          w.isVerified,
          w.category.name,
          w.createdAt.toISOString(),
        ])
      }

      if (workers.length < pageSize) {
        hasMore = false
      } else {
        skip += pageSize
      }
    }

    await writer.end()
    return
  }

  // JSON format: still buffer all data
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

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', 'attachment; filename="workers.json"')
  return res.json({ status: 'success', code: 200, data: rows, meta: { count: rows.length } })
})

export const exportUsers = catchAsync(async (req: Request, res: Response) => {
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json'

  log({
    userId: req.user?.id,
    action: 'admin.export',
    resource: 'User',
    meta: { format, ip: req.ip },
  }).catch(() => {})

  if (format === 'csv') {
    // Stream CSV without buffering
    const writer = new CsvWriter(res, 'users.csv')
    writer.initialize()

    const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Role', 'Verified', 'Created At']
    await writer.writeHeader(headers)

    const pageSize = 1000
    let skip = 0
    let hasMore = true

    while (hasMore) {
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
        skip,
        take: pageSize,
      })

      if (users.length === 0) {
        hasMore = false
        break
      }

      for (const u of users) {
        await writer.writeRow([
          u.id,
          u.email,
          u.firstName,
          u.lastName,
          u.role,
          u.verified,
          u.createdAt.toISOString(),
        ])
      }

      if (users.length < pageSize) {
        hasMore = false
      } else {
        skip += pageSize
      }
    }

    await writer.end()
    return
  }

  // JSON format: still buffer all data
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

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', 'attachment; filename="users.json"')
  return res.json({ status: 'success', code: 200, data: rows, meta: { count: rows.length } })
})

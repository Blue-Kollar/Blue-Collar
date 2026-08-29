/**
 * Integration tests for admin bulk-action endpoints.
 * POST /api/admin/workers/bulk-toggle
 * DELETE /api/admin/workers/bulk-delete
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bulkToggleWorkers, bulkDeleteWorkers, bulkSuspendUsers, bulkUnsuspendUsers } from '../controllers/admin.js'

process.env.JWT_SECRET = 'test-secret'
process.env.APP_URL = 'http://localhost:3001'

const { userFindMany, userUpdateMany, auditLogCreateMany } = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userUpdateMany: vi.fn().mockResolvedValue({ count: 2 }),
  auditLogCreateMany: vi.fn().mockResolvedValue({ count: 2 }),
}))

vi.mock('../db.js', () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      return fn({
        worker: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          count: vi.fn().mockResolvedValue(2),
        },
        user: {
          updateMany: userUpdateMany,
        },
        auditLog: {
          createMany: auditLogCreateMany,
        },
      })
    }),
    user: {
      findMany: userFindMany,
    },
  },
}))

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function mockReq(body: object): any {
  return { body, user: { id: 'admin-1', role: 'admin' } }
}

describe('bulkToggleWorkers', () => {
  it('returns 400 when ids is missing', async () => {
    const res = mockRes()
    await bulkToggleWorkers(mockReq({ active: true }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }))
  })

  it('returns 400 when ids is empty array', async () => {
    const res = mockRes()
    await bulkToggleWorkers(mockReq({ ids: [], active: true }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 400 when active is not boolean', async () => {
    const res = mockRes()
    await bulkToggleWorkers(mockReq({ ids: ['id1'], active: 'yes' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('activates workers and returns count', async () => {
    const res = mockRes()
    await bulkToggleWorkers(mockReq({ ids: ['id1', 'id2'], active: true }), res)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', data: { updated: 2, active: true } })
    )
  })

  it('deactivates workers and returns count', async () => {
    const res = mockRes()
    await bulkToggleWorkers(mockReq({ ids: ['id1', 'id2'], active: false }), res)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', data: { updated: 2, active: false } })
    )
  })
})

describe('bulkDeleteWorkers', () => {
  it('returns 400 when ids is missing', async () => {
    const res = mockRes()
    await bulkDeleteWorkers(mockReq({}), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }))
  })

  it('returns 400 when ids is empty array', async () => {
    const res = mockRes()
    await bulkDeleteWorkers(mockReq({ ids: [] }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('deletes workers and returns count', async () => {
    const res = mockRes()
    await bulkDeleteWorkers(mockReq({ ids: ['id1', 'id2'] }), res)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', data: { deleted: 2 } })
    )
  })
})

describe('bulkSuspendUsers', () => {
  beforeEach(() => {
    userFindMany.mockReset()
    userUpdateMany.mockClear()
    auditLogCreateMany.mockClear()
  })

  it('returns 400 when ids is missing', async () => {
    const res = mockRes()
    await bulkSuspendUsers(mockReq({}), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }))
  })

  it('returns 400 when ids is empty array', async () => {
    const res = mockRes()
    await bulkSuspendUsers(mockReq({ ids: [] }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('excludes admins from the target set, suspends the rest, and writes one audit entry per user', async () => {
    userFindMany.mockResolvedValue([{ id: 'id1' }, { id: 'id2' }])
    const res = mockRes()
    await bulkSuspendUsers(mockReq({ ids: ['id1', 'id2', 'admin-2'] }), res)

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: { not: 'admin' } }) })
    )
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['id1', 'id2'] } },
      data: { deletedAt: expect.any(Date) },
    })
    expect(auditLogCreateMany).toHaveBeenCalledWith({
      data: [
        { userId: 'admin-1', action: 'user.bulk_suspend', resource: 'user', resourceId: 'id1' },
        { userId: 'admin-1', action: 'user.bulk_suspend', resource: 'user', resourceId: 'id2' },
      ],
    })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', data: { updated: 2, suspended: true } })
    )
  })

  it('is a no-op when every id resolves to an admin', async () => {
    userFindMany.mockResolvedValue([])
    const res = mockRes()
    await bulkSuspendUsers(mockReq({ ids: ['admin-2'] }), res)

    expect(userUpdateMany).not.toHaveBeenCalled()
    expect(auditLogCreateMany).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', data: { updated: 0, suspended: true } })
    )
  })
})

describe('bulkUnsuspendUsers', () => {
  beforeEach(() => {
    userFindMany.mockReset()
    userUpdateMany.mockClear()
    auditLogCreateMany.mockClear()
  })

  it('returns 400 when ids is missing', async () => {
    const res = mockRes()
    await bulkUnsuspendUsers(mockReq({}), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('unsuspends the given users without filtering out admins', async () => {
    userFindMany.mockResolvedValue([{ id: 'id1' }, { id: 'admin-2' }])
    const res = mockRes()
    await bulkUnsuspendUsers(mockReq({ ids: ['id1', 'admin-2'] }), res)

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['id1', 'admin-2'] } } })
    )
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['id1', 'admin-2'] } },
      data: { deletedAt: null },
    })
    expect(auditLogCreateMany).toHaveBeenCalledWith({
      data: [
        { userId: 'admin-1', action: 'user.bulk_unsuspend', resource: 'user', resourceId: 'id1' },
        { userId: 'admin-1', action: 'user.bulk_unsuspend', resource: 'user', resourceId: 'admin-2' },
      ],
    })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', data: { updated: 2, suspended: false } })
    )
  })
})

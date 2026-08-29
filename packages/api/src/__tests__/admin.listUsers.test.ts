/**
 * Unit tests for GET /api/admin/users search/role/status filtering (#942).
 * `paginate()` is mocked so we can assert on the `where` clause the
 * controller builds without needing a real Prisma client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { paginateMock } = vi.hoisted(() => ({
  paginateMock: vi.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } }),
}))

vi.mock('../utils/paginate.js', () => ({ paginate: paginateMock }))

import { listUsers } from '../controllers/admin.js'

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function mockReq(query: object): any {
  return { query }
}

describe('listUsers filtering', () => {
  beforeEach(() => {
    paginateMock.mockClear()
  })

  it('defaults to active (non-deleted) users when no status filter is given', async () => {
    await listUsers(mockReq({}), mockRes())
    expect(paginateMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'user', where: { deletedAt: null } })
    )
  })

  it('filters to suspended users', async () => {
    await listUsers(mockReq({ status: 'suspended' }), mockRes())
    expect(paginateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: { not: null } } })
    )
  })

  it('filters by a valid role', async () => {
    await listUsers(mockReq({ role: 'curator' }), mockRes())
    expect(paginateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, role: 'curator' } })
    )
  })

  it('ignores unrecognized role values', async () => {
    await listUsers(mockReq({ role: 'superuser' }), mockRes())
    expect(paginateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    )
  })

  it('builds a case-insensitive OR search across first name, last name, and email', async () => {
    await listUsers(mockReq({ search: 'wanda' }), mockRes())
    expect(paginateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: 'wanda', mode: 'insensitive' } },
            { lastName: { contains: 'wanda', mode: 'insensitive' } },
            { email: { contains: 'wanda', mode: 'insensitive' } },
          ],
        },
      })
    )
  })

  it('combines search, role, and status filters', async () => {
    await listUsers(mockReq({ search: 'wanda', role: 'user', status: 'suspended' }), mockRes())
    expect(paginateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: { not: null },
          role: 'user',
          OR: expect.any(Array),
        }),
      })
    )
  })

  it('passes page and limit through to paginate', async () => {
    await listUsers(mockReq({ page: '3', limit: '10' }), mockRes())
    expect(paginateMock).toHaveBeenCalledWith(expect.objectContaining({ page: 3, limit: 10 }))
  })
})

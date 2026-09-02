import { beforeEach,describe, expect, it, vi } from 'vitest'

import { CategoryRepository } from '../repositories/category.repository.js'
import { UserRepository } from '../repositories/user.repository.js'
import { WorkerRepository } from '../repositories/worker.repository.js'

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock('../db.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    worker: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { db } from '../db.js'

// ── UserRepository ────────────────────────────────────────────────────────────

describe('UserRepository', () => {
  let repo: UserRepository

  beforeEach(() => {
    repo = new UserRepository()
    vi.clearAllMocks()
  })

  it('findById calls db.user.findUnique with id', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: '1' } as any)
    const result = await repo.findById('1')
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } })
    expect(result).toEqual({ id: '1' })
  })

  it('findByEmail calls db.user.findUnique with email', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ email: 'a@b.com' } as any)
    await repo.findByEmail('a@b.com')
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } })
  })

  it('findByGoogleId calls db.user.findUnique with googleId', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    await repo.findByGoogleId('gid123')
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { googleId: 'gid123' } })
  })

  it('findByReferralCode calls db.user.findUnique with referralCode', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    await repo.findByReferralCode('REF123')
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { referralCode: 'REF123' } })
  })

  it('findByResetToken calls db.user.findFirst with token and expiry check', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null)
    await repo.findByResetToken('tok')
    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ resetToken: 'tok' }) })
    )
  })

  it('findByVerificationToken calls db.user.findFirst', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null)
    await repo.findByVerificationToken('vtok')
    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ verificationToken: 'vtok' }) })
    )
  })

  it('create calls db.user.create', async () => {
    const data = { email: 'x@y.com', firstName: 'X', lastName: 'Y', password: 'hash' } as any
    vi.mocked(db.user.create).mockResolvedValue({ id: '2', ...data } as any)
    await repo.create(data)
    expect(db.user.create).toHaveBeenCalledWith({ data })
  })

  it('update calls db.user.update', async () => {
    vi.mocked(db.user.update).mockResolvedValue({ id: '1' } as any)
    await repo.update('1', { firstName: 'New' })
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: '1' }, data: { firstName: 'New' } })
  })

  it('delete calls db.user.delete', async () => {
    vi.mocked(db.user.delete).mockResolvedValue({ id: '1' } as any)
    await repo.delete('1')
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: '1' } })
  })

  it('count calls db.user.count', async () => {
    vi.mocked(db.user.count).mockResolvedValue(5)
    const n = await repo.count()
    expect(n).toBe(5)
  })
})

// ── WorkerRepository ──────────────────────────────────────────────────────────

describe('WorkerRepository', () => {
  let repo: WorkerRepository

  beforeEach(() => {
    repo = new WorkerRepository()
    vi.clearAllMocks()
  })

  it('findById calls db.worker.findUnique', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1' } as any)
    await repo.findById('w1')
    expect(db.worker.findUnique).toHaveBeenCalledWith({ where: { id: 'w1' } })
  })

  it('findByCurator calls db.worker.findMany with curatorId', async () => {
    vi.mocked(db.worker.findMany).mockResolvedValue([])
    await repo.findByCurator('c1')
    expect(db.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { curatorId: 'c1' } })
    )
  })

  it('findActive filters by isActive: true', async () => {
    vi.mocked(db.worker.findMany).mockResolvedValue([])
    await repo.findActive()
    expect(db.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    )
  })

  it('findByCategory filters by categoryId and isActive', async () => {
    vi.mocked(db.worker.findMany).mockResolvedValue([])
    await repo.findByCategory('cat1')
    expect(db.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { categoryId: 'cat1', isActive: true } })
    )
  })

  it('toggleActive flips isActive', async () => {
    vi.mocked(db.worker.findUniqueOrThrow).mockResolvedValue({ id: 'w1', isActive: true } as any)
    vi.mocked(db.worker.update).mockResolvedValue({ id: 'w1', isActive: false } as any)
    const result = await repo.toggleActive('w1')
    expect(db.worker.update).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { isActive: false } })
    expect(result).toEqual({ id: 'w1', isActive: false })
  })

  it('delete calls db.worker.delete', async () => {
    vi.mocked(db.worker.delete).mockResolvedValue({ id: 'w1' } as any)
    await repo.delete('w1')
    expect(db.worker.delete).toHaveBeenCalledWith({ where: { id: 'w1' } })
  })
})

// ── CategoryRepository ────────────────────────────────────────────────────────

describe('CategoryRepository', () => {
  let repo: CategoryRepository

  beforeEach(() => {
    repo = new CategoryRepository()
    vi.clearAllMocks()
  })

  it('findAll returns categories ordered by name', async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([])
    await repo.findAll()
    expect(db.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } })
    )
  })

  it('findByName calls db.category.findUnique', async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue({ id: 'c1', name: 'Plumber' } as any)
    await repo.findByName('Plumber')
    expect(db.category.findUnique).toHaveBeenCalledWith({ where: { name: 'Plumber' } })
  })

  it('create calls db.category.create', async () => {
    const data = { name: 'Electrician' } as any
    vi.mocked(db.category.create).mockResolvedValue({ id: 'c2', ...data } as any)
    await repo.create(data)
    expect(db.category.create).toHaveBeenCalledWith({ data })
  })

  it('count calls db.category.count', async () => {
    vi.mocked(db.category.count).mockResolvedValue(10)
    const n = await repo.count()
    expect(n).toBe(10)
  })
})

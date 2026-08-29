/**
 * Category service tests using the dependency injection pattern.
 *
 * Unlike the module-mock-based tests in category.service.test.ts, these tests
 * inject plain mock objects directly — no vi.mock() needed. This demonstrates
 * how new service tests should be written going forward.
 *
 * See docs/DI_PATTERN.md for the full guide.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCategoryService } from './category.service.js'
import { AppError } from './AppError.js'

const makeMockRepo = () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
})

const mockCategory = {
  id: 'cat-1',
  name: 'Plumbing',
  icon: null,
  description: 'Fix pipes',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('createCategoryService (DI)', () => {
  let mockRepo: ReturnType<typeof makeMockRepo>

  beforeEach(() => {
    mockRepo = makeMockRepo()
  })

  // ── listCategories ──────────────────────────────────────────────────────────

  describe('listCategories', () => {
    it('delegates to repository.findAll', async () => {
      mockRepo.findAll.mockResolvedValue([mockCategory])
      const svc = createCategoryService({ categoryRepository: mockRepo })

      const result = await svc.listCategories()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ name: 'Plumbing' })
      expect(mockRepo.findAll).toHaveBeenCalledOnce()
    })

    it('returns empty array when repository returns none', async () => {
      mockRepo.findAll.mockResolvedValue([])
      const svc = createCategoryService({ categoryRepository: mockRepo })

      expect(await svc.listCategories()).toHaveLength(0)
    })
  })

  // ── getCategory ─────────────────────────────────────────────────────────────

  describe('getCategory', () => {
    it('returns category when found', async () => {
      mockRepo.findById.mockResolvedValue(mockCategory)
      const svc = createCategoryService({ categoryRepository: mockRepo })

      const result = await svc.getCategory('cat-1')

      expect(result).toMatchObject({ id: 'cat-1' })
      expect(mockRepo.findById).toHaveBeenCalledWith('cat-1')
    })

    it('throws AppError 404 when not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      const svc = createCategoryService({ categoryRepository: mockRepo })

      await expect(svc.getCategory('missing')).rejects.toBeInstanceOf(AppError)
      await expect(svc.getCategory('missing')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  // ── createCategory ──────────────────────────────────────────────────────────

  describe('createCategory', () => {
    it('creates and returns new category', async () => {
      mockRepo.findByName.mockResolvedValue(null)
      mockRepo.create.mockResolvedValue({ ...mockCategory, name: 'Electrical' })
      const svc = createCategoryService({ categoryRepository: mockRepo })

      const result = await svc.createCategory({ name: 'Electrical' })

      expect(result).toMatchObject({ name: 'Electrical' })
      expect(mockRepo.create).toHaveBeenCalledOnce()
    })

    it('throws AppError 409 when category name already exists', async () => {
      mockRepo.findByName.mockResolvedValue(mockCategory)
      const svc = createCategoryService({ categoryRepository: mockRepo })

      await expect(svc.createCategory({ name: 'Plumbing' })).rejects.toMatchObject({
        statusCode: 409,
      })
      expect(mockRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── updateCategory ──────────────────────────────────────────────────────────

  describe('updateCategory', () => {
    it('updates and returns category', async () => {
      mockRepo.findById.mockResolvedValue(mockCategory)
      mockRepo.update.mockResolvedValue({ ...mockCategory, name: 'Updated' })
      const svc = createCategoryService({ categoryRepository: mockRepo })

      const result = await svc.updateCategory('cat-1', { name: 'Updated' })

      expect(result).toMatchObject({ name: 'Updated' })
      expect(mockRepo.update).toHaveBeenCalledWith('cat-1', { name: 'Updated' })
    })

    it('throws AppError 404 when category not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      const svc = createCategoryService({ categoryRepository: mockRepo })

      await expect(svc.updateCategory('missing', { name: 'X' })).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  // ── deleteCategory ──────────────────────────────────────────────────────────

  describe('deleteCategory', () => {
    it('deletes and returns deleted category', async () => {
      mockRepo.findById.mockResolvedValue(mockCategory)
      mockRepo.delete.mockResolvedValue(mockCategory)
      const svc = createCategoryService({ categoryRepository: mockRepo })

      const result = await svc.deleteCategory('cat-1')

      expect(result).toMatchObject({ id: 'cat-1' })
      expect(mockRepo.delete).toHaveBeenCalledWith('cat-1')
    })

    it('throws AppError 404 when not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      const svc = createCategoryService({ categoryRepository: mockRepo })

      await expect(svc.deleteCategory('missing')).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})

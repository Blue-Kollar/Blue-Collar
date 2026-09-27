import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '../utils/AppError.js'
import * as categoryService from './category.service.js'

vi.mock('../repositories/category.repository.js', () => ({
  categoryRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
  },
}))

import { categoryRepository } from '../repositories/category.repository.js'

const mockRepo = categoryRepository as any

const mockCategory = { id: 'cat-1', name: 'Plumbing', description: 'Fix pipes', createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => {
  vi.clearAllMocks()
})

// ── listCategories ────────────────────────────────────────────────────────────

describe('listCategories', () => {
  it('returns all categories', async () => {
    mockRepo.findAll.mockResolvedValue([mockCategory])

    const result = await categoryService.listCategories()

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Plumbing')
    expect(mockRepo.findAll).toHaveBeenCalledOnce()
  })

  it('returns empty array when no categories exist', async () => {
    mockRepo.findAll.mockResolvedValue([])

    const result = await categoryService.listCategories()

    expect(result).toHaveLength(0)
  })

  it('returns multiple categories', async () => {
    const cats = [
      mockCategory,
      { ...mockCategory, id: 'cat-2', name: 'Electrical' },
      { ...mockCategory, id: 'cat-3', name: 'Carpentry' },
    ]
    mockRepo.findAll.mockResolvedValue(cats)

    const result = await categoryService.listCategories()

    expect(result).toHaveLength(3)
  })
})

// ── getCategory ───────────────────────────────────────────────────────────────

describe('getCategory', () => {
  it('returns a category by id', async () => {
    mockRepo.findById.mockResolvedValue(mockCategory)

    const result = await categoryService.getCategory('cat-1')

    expect(result).toEqual(mockCategory)
    expect(mockRepo.findById).toHaveBeenCalledWith('cat-1')
  })

  it('throws AppError 404 when category not found', async () => {
    mockRepo.findById.mockResolvedValue(null)

    await expect(categoryService.getCategory('nonexistent')).rejects.toThrow(AppError)
    await expect(categoryService.getCategory('nonexistent')).rejects.toMatchObject({
      message: 'Not found',
      statusCode: 404,
    })
  })

  it('calls repository with the correct id', async () => {
    mockRepo.findById.mockResolvedValue(mockCategory)

    await categoryService.getCategory('cat-42')

    expect(mockRepo.findById).toHaveBeenCalledWith('cat-42')
  })
})

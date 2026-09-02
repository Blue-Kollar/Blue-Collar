import { beforeEach,describe, expect, it, vi } from 'vitest'

vi.mock('../services/category.service.js', () => ({
  listCategories: vi.fn(),
  getCategory: vi.fn(),
}))

vi.mock('../resources/index.js', () => ({
  CategoryResource: vi.fn((c) => c),
  CategoryCollection: vi.fn((c) => c),
}))

import * as categoryService from '../services/category.service.js'
import { getCategory,listCategories } from './categories.js'

function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

beforeEach(() => vi.clearAllMocks())

// ── listCategories ────────────────────────────────────────────────────────────

describe('listCategories', () => {
  it('returns 200 with category collection', async () => {
    const cats = [{ id: '1', name: 'Plumbing' }]
    ;(categoryService.listCategories as any).mockResolvedValue(cats)
    const res = makeRes()
    await listCategories({} as any, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', code: 200 }))
  })

  it('handles service errors gracefully', async () => {
    ;(categoryService.listCategories as any).mockRejectedValue(new Error('DB error'))
    const res = makeRes()
    await listCategories({} as any, res)
    // handleError should have been called — status will be set
    expect(res.status).toHaveBeenCalled()
  })
})

// ── getCategory ───────────────────────────────────────────────────────────────

describe('getCategory', () => {
  it('returns 200 with category when found', async () => {
    ;(categoryService.getCategory as any).mockResolvedValue({ id: '1', name: 'Plumbing' })
    const req = { params: { id: '1' } } as any
    const res = makeRes()
    await getCategory(req, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', code: 200 }))
  })

  it('returns 404 when category is not found', async () => {
    ;(categoryService.getCategory as any).mockResolvedValue(null)
    const req = { params: { id: 'nonexistent' } } as any
    const res = makeRes()
    await getCategory(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Category not found' }))
  })

  it('handles service errors gracefully', async () => {
    ;(categoryService.getCategory as any).mockRejectedValue(new Error('DB error'))
    const req = { params: { id: '1' } } as any
    const res = makeRes()
    await getCategory(req, res)
    expect(res.status).toHaveBeenCalled()
  })
})

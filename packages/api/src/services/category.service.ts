import type { Category } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

import type { CategoryServiceDeps } from '../container/types.js'
import { db as defaultDb } from '../db.js'
import { categoryRepository as defaultCategoryRepository } from '../repositories/category.repository.js'
import { AppError } from '../utils/AppError.js'

// ── Service instance type ─────────────────────────────────────────────────────

/**
 * The shape of a category service instance returned by `createCategoryService`.
 * All methods are bound to the injected dependencies.
 */
export interface CategoryServiceInstance {
  listCategories(): Promise<Category[]>
  listCategoriesWithPagination(skip: number, take: number): Promise<[Category[], number]>
  getCategory(id: string): Promise<Category>
  createCategory(data: { name: string; icon?: string; description?: string }): Promise<Category>
  updateCategory(id: string, data: { name?: string; icon?: string; description?: string }): Promise<Category>
  deleteCategory(id: string): Promise<Category>
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a category service with injected dependencies.
 *
 * This factory enables dependency injection in tests:
 *
 * ```ts
 * const mockRepo = { findAll: vi.fn(), findById: vi.fn(), ... }
 * const svc = createCategoryService({ categoryRepository: mockRepo })
 * ```
 *
 * @param deps - Injectable dependencies.
 * @returns A bound service instance.
 */
export function createCategoryService(deps: CategoryServiceDeps & { db?: PrismaClient }): CategoryServiceInstance {
  const { categoryRepository: repo, db = defaultDb } = deps

  return {
    /**
     * Return all categories ordered by name.
     */
    async listCategories() {
      return repo.findAll()
    },

    /**
     * Return paginated categories with total count.
     */
    async listCategoriesWithPagination(skip: number, take: number) {
      const [categories, total] = await Promise.all([
        db.category.findMany({
          skip,
          take,
          orderBy: { name: 'asc' },
        }),
        db.category.count(),
      ])
      return [categories, total]
    },

    /**
     * Get a single category by id.
     * @throws AppError 404 if not found.
     */
    async getCategory(id: string) {
      const category = await repo.findById(id)
      if (!category) throw new AppError('Not found', 404)
      return category
    },

    /**
     * Create a new category (admin only).
     * @throws AppError 409 if a category with that name already exists.
     */
    async createCategory(data: { name: string; icon?: string; description?: string }) {
      const existing = await repo.findByName(data.name)
      if (existing) throw new AppError('Category already exists', 409)
      return repo.create(data)
    },

    /**
     * Update an existing category by id (admin only).
     * @throws AppError 404 if not found.
     */
    async updateCategory(id: string, data: { name?: string; icon?: string; description?: string }) {
      const category = await repo.findById(id)
      if (!category) throw new AppError('Category not found', 404)
      return repo.update(id, data)
    },

    /**
     * Delete a category by id (admin only).
     * @throws AppError 404 if not found.
     */
    async deleteCategory(id: string) {
      const category = await repo.findById(id)
      if (!category) throw new AppError('Category not found', 404)
      return repo.delete(id)
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────
//
// Controllers import these functions directly:
//   import * as categoryService from '../services/category.service.js'
//
// These re-exports delegate to a default instance wired with production deps,
// keeping all existing controller code and module-mock-based tests working.

const _defaultService = createCategoryService({
  categoryRepository: defaultCategoryRepository,
})

/**
 * Return all categories ordered by name.
 */
export async function listCategories() {
  return _defaultService.listCategories()
}

/**
 * Return paginated categories with total count.
 */
export async function listCategoriesWithPagination(skip: number, take: number) {
  return _defaultService.listCategoriesWithPagination(skip, take)
}

/**
 * Get a single category by id.
 * @throws AppError 404 if not found.
 */
export async function getCategory(id: string) {
  return _defaultService.getCategory(id)
}

/**
 * Create a new category (admin only).
 * @throws AppError 409 if a category with that name already exists.
 */
export async function createCategory(data: { name: string; icon?: string; description?: string }) {
  return _defaultService.createCategory(data)
}

/**
 * Update an existing category by id (admin only).
 * @throws AppError 404 if not found.
 */
export async function updateCategory(id: string, data: { name?: string; icon?: string; description?: string }) {
  return _defaultService.updateCategory(id, data)
}

/**
 * Delete a category by id (admin only).
 * @throws AppError 404 if not found.
 */
export async function deleteCategory(id: string) {
  return _defaultService.deleteCategory(id)
}

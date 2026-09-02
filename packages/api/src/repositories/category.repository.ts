import type { Category, Prisma } from '@prisma/client'

import { db } from '../db.js'
import type { IRepository } from './base.repository.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface ICategoryRepository extends IRepository<Category, Prisma.CategoryCreateInput, Prisma.CategoryUpdateInput> {
  findByName(name: string): Promise<Category | null>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class CategoryRepository implements ICategoryRepository {
  async findById(id: string): Promise<Category | null> {
    return db.category.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Category[]> {
    return db.category.findMany({ skip: opts.skip, take: opts.take, orderBy: { name: 'asc' } })
  }

  async findByName(name: string): Promise<Category | null> {
    return db.category.findUnique({ where: { name } })
  }

  async create(data: Prisma.CategoryCreateInput): Promise<Category> {
    return db.category.create({ data })
  }

  async update(id: string, data: Prisma.CategoryUpdateInput): Promise<Category> {
    return db.category.update({ where: { id }, data })
  }

  async delete(id: string): Promise<Category> {
    return db.category.delete({ where: { id } })
  }

  async count(where?: Prisma.CategoryWhereInput): Promise<number> {
    return db.category.count({ where })
  }
}

export const categoryRepository = new CategoryRepository()

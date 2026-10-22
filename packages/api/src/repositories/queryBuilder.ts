import type { Prisma } from '@prisma/client'

/**
 * Common pagination options
 */
export interface PaginationOpts {
  skip?: number
  take?: number
}

/**
 * Common filtering options
 */
interface FilterOpts {
  where?: Prisma.UserWhereInput | Prisma.WorkerWhereInput
}

/**
 * Common sorting options
 */
interface SortOpts {
  orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.WorkerOrderByWithRelationInput
}

/**
 * Query builder for common Prisma patterns
 */
export class QueryBuilder {
  /**
   * Build pagination parameters
   */
  static pagination(opts: PaginationOpts = {}) {
    const { skip = 0, take = 20 } = opts
    return { skip, take: Math.min(take, 100) } // Cap at 100 to prevent abuse
  }

  /**
   * Build default sort order (newest first)
   */
  static defaultSort() {
    return { createdAt: 'desc' as const }
  }

  /**
   * Build sort order with validation
   */
  static sort(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Prisma.UserOrderByWithRelationInput | Prisma.WorkerOrderByWithRelationInput {
    const validFields = ['createdAt', 'updatedAt', 'name', 'rating']
    const field = validFields.includes(sortBy ?? '') ? (sortBy ?? 'createdAt') : 'createdAt'
    return { [field]: sortOrder }
  }

  /**
   * Build filter with optional conditions
   */
  static filter(conditions: Record<string, unknown> = {}): Prisma.UserWhereInput | Prisma.WorkerWhereInput {
    const where: Record<string, unknown> = {}
    Object.entries(conditions).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        where[key] = value
      }
    })
    return where
  }

  /**
   * Build a complete query with pagination, filtering, and sorting
   */
  static buildQuery(opts: {
    pagination?: PaginationOpts
    filter?: Record<string, unknown>
    sort?: { field?: string; order?: 'asc' | 'desc' }
  } = {}) {
    const { pagination = {}, filter = {}, sort = {} } = opts
    return {
      ...this.pagination(pagination),
      where: this.filter(filter),
      orderBy: this.sort(sort.field, sort.order),
    }
  }
}

/**
 * Pagination utilities for list endpoints.
 * Supports both limit/offset and cursor-based pagination.
 */

export interface PaginationParams {
  page?: number | string
  limit?: number | string
  cursor?: string
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  pages: number
}

/**
 * Parse and validate pagination parameters from query string.
 * Returns default values if parameters are invalid.
 */
export function parsePaginationParams(
  params: PaginationParams,
  options?: { maxLimit?: number; defaultLimit?: number; defaultPage?: number },
): { page: number; limit: number } {
  const maxLimit = options?.maxLimit ?? 100
  const defaultLimit = options?.defaultLimit ?? 20
  const defaultPage = options?.defaultPage ?? 1

  const page = Math.max(1, parseInt(String(params.page ?? defaultPage), 10) || defaultPage)
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(params.limit ?? defaultLimit), 10) || defaultLimit))

  return { page, limit }
}

/**
 * Calculate skip and take values for Prisma findMany.
 */
export function calculateSkipTake(page: number, limit: number): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  }
}

/**
 * Build pagination metadata response.
 */
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

/**
 * Complete pagination utility — parse params, calculate skip/take, and build response.
 */
export function createPaginationHelper(
  queryParams: PaginationParams,
  options?: { maxLimit?: number; defaultLimit?: number; defaultPage?: number },
) {
  const { page, limit } = parsePaginationParams(queryParams, options)
  const { skip, take } = calculateSkipTake(page, limit)

  return {
    page,
    limit,
    skip,
    take,
    buildMeta: (total: number) => buildPaginationMeta(total, page, limit),
  }
}

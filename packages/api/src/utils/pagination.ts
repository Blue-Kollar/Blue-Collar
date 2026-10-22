/**
 * Standard pagination contract for list endpoints.
 *
 * Query params are page/limit for backwards compatibility with existing
 * clients, with an optional opaque `cursor` accepted alongside them for
 * endpoints migrating to cursor-based pagination (recommended for
 * high-write tables, where offset pagination skips/duplicates rows as new
 * records are inserted). `parsePaginationParams` accepts either shape;
 * `buildPaginationMeta` always returns both `page`/`limit` totals and a
 * `nextCursor` so clients can adopt cursor-based paging incrementally.
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
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Encode a stable, opaque cursor from a record's `id` and `createdAt`.
 * Base64-encoded so it's safely transportable in a query string and never
 * meant to be parsed by clients — only round-tripped back via `decodeCursor`.
 */
export function encodeCursor(record: { id: string; createdAt: Date | string }): string {
  const createdAt = record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt
  return Buffer.from(JSON.stringify({ id: record.id, createdAt }), 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string): { id: string; createdAt: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (typeof decoded?.id === 'string' && typeof decoded?.createdAt === 'string') return decoded
    return null
  } catch {
    return null
  }
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
 * Build pagination metadata response. `lastRecord` is the last row of the
 * current page (if any) and is used to derive `nextCursor` — pass it so
 * endpoints migrating to cursor-based pagination get a `nextCursor` for
 * free without changing their page/limit response shape.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
  lastRecord?: { id: string; createdAt: Date | string } | null,
): PaginationMeta {
  const pages = Math.ceil(total / limit)
  const hasMore = page < pages
  return {
    total,
    page,
    limit,
    pages,
    hasMore,
    nextCursor: hasMore && lastRecord ? encodeCursor(lastRecord) : null,
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
  const cursor = queryParams.cursor ? decodeCursor(queryParams.cursor) : null

  return {
    page,
    limit,
    skip,
    take,
    cursor,
    buildMeta: (total: number, lastRecord?: { id: string; createdAt: Date | string } | null) =>
      buildPaginationMeta(total, page, limit, lastRecord),
  }
}

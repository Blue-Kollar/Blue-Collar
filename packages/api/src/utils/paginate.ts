import { db } from '../db.js'

export type PaginationMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
  /** Alias of `totalPages` — several frontend pages read `meta.pages`. */
  pages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

type PaginateArgs = {
  model: 'worker' | 'user'
  where?: Record<string, unknown>
  include?: Record<string, unknown>
  page: number
  limit: number
}

/**
 * Generic pagination helper for Prisma models.
 *
 * Executes a `findMany` and `count` in a single transaction and returns
 * the data alongside computed pagination metadata.
 *
 * @param args.model - The Prisma model name to query (`'worker'` or `'user'`).
 * @param args.where - Optional Prisma `where` filter.
 * @param args.include - Optional Prisma `include` clause.
 * @param args.page - Current page number (1-based).
 * @param args.limit - Number of records per page.
 * @returns `{ data, meta }` where `meta` includes totals and navigation flags.
 *
 * @example
 * const { data, meta } = await paginate<Worker>({
 *   model: 'worker',
 *   where: { isActive: true },
 *   page: 1,
 *   limit: 20,
 * })
 */
export async function paginate<T>({
  model,
  where,
  include,
  page,
  limit,
}: PaginateArgs): Promise<{ data: T[]; meta: PaginationMeta }> {
  const delegate = db[model] as any
  const skip = (page - 1) * limit

  const [data, total]: [T[], number] = await db.$transaction([
    delegate.findMany({ where, include, skip, take: limit }),
    delegate.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      pages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

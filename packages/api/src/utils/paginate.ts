import { db } from '../db.js'

export type PaginationMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
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
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

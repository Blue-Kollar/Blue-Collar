import type { Category, User,Worker } from '@prisma/client'

/**
 * Prisma relational type — extends the generated `Worker` model with required
 * joined relations for the formatted response shape. This is intentionally local
 * to the API package because it depends on `@prisma/client` generated types,
 * not the domain `Worker` type from `@bluecollar/types`. Do not replace with
 * the shared type.
 */
type WorkerWithRelations = Worker & {
  category: Category
  curator: User
}

export function formatWorker(worker: WorkerWithRelations) {
  const { curatorId, categoryId, ...rest } = worker
  return {
    ...rest,
    category: { id: worker.category.id, name: worker.category.name },
    curator: {
      id: worker.curator.id,
      firstName: worker.curator.firstName,
      lastName: worker.curator.lastName,
      avatar: worker.curator.avatar,
    },
  }
}

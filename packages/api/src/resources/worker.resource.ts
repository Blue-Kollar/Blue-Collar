import type { Category, User,Worker } from '@prisma/client'

import { CategoryResource } from './category.resource.js'
import { UserResource } from './user.resource.js'

/**
 * Prisma relational type — extends the generated `Worker` model with optional
 * joined relations. This is intentionally local to the API package because it
 * depends on `@prisma/client` generated types, not the domain `Worker` type
 * from `@bluecollar/types`. Do not replace with the shared type.
 */
type WorkerWithRelations = Worker & {
  category?: Category | null
  curator?: User | null
}

// PII SAFETY: phone and email are excluded from public API responses.
// Contact details are only shared through the contact request flow
// and never via public listing responses.
export function WorkerResource(worker: WorkerWithRelations) {
  return {
    id: worker.id,
    name: worker.name,
    bio: worker.bio,
    avatar: worker.avatar,
    walletAddress: worker.walletAddress,
    isActive: worker.isActive,
    isVerified: worker.isVerified,
    stellarContractId: worker.stellarContractId,
    categoryId: worker.categoryId,
    curatorId: worker.curatorId,
    locationId: worker.locationId,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
    ...(worker.category ? { category: CategoryResource(worker.category) } : {}),
    ...(worker.curator ? { curator: UserResource(worker.curator) } : {}),
  }
}

export function WorkerCollection(workers: WorkerWithRelations[]) {
  return workers.map(WorkerResource)
}

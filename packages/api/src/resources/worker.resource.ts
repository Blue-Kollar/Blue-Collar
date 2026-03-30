import type { Worker, Category, User } from '@prisma/client'
import { CategoryResource } from './category.resource.js'
import { UserResource } from './user.resource.js'

type WorkerWithRelations = Worker & {
  category?: Category | null
  curator?: User | null
}

export function WorkerResource(worker: WorkerWithRelations) {
  return {
    id: worker.id,
    name: worker.name,
    bio: worker.bio,
    avatar: worker.avatar,
    phone: worker.phone,
    email: worker.email,
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

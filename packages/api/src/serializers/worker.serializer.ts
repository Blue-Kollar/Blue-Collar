import type { Category, User,Worker } from '@prisma/client'

import { BaseSerializer } from './base.serializer.js'
import { categorySerializer, type SerializedCategory } from './category.serializer.js'
import { type SerializedUser,userSerializer } from './user.serializer.js'

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

export type SerializedWorker = Omit<Worker, 'searchVector' | 'phone' | 'email'> & {
  category?: SerializedCategory
  curator?: SerializedUser
  images?: { thumb: string | null; medium: string | null; full: string | null }
}

export class WorkerSerializer extends BaseSerializer<WorkerWithRelations, SerializedWorker> {
  serialize(worker: WorkerWithRelations): SerializedWorker {
    // PII SAFETY: phone and email are excluded from public API responses.
    // searchVector is a Prisma `Unsupported("tsvector")` column — not part of the
    // generated Worker type, but stripped defensively in case a raw query ever attaches it.
    const { searchVector: _searchVector, phone, email, category, curator, ...rest } = worker as WorkerWithRelations & { searchVector?: unknown }
    return {
      ...rest,
      images: {
        thumb:  rest.imageThumb  ?? null,
        medium: rest.imageMedium ?? null,
        full:   rest.imageFull   ?? null,
      },
      ...(category ? { category: categorySerializer.serialize(category) } : {}),
      ...(curator  ? { curator:  userSerializer.serialize(curator) }       : {}),
    }
  }
}

export const workerSerializer = new WorkerSerializer()

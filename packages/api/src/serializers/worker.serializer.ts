import type { Worker, Category, User } from '@prisma/client'
import { BaseSerializer } from './base.serializer.js'
import { categorySerializer, type SerializedCategory } from './category.serializer.js'
import { userSerializer, type SerializedUser } from './user.serializer.js'
import { sanitizeText } from '../utils/sanitize.js'

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
      // SANITISATION: neutralise any legacy unsanitised free-text rows on display.
      name: sanitizeText(rest.name),
      bio: rest.bio == null ? rest.bio : sanitizeText(rest.bio),
      images: {
        thumb:  rest.imageThumb  ?? null,
        medium: rest.imageMedium ?? null,
        full:   rest.imageFull   ?? null,
      },
      ...this.embed('category', category, categorySerializer),
      ...this.embed('curator', curator, userSerializer),
    }
  }
}

export const workerSerializer = new WorkerSerializer()

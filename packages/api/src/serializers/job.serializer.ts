import type { Job, Category, User } from '@prisma/client'
import { BaseSerializer } from './base.serializer.js'
import { categorySerializer, type SerializedCategory } from './category.serializer.js'
import { userSerializer, type SerializedUser } from './user.serializer.js'

type JobWithRelations = Job & {
  category?: Category | null
  postedBy?: User | null
}

export type SerializedJob = Job & {
  category?: SerializedCategory
  postedBy?: SerializedUser
}

/**
 * Full job shape (detail views, create/update responses).
 * `JobSummarySerializer` below reuses this instead of re-implementing
 * the same relation-embedding logic for list views.
 */
export class JobSerializer extends BaseSerializer<JobWithRelations, SerializedJob> {
  serialize(job: JobWithRelations): SerializedJob {
    const { category, postedBy, ...rest } = job
    return {
      ...rest,
      ...this.embed('category', category, categorySerializer),
      ...this.embed('postedBy', postedBy, userSerializer),
    }
  }
}

export const jobSerializer = new JobSerializer()

const JOB_SUMMARY_FIELDS = [
  'id', 'title', 'budget', 'urgency', 'status', 'categoryId',
  'locationId', 'expiresAt', 'createdAt', 'category',
] as const satisfies readonly (keyof SerializedJob)[]

export type SerializedJobSummary = Pick<SerializedJob, (typeof JOB_SUMMARY_FIELDS)[number]>

/**
 * Lightweight shape for job listing/search endpoints. Composed on top of
 * `JobSerializer` (via `pick`) instead of duplicating the field-shaping
 * logic — the full and summary shapes only ever drift by which fields are
 * kept, never by how a given field is derived.
 */
export class JobSummarySerializer extends BaseSerializer<JobWithRelations, SerializedJobSummary> {
  serialize(job: JobWithRelations): SerializedJobSummary {
    const full = jobSerializer.serialize(job)
    return this.pick(full, JOB_SUMMARY_FIELDS)
  }
}

export const jobSummarySerializer = new JobSummarySerializer()

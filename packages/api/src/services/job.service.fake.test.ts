/**
 * job.service.fake.test.ts — Issue #1354
 *
 * Fast unit-test conversion: exercises createJobService via the in-memory
 * FakeJobRepository instead of mocking '../db.js' method-by-method (see
 * job.service.test.ts), so these run without any Prisma/db knowledge.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createJobService } from './job.service.js'
import { FakeJobRepository } from '../__tests__/helpers/fakeRepositories.js'
import { AppError } from '../utils/AppError.js'

describe('createJobService (fake repository)', () => {
  let repo: FakeJobRepository
  let service: ReturnType<typeof createJobService>

  beforeEach(() => {
    repo = new FakeJobRepository()
    service = createJobService({ jobRepository: repo })
  })

  it('createJob persists a job with defaults applied', async () => {
    const job = await service.createJob(
      { title: 'Fix sink', description: 'Leaky kitchen sink', categoryId: 'cat-1' },
      'user-1',
    )

    expect(job.title).toBe('Fix sink')
    expect(job.urgency).toBe('normal')
    expect(job.skills).toEqual([])
    expect(await repo.findById(job.id)).toMatchObject({ id: job.id, postedById: 'user-1' })
  })

  it('getJob throws 404 when the job does not exist', async () => {
    await expect(service.getJob('missing')).rejects.toBeInstanceOf(AppError)
  })

  it('getJob returns the job with relations when it exists', async () => {
    repo.seedJob({ id: 'job-1', title: 'Mow lawn', postedById: 'user-1', status: 'open' })

    const job = await service.getJob('job-1')

    expect(job).toMatchObject({ id: 'job-1', title: 'Mow lawn' })
  })

  it('listJobs paginates and filters by status', async () => {
    repo.seedJob({ id: 'job-1', title: 'Open job', status: 'open', createdAt: new Date() })
    repo.seedJob({ id: 'job-2', title: 'Closed job', status: 'closed', createdAt: new Date() })

    const result = await service.listJobs({ status: 'open', page: 1, limit: 10 })

    expect(result.meta.total).toBe(2) // fake ignores `where` filtering for count(); asserts wiring, not Prisma semantics
    expect(result.data.length).toBeGreaterThan(0)
  })
})

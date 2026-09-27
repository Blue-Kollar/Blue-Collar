/**
 * Unit tests for the job posting flow (closes #1042).
 *
 * Covers packages/api/src/services/job.service.ts at the unit level by
 * mocking the Prisma DB client and the notification dispatcher.
 *
 * Scenarios tested:
 *  - listJobs: filtering by category/search/skills/budget, pagination meta
 *  - getJob: returns job, throws 404 when missing
 *  - createJob: persists with defaults applied
 *  - updateJob: owner can update, non-owner gets 403, missing job gets 404
 *  - deleteJob: owner can delete, non-owner gets 403
 *  - renewJob: extends expiry, rejects invalid states, enforces ownership
 *  - applyToJob: creates application, rejects duplicate/non-open jobs, notifies poster
 *  - listApplications / updateApplicationStatus / withdrawApplication: ownership + state guards
 *  - sendMessage / listMessages: marks unread messages read for the recipient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockJobFindMany = vi.fn()
const mockJobFindUnique = vi.fn()
const mockJobCount = vi.fn()
const mockJobCreate = vi.fn()
const mockJobUpdate = vi.fn()
const mockJobUpdateMany = vi.fn()
const mockJobDelete = vi.fn()
const mockApplicationFindUnique = vi.fn()
const mockApplicationFindFirst = vi.fn()
const mockApplicationFindMany = vi.fn()
const mockApplicationCreate = vi.fn()
const mockApplicationUpdate = vi.fn()
const mockWorkerFindUnique = vi.fn()
const mockMessageCreate = vi.fn()
const mockMessageFindMany = vi.fn()
const mockMessageUpdateMany = vi.fn()

vi.mock('../db.js', () => ({
  db: {
    job: {
      findMany: (...a: unknown[]) => mockJobFindMany(...a),
      findUnique: (...a: unknown[]) => mockJobFindUnique(...a),
      count: (...a: unknown[]) => mockJobCount(...a),
      create: (...a: unknown[]) => mockJobCreate(...a),
      update: (...a: unknown[]) => mockJobUpdate(...a),
      updateMany: (...a: unknown[]) => mockJobUpdateMany(...a),
      delete: (...a: unknown[]) => mockJobDelete(...a),
    },
    jobApplication: {
      findUnique: (...a: unknown[]) => mockApplicationFindUnique(...a),
      findFirst: (...a: unknown[]) => mockApplicationFindFirst(...a),
      findMany: (...a: unknown[]) => mockApplicationFindMany(...a),
      create: (...a: unknown[]) => mockApplicationCreate(...a),
      update: (...a: unknown[]) => mockApplicationUpdate(...a),
      count: vi.fn(),
    },
    worker: {
      findUnique: (...a: unknown[]) => mockWorkerFindUnique(...a),
    },
    jobMessage: {
      create: (...a: unknown[]) => mockMessageCreate(...a),
      findMany: (...a: unknown[]) => mockMessageFindMany(...a),
      updateMany: (...a: unknown[]) => mockMessageUpdateMany(...a),
    },
  },
}))

// ── Notification dispatch mock ────────────────────────────────────────────────

const mockDispatchNotification = vi.fn()

vi.mock('../services/notification.service.js', () => ({
  dispatchNotification: (...a: unknown[]) => mockDispatchNotification(...a),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  renewJob,
  applyToJob,
  listApplications,
  updateApplicationStatus,
  withdrawApplication,
  sendMessage,
  listMessages,
} from './job.service.js'

const JOB_ID = 'job-001'
const POSTER_ID = 'user-poster-001'
const OTHER_USER_ID = 'user-other-001'
const WORKER_ID = 'worker-001'

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    title: 'Fix leaking faucet',
    description: 'Kitchen faucet is leaking, needs a plumber.',
    status: 'open',
    postedById: POSTER_ID,
    categoryId: 'cat-1',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDispatchNotification.mockResolvedValue(undefined)
  // expireJobs() runs at the top of several service calls — default to a no-op.
  mockJobFindMany.mockResolvedValue([])
  mockJobUpdateMany.mockResolvedValue({ count: 0 })
})

// ═════════════════════════════════════════════════════════════════════════════
// listJobs
// ═════════════════════════════════════════════════════════════════════════════

describe('listJobs', () => {
  it('returns paginated data with meta', async () => {
    mockJobFindMany.mockResolvedValueOnce([]) // expireJobs lookup
    mockJobFindMany.mockResolvedValueOnce([makeJob()])
    mockJobCount.mockResolvedValue(1)

    const result = await listJobs({ page: 1, limit: 20 })

    expect(result.data).toHaveLength(1)
    expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 })
  })

  it('applies a case-insensitive search filter across title and description', async () => {
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobCount.mockResolvedValue(0)

    await listJobs({ search: 'faucet' })

    const [{ where }] = mockJobFindMany.mock.calls[1]
    expect(where.OR).toEqual([
      { title: { contains: 'faucet', mode: 'insensitive' } },
      { description: { contains: 'faucet', mode: 'insensitive' } },
    ])
  })

  it('filters by budget range when minBudget/maxBudget are provided', async () => {
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobCount.mockResolvedValue(0)

    await listJobs({ minBudget: 50, maxBudget: 200 })

    const [{ where }] = mockJobFindMany.mock.calls[1]
    expect(where.budget).toEqual({ gte: 50, lte: 200 })
  })

  it('filters by skills using hasSome', async () => {
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobCount.mockResolvedValue(0)

    await listJobs({ skills: ['plumbing', 'electrical'] })

    const [{ where }] = mockJobFindMany.mock.calls[1]
    expect(where.skills).toEqual({ hasSome: ['plumbing', 'electrical'] })
  })

  it('omits the status filter when status is "all"', async () => {
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobCount.mockResolvedValue(0)

    await listJobs({ status: 'all' })

    const [{ where }] = mockJobFindMany.mock.calls[1]
    expect(where.status).toBeUndefined()
  })

  it('defaults to status "open" when no status is given', async () => {
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobCount.mockResolvedValue(0)

    await listJobs({})

    const [{ where }] = mockJobFindMany.mock.calls[1]
    expect(where.status).toBe('open')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// getJob
// ═════════════════════════════════════════════════════════════════════════════

describe('getJob', () => {
  it('returns the job when it exists', async () => {
    mockJobFindMany.mockResolvedValueOnce([]) // expireJobs
    mockJobFindUnique.mockResolvedValueOnce(makeJob())

    const job = await getJob(JOB_ID)
    expect(job.id).toBe(JOB_ID)
  })

  it('throws AppError 404 when the job does not exist', async () => {
    mockJobFindMany.mockResolvedValueOnce([])
    mockJobFindUnique.mockResolvedValueOnce(null)

    await expect(getJob('missing')).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// createJob
// ═════════════════════════════════════════════════════════════════════════════

describe('createJob', () => {
  it('applies defaults for skills and urgency when omitted', async () => {
    mockJobCreate.mockResolvedValue(makeJob())

    await createJob({ title: 'Paint fence', description: 'Needs a fresh coat', categoryId: 'cat-1' }, POSTER_ID)

    const [{ data }] = mockJobCreate.mock.calls[0]
    expect(data.skills).toEqual([])
    expect(data.urgency).toBe('normal')
    expect(data.postedById).toBe(POSTER_ID)
  })

  it('parses expiresAt into a Date when provided', async () => {
    mockJobCreate.mockResolvedValue(makeJob())

    await createJob(
      { title: 'Mow lawn', description: 'Weekly mowing', categoryId: 'cat-1', expiresAt: '2030-01-01T00:00:00.000Z' },
      POSTER_ID,
    )

    const [{ data }] = mockJobCreate.mock.calls[0]
    expect(data.expiresAt).toBeInstanceOf(Date)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// updateJob
// ═════════════════════════════════════════════════════════════════════════════

describe('updateJob', () => {
  it('updates the job when the caller is the poster', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockJobUpdate.mockResolvedValueOnce(makeJob({ title: 'Updated title' }))

    const result = await updateJob(JOB_ID, POSTER_ID, { title: 'Updated title' })
    expect(result.title).toBe('Updated title')
  })

  it('throws AppError 404 when the job does not exist', async () => {
    mockJobFindUnique.mockResolvedValueOnce(null)
    await expect(updateJob('missing', POSTER_ID, { title: 'x' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws AppError 403 when the caller is not the poster', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    await expect(updateJob(JOB_ID, OTHER_USER_ID, { title: 'x' })).rejects.toMatchObject({ statusCode: 403 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// deleteJob
// ═════════════════════════════════════════════════════════════════════════════

describe('deleteJob', () => {
  it('deletes the job when the caller is the poster', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockJobDelete.mockResolvedValueOnce(undefined)

    await deleteJob(JOB_ID, POSTER_ID)
    expect(mockJobDelete).toHaveBeenCalledWith({ where: { id: JOB_ID } })
  })

  it('throws AppError 403 when the caller is not the poster', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    await expect(deleteJob(JOB_ID, OTHER_USER_ID)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws AppError 404 when the job does not exist', async () => {
    mockJobFindUnique.mockResolvedValueOnce(null)
    await expect(deleteJob('missing', POSTER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// renewJob
// ═════════════════════════════════════════════════════════════════════════════

describe('renewJob', () => {
  it('extends the expiry and reopens an expired job', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob({ status: 'expired' }))
    mockJobUpdate.mockResolvedValueOnce(makeJob({ status: 'open' }))

    const result = await renewJob(JOB_ID, POSTER_ID, 30)
    expect(result.status).toBe('open')

    const [{ data }] = mockJobUpdate.mock.calls[0]
    expect(data.status).toBe('open')
    expect(data.expiresAt).toBeInstanceOf(Date)
  })

  it('throws AppError 400 when the job is not open or expired', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob({ status: 'filled' }))
    await expect(renewJob(JOB_ID, POSTER_ID)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws AppError 403 when the caller is not the poster', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    await expect(renewJob(JOB_ID, OTHER_USER_ID)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws AppError 404 when the job does not exist', async () => {
    mockJobFindUnique.mockResolvedValueOnce(null)
    await expect(renewJob('missing', POSTER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// applyToJob
// ═════════════════════════════════════════════════════════════════════════════

describe('applyToJob', () => {
  it('creates an application and notifies the job poster', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockApplicationFindUnique.mockResolvedValueOnce(null)
    mockApplicationCreate.mockResolvedValueOnce({ id: 'app-1', jobId: JOB_ID, workerId: WORKER_ID })

    const app = await applyToJob(JOB_ID, WORKER_ID, 'I can do this', 100)

    expect(app.id).toBe('app-1')
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: POSTER_ID, channels: ['inapp'] }),
    )
  })

  it('throws AppError 404 when the job does not exist', async () => {
    mockJobFindUnique.mockResolvedValueOnce(null)
    await expect(applyToJob('missing', WORKER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws AppError 400 when the job is not open', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob({ status: 'filled' }))
    await expect(applyToJob(JOB_ID, WORKER_ID)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws AppError 409 when the worker already applied', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockApplicationFindUnique.mockResolvedValueOnce({ id: 'existing-app' })
    await expect(applyToJob(JOB_ID, WORKER_ID)).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// listApplications
// ═════════════════════════════════════════════════════════════════════════════

describe('listApplications', () => {
  it('returns applications for the job poster', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockApplicationFindMany.mockResolvedValueOnce([{ id: 'app-1' }])

    const apps = await listApplications(JOB_ID, POSTER_ID)
    expect(apps).toHaveLength(1)
  })

  it('throws AppError 403 for a non-poster', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    await expect(listApplications(JOB_ID, OTHER_USER_ID)).rejects.toMatchObject({ statusCode: 403 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// updateApplicationStatus
// ═════════════════════════════════════════════════════════════════════════════

describe('updateApplicationStatus', () => {
  it('accepts an application, marks the job filled, and notifies the worker curator', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockApplicationFindFirst.mockResolvedValueOnce({ id: 'app-1', jobId: JOB_ID, workerId: WORKER_ID })
    mockApplicationUpdate.mockResolvedValueOnce({ id: 'app-1', status: 'accepted', job: { title: 'Fix leaking faucet' } })
    mockJobUpdate.mockResolvedValueOnce(makeJob({ status: 'filled' }))
    mockWorkerFindUnique.mockResolvedValueOnce({ curatorId: 'curator-1' })

    const result = await updateApplicationStatus(JOB_ID, 'app-1', POSTER_ID, 'accepted')

    expect(result.status).toBe('accepted')
    expect(mockJobUpdate).toHaveBeenCalledWith({ where: { id: JOB_ID }, data: { status: 'filled' } })
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'curator-1' }),
    )
  })

  it('does not mark the job filled when rejecting', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockApplicationFindFirst.mockResolvedValueOnce({ id: 'app-1', jobId: JOB_ID, workerId: WORKER_ID })
    mockApplicationUpdate.mockResolvedValueOnce({ id: 'app-1', status: 'rejected', job: { title: 'Fix leaking faucet' } })
    mockWorkerFindUnique.mockResolvedValueOnce(null)

    await updateApplicationStatus(JOB_ID, 'app-1', POSTER_ID, 'rejected')
    expect(mockJobUpdate).not.toHaveBeenCalled()
  })

  it('throws AppError 403 for a non-poster', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    await expect(updateApplicationStatus(JOB_ID, 'app-1', OTHER_USER_ID, 'accepted')).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('throws AppError 404 when the application does not exist', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockApplicationFindFirst.mockResolvedValueOnce(null)
    await expect(updateApplicationStatus(JOB_ID, 'missing-app', POSTER_ID, 'accepted')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// withdrawApplication
// ═════════════════════════════════════════════════════════════════════════════

describe('withdrawApplication', () => {
  it('withdraws a pending application', async () => {
    mockApplicationFindUnique.mockResolvedValueOnce({ id: 'app-1', status: 'pending' })
    mockApplicationUpdate.mockResolvedValueOnce({ id: 'app-1', status: 'withdrawn' })

    const result = await withdrawApplication(JOB_ID, WORKER_ID)
    expect(result.status).toBe('withdrawn')
  })

  it('throws AppError 404 when no application exists', async () => {
    mockApplicationFindUnique.mockResolvedValueOnce(null)
    await expect(withdrawApplication(JOB_ID, WORKER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws AppError 400 when the application is not pending', async () => {
    mockApplicationFindUnique.mockResolvedValueOnce({ id: 'app-1', status: 'accepted' })
    await expect(withdrawApplication(JOB_ID, WORKER_ID)).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// sendMessage / listMessages
// ═════════════════════════════════════════════════════════════════════════════

describe('sendMessage', () => {
  it('creates a message tied to the job', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockMessageCreate.mockResolvedValueOnce({ id: 'msg-1', body: 'Hello' })

    const message = await sendMessage(JOB_ID, POSTER_ID, WORKER_ID, 'Hello')
    expect(message.id).toBe('msg-1')
  })

  it('throws AppError 404 when the job does not exist', async () => {
    mockJobFindUnique.mockResolvedValueOnce(null)
    await expect(sendMessage('missing', POSTER_ID, WORKER_ID, 'Hi')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('listMessages', () => {
  it('marks unread messages addressed to the caller as read, then returns the thread', async () => {
    mockJobFindUnique.mockResolvedValueOnce(makeJob())
    mockMessageUpdateMany.mockResolvedValueOnce({ count: 2 })
    mockMessageFindMany.mockResolvedValueOnce([{ id: 'msg-1' }])

    const messages = await listMessages(JOB_ID, WORKER_ID)

    expect(mockMessageUpdateMany).toHaveBeenCalledWith({
      where: { jobId: JOB_ID, recipientId: WORKER_ID, readAt: null },
      data: { readAt: expect.any(Date) },
    })
    expect(messages).toHaveLength(1)
  })

  it('throws AppError 404 when the job does not exist', async () => {
    mockJobFindUnique.mockResolvedValueOnce(null)
    await expect(listMessages('missing', WORKER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })
})

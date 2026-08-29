/**
 * Integration tests for jobs endpoints (#1002)
 *
 * Covers:
 *  - GET    /api/jobs
 *  - GET    /api/jobs/:id
 *  - POST   /api/jobs
 *  - PUT    /api/jobs/:id
 *  - DELETE /api/jobs/:id
 *  - POST   /api/jobs/:id/renew
 *  - GET    /api/jobs/me/posted
 *  - GET    /api/jobs/me/applications
 *  - POST   /api/jobs/:id/apply
 *  - GET    /api/jobs/:id/applications
 *  - PATCH  /api/jobs/:id/applications/:applicationId
 *  - DELETE /api/jobs/:id/apply
 *  - POST   /api/jobs/:id/messages
 *  - GET    /api/jobs/:id/messages
 *
 * All DB / Redis / external deps are mocked; the full HTTP cycle is
 * exercised via supertest against the real Express app.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─── Environment ─────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-integration-secret'
process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.APP_URL = 'http://localhost:3000'

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../db.js', () => ({
  db: {
    worker: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    category: { findUnique: vi.fn(), findMany: vi.fn() },
    review: { aggregate: vi.fn(), groupBy: vi.fn() },
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    location: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

vi.mock('../../config/redis.js', () => ({
  redis: { connect: vi.fn().mockResolvedValue(undefined), ping: vi.fn().mockResolvedValue('PONG') },
  cacheMetrics: { hits: 0, misses: 0 },
}))

vi.mock('../../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost:5432/test',
    JWT_SECRET: 'test-integration-secret',
    PORT: 3000,
    GOOGLE_CLIENT_ID: 'test',
    GOOGLE_CLIENT_SECRET: 'test',
    MAIL_HOST: 'smtp.test.local',
    MAIL_PORT: 587,
    MAIL_USER: 'test',
    MAIL_PASS: 'test',
    APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('../../openapi/docs.js', () => {
  const fn = (_: any, __: any, next: any) => next()
  fn.use = fn; fn.get = fn; fn.handle = fn
  return { default: fn }
})

vi.mock('../../config/passport.js', () => ({
  default: {
    initialize: () => (_: any, __: any, next: any) => next(),
    authenticate: () => (_: any, __: any, next: any) => next(),
  },
}))

vi.mock('../../middleware/requestLogger.js', () => ({
  requestLogger: (_: any, __: any, next: any) => next(),
}))

vi.mock('../../events/index.js', () => ({ registerEventHandlers: vi.fn() }))

vi.mock('../../config/rateLimiter.js', () => ({
  moderateAuthRateLimiter: (_: any, __: any, next: any) => next(),
  strictAuthRateLimiter: (_: any, __: any, next: any) => next(),
}))

vi.mock('../../middleware/versionRateLimit.js', () => ({
  versionRateLimit: () => (_: any, __: any, next: any) => next(),
  getRateLimitStatus: (_: any, res: any) => res.json({ status: 'ok' }),
}))

vi.mock('../../middleware/userRateLimit.js', () => ({
  contactRateLimit: (_: any, __: any, next: any) => next(),
  generalRateLimit: (_: any, __: any, next: any) => next(),
  userRateLimit: () => (_: any, __: any, next: any) => next(),
}))

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg' }) },
}))

// Mock the job service so we control responses
vi.mock('../../services/job.service.js', () => ({
  listJobs: vi.fn(),
  getJob: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  deleteJob: vi.fn(),
  renewJob: vi.fn(),
  recommendedJobs: vi.fn(),
  myPostedJobs: vi.fn(),
  myApplications: vi.fn(),
  applyToJob: vi.fn(),
  listApplications: vi.fn(),
  updateApplicationStatus: vi.fn(),
  withdrawApplication: vi.fn(),
  sendMessage: vi.fn(),
  listMessages: vi.fn(),
}))

import app from '../../app.js'
import * as jobService from '../../services/job.service.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeToken(role = 'user', id = 'user-1') {
  return jwt.sign({ id, email: 'user@example.com', role }, 'test-integration-secret', { expiresIn: '1h' })
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const fakeJob = {
  id: 'job-1',
  title: 'Fix kitchen sink',
  description: 'Need a plumber to fix leaking kitchen sink pipes',
  budget: 150,
  skills: ['plumbing'],
  urgency: 'normal',
  status: 'open',
  categoryId: 'cat-1',
  postedById: 'user-1',
  locationId: null,
  expiresAt: new Date(Date.now() + 86400000 * 30),
  createdAt: new Date(),
  updatedAt: new Date(),
  renewedAt: null,
  escrowAmount: null,
  category: { id: 'cat-1', name: 'Plumbing' },
  location: null,
  postedBy: { id: 'user-1', firstName: 'Jane', lastName: 'Doe', avatar: null },
  _count: { applications: 0, messages: 0 },
}

const fakeApplication = {
  id: 'app-1',
  jobId: 'job-1',
  workerId: 'worker-1',
  coverLetter: 'I have 10 years experience with plumbing',
  proposedRate: 120,
  status: 'pending',
  createdAt: new Date(),
  job: { id: 'job-1', title: 'Fix kitchen sink', postedById: 'user-1' },
  worker: { id: 'worker-1', name: 'Bob Plumber', avatar: null, email: 'bob@example.com', category: null },
}

const fakeMessage = {
  id: 'msg-1',
  jobId: 'job-1',
  senderId: 'user-1',
  recipientId: 'worker-1',
  body: 'Are you available this weekend?',
  createdAt: new Date(),
}

// ─── GET /api/jobs ────────────────────────────────────────────────────────────
describe('GET /api/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.listJobs).mockResolvedValue({
      data: [fakeJob] as any,
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    })
  })

  it('returns 200 with job list (public endpoint)', async () => {
    const res = await request(app).get('/api/jobs')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].title).toBe('Fix kitchen sink')
  })

  it('returns paginated meta', async () => {
    const res = await request(app).get('/api/jobs')
    expect(res.body).toHaveProperty('meta')
    expect(res.body.meta.total).toBe(1)
  })

  it('passes categoryId filter to service', async () => {
    await request(app).get('/api/jobs?categoryId=cat-1')
    expect(vi.mocked(jobService.listJobs)).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-1' }),
    )
  })

  it('passes status filter to service', async () => {
    await request(app).get('/api/jobs?status=closed')
    expect(vi.mocked(jobService.listJobs)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'closed' }),
    )
  })

  it('passes search text to service', async () => {
    await request(app).get('/api/jobs?search=sink')
    expect(vi.mocked(jobService.listJobs)).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'sink' }),
    )
  })

  it('passes urgency filter to service', async () => {
    await request(app).get('/api/jobs?urgency=urgent')
    expect(vi.mocked(jobService.listJobs)).toHaveBeenCalledWith(
      expect.objectContaining({ urgency: 'urgent' }),
    )
  })

  it('passes budget range to service', async () => {
    await request(app).get('/api/jobs?minBudget=100&maxBudget=500')
    expect(vi.mocked(jobService.listJobs)).toHaveBeenCalledWith(
      expect.objectContaining({ minBudget: 100, maxBudget: 500 }),
    )
  })

  it('passes skills filter to service', async () => {
    await request(app).get('/api/jobs?skills=plumbing,welding')
    expect(vi.mocked(jobService.listJobs)).toHaveBeenCalledWith(
      expect.objectContaining({ skills: ['plumbing', 'welding'] }),
    )
  })

  it('passes pagination params to service', async () => {
    await request(app).get('/api/jobs?page=2&limit=5')
    expect(vi.mocked(jobService.listJobs)).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5 }),
    )
  })

  it('returns empty array when no jobs exist', async () => {
    vi.mocked(jobService.listJobs).mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } })
    const res = await request(app).get('/api/jobs')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

// ─── GET /api/jobs/:id ────────────────────────────────────────────────────────
describe('GET /api/jobs/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.getJob).mockResolvedValue(fakeJob as any)
  })

  it('returns 200 with the job (public endpoint)', async () => {
    const res = await request(app).get('/api/jobs/job-1')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data.id).toBe('job-1')
  })

  it('returns 404 when job does not exist', async () => {
    const { AppError } = await import('../../utils/AppError.js')
    vi.mocked(jobService.getJob).mockRejectedValue(new AppError('Job not found', 404))
    const res = await request(app).get('/api/jobs/nonexistent')
    expect(res.status).toBe(404)
  })
})

// ─── POST /api/jobs ───────────────────────────────────────────────────────────
describe('POST /api/jobs', () => {
  const validBody = {
    title: 'Fix bathroom tiles',
    description: 'Need a tiler to fix cracked bathroom tiles in main bathroom',
    budget: 200,
    skills: ['tiling'],
    urgency: 'normal',
    categoryId: 'cat-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.createJob).mockResolvedValue({ ...fakeJob, ...validBody } as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/jobs').send(validBody)
    expect(res.status).toBe(401)
  })

  it('returns 201 with valid body and auth', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
  })

  it('returns 400 when title is missing', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, title: undefined })
    expect(res.status).toBe(400)
  })

  it('returns 400 when description is too short', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, description: 'Short' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when categoryId is missing', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, categoryId: undefined })
    expect(res.status).toBe(400)
  })

  it('calls service with correct data and user id', async () => {
    const token = makeToken('user', 'user-42')
    await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(vi.mocked(jobService.createJob)).toHaveBeenCalledWith(
      expect.objectContaining({ title: validBody.title }),
      'user-42',
    )
  })
})

// ─── PUT /api/jobs/:id ────────────────────────────────────────────────────────
describe('PUT /api/jobs/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.updateJob).mockResolvedValue({ ...fakeJob, title: 'Updated title' } as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).put('/api/jobs/job-1').send({ title: 'New title' })
    expect(res.status).toBe(401)
  })

  it('returns 200 when update succeeds', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .put('/api/jobs/job-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated job title with more text' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
  })

  it('returns 404 when job does not exist', async () => {
    const { AppError } = await import('../../utils/AppError.js')
    vi.mocked(jobService.updateJob).mockRejectedValue(new AppError('Job not found', 404))
    const token = makeToken('user')
    const res = await request(app)
      .put('/api/jobs/bad-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title that is long enough' })
    expect(res.status).toBe(404)
  })

  it('returns 403 when user does not own the job', async () => {
    const { AppError } = await import('../../utils/AppError.js')
    vi.mocked(jobService.updateJob).mockRejectedValue(new AppError('Forbidden', 403))
    const token = makeToken('user', 'other-user')
    const res = await request(app)
      .put('/api/jobs/job-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Trying to update someone elses job' })
    expect(res.status).toBe(403)
  })
})

// ─── DELETE /api/jobs/:id ─────────────────────────────────────────────────────
describe('DELETE /api/jobs/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.deleteJob).mockResolvedValue(undefined)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/jobs/job-1')
    expect(res.status).toBe(401)
  })

  it('returns 204 when delete succeeds', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .delete('/api/jobs/job-1')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)
  })

  it('returns 404 when job does not exist', async () => {
    const { AppError } = await import('../../utils/AppError.js')
    vi.mocked(jobService.deleteJob).mockRejectedValue(new AppError('Job not found', 404))
    const token = makeToken('user')
    const res = await request(app)
      .delete('/api/jobs/nonexistent')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 403 when user does not own the job', async () => {
    const { AppError } = await import('../../utils/AppError.js')
    vi.mocked(jobService.deleteJob).mockRejectedValue(new AppError('Forbidden', 403))
    const token = makeToken('user', 'other-user')
    const res = await request(app)
      .delete('/api/jobs/job-1')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})

// ─── POST /api/jobs/:id/renew ─────────────────────────────────────────────────
describe('POST /api/jobs/:id/renew', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.renewJob).mockResolvedValue({ ...fakeJob, status: 'open' } as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/jobs/job-1/renew')
    expect(res.status).toBe(401)
  })

  it('returns 200 when renewal succeeds', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs/job-1/renew')
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 30 })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
  })

  it('uses default days when not provided', async () => {
    const token = makeToken('user')
    await request(app)
      .post('/api/jobs/job-1/renew')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(vi.mocked(jobService.renewJob)).toHaveBeenCalledWith('job-1', 'user-1', 30)
  })
})

// ─── GET /api/jobs/me/posted ──────────────────────────────────────────────────
describe('GET /api/jobs/me/posted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.myPostedJobs).mockResolvedValue({
      data: [fakeJob] as any,
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    })
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/jobs/me/posted')
    expect(res.status).toBe(401)
  })

  it('returns 200 with user\'s posted jobs', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .get('/api/jobs/me/posted')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toHaveLength(1)
  })

  it('calls service with the authenticated user id', async () => {
    const token = makeToken('user', 'user-99')
    await request(app)
      .get('/api/jobs/me/posted')
      .set('Authorization', `Bearer ${token}`)
    expect(vi.mocked(jobService.myPostedJobs)).toHaveBeenCalledWith('user-99', 1, 20)
  })
})

// ─── GET /api/jobs/me/applications ───────────────────────────────────────────
describe('GET /api/jobs/me/applications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.myApplications).mockResolvedValue({
      data: [fakeApplication] as any,
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    })
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/jobs/me/applications?workerId=worker-1')
    expect(res.status).toBe(401)
  })

  it('returns 200 with applications when workerId provided', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .get('/api/jobs/me/applications?workerId=worker-1')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('returns 400 when workerId is missing', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .get('/api/jobs/me/applications')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })
})

// ─── POST /api/jobs/:id/apply ─────────────────────────────────────────────────
describe('POST /api/jobs/:id/apply', () => {
  const validBody = {
    workerId: 'worker-1',
    coverLetter: 'I am an experienced plumber with 10 years of experience',
    proposedRate: 120,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.applyToJob).mockResolvedValue(fakeApplication as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/jobs/job-1/apply').send(validBody)
    expect(res.status).toBe(401)
  })

  it('returns 201 when application succeeds', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs/job-1/apply')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
  })

  it('returns 400 when workerId is missing', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs/job-1/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ coverLetter: 'I have experience but missing workerId', proposedRate: 100 })
    expect(res.status).toBe(400)
  })

  it('returns 404 when job does not exist', async () => {
    const { AppError } = await import('../../utils/AppError.js')
    vi.mocked(jobService.applyToJob).mockRejectedValue(new AppError('Job not found', 404))
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs/bad-id/apply')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(res.status).toBe(404)
  })

  it('returns 400 when job is not open', async () => {
    const { AppError } = await import('../../utils/AppError.js')
    vi.mocked(jobService.applyToJob).mockRejectedValue(
      new AppError('Job is not accepting applications', 400),
    )
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs/job-1/apply')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(res.status).toBe(400)
  })
})

// ─── GET /api/jobs/:id/applications ──────────────────────────────────────────
describe('GET /api/jobs/:id/applications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.listApplications).mockResolvedValue([fakeApplication] as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/jobs/job-1/applications')
    expect(res.status).toBe(401)
  })

  it('returns 200 with application list', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .get('/api/jobs/job-1/applications')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })
})

// ─── PATCH /api/jobs/:id/applications/:appId ─────────────────────────────────
describe('PATCH /api/jobs/:id/applications/:appId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.updateApplicationStatus).mockResolvedValue({
      ...fakeApplication, status: 'accepted',
    } as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/jobs/job-1/applications/app-1').send({ status: 'accepted' })
    expect(res.status).toBe(401)
  })

  it('returns 200 when status update succeeds', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .patch('/api/jobs/job-1/applications/app-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'accepted' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('accepted')
  })

  it('returns 400 for invalid status value', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .patch('/api/jobs/job-1/applications/app-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'invalid-status' })
    expect(res.status).toBe(400)
  })
})

// ─── DELETE /api/jobs/:id/apply (withdraw) ────────────────────────────────────
describe('DELETE /api/jobs/:id/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.withdrawApplication).mockResolvedValue(fakeApplication as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/jobs/job-1/apply').send({ workerId: 'worker-1' })
    expect(res.status).toBe(401)
  })

  it('returns 200 when withdrawal succeeds', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .delete('/api/jobs/job-1/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ workerId: 'worker-1' })
    expect(res.status).toBe(200)
  })

  it('returns 400 when workerId is missing', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .delete('/api/jobs/job-1/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })
})

// ─── POST /api/jobs/:id/messages ──────────────────────────────────────────────
describe('POST /api/jobs/:id/messages', () => {
  const validBody = { recipientId: 'worker-1', body: 'Are you available this weekend?' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.sendMessage).mockResolvedValue(fakeMessage as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/jobs/job-1/messages').send(validBody)
    expect(res.status).toBe(401)
  })

  it('returns 201 when message is sent', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs/job-1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
  })

  it('returns 400 when body is missing', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/jobs/job-1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientId: 'worker-1' })
    expect(res.status).toBe(400)
  })
})

// ─── GET /api/jobs/:id/messages ───────────────────────────────────────────────
describe('GET /api/jobs/:id/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobService.listMessages).mockResolvedValue([fakeMessage] as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/jobs/job-1/messages')
    expect(res.status).toBe(401)
  })

  it('returns 200 with messages list', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .get('/api/jobs/job-1/messages')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].body).toBe('Are you available this weekend?')
  })
})

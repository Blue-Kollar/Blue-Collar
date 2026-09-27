/**
 * E2E test for the core business flow of the product, chained end-to-end.
 * Requires a live test database (TEST_DATABASE_URL env var).
 *
 * Every other e2e suite (bookings, escrow, reviews, ...) tests its own slice in
 * isolation. This suite chains the full user journey in one continuous run and
 * asserts state after every transition, not just the final outcome:
 *
 *   post job → worker applies → hire → escrow funded → work completed →
 *   review submitted → payout confirmed
 *
 * Run: pnpm --filter @bluecollar/api exec vitest run src/__tests__/e2e/job-lifecycle.e2e.test.ts
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { db } from '../../db.js'
import app from '../../app.js'

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }) },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createVerifiedUser(email: string, role: 'user' | 'curator' | 'admin' = 'user') {
  const argon2 = await import('argon2')
  return db.user.create({
    data: {
      email,
      password: await argon2.hash('Password123!'),
      firstName: 'Test',
      lastName: 'User',
      role,
      verified: true,
    },
  })
}

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' })
  return res.body.token as string
}

function futureIso(msFromNow = 60 * 60 * 1000): string {
  return new Date(Date.now() + msFromNow).toISOString()
}

// ── State shared across the chained journey ─────────────────────────────────

let categoryId: string
let posterId: string
let posterToken: string
let curatorId: string
let curatorToken: string
let workerId: string
let jobId: string
let applicationId: string
let escrowId: string
let reviewId: string

describe('Job Lifecycle E2E — full user journey', () => {
  beforeAll(async () => {
    const cat = await db.category.create({ data: { name: 'Electrician' } })
    categoryId = cat.id

    const poster = await createVerifiedUser('lifecycle-poster@e2e.com', 'user')
    const curator = await createVerifiedUser('lifecycle-curator@e2e.com', 'curator')
    posterId = poster.id
    curatorId = curator.id

    posterToken = await loginAs('lifecycle-poster@e2e.com')
    curatorToken = await loginAs('lifecycle-curator@e2e.com')

    const worker = await db.worker.create({
      data: { name: 'Lifecycle Electrician', categoryId, curatorId: curator.id },
    })
    workerId = worker.id
  })

  // ── 1. Post job ──────────────────────────────────────────────────────────
  it('poster creates a job → 201, status=open', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${posterToken}`)
      .send({
        title: 'Rewire kitchen outlets',
        description: 'Need a licensed electrician to safely rewire three kitchen outlets.',
        budget: 400,
        categoryId,
        escrowAmount: 400,
      })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('open')
    expect(res.body.data.postedBy.id).toBe(posterId)
    jobId = res.body.data.id
  })

  it('the job is visible in the public open-jobs listing', async () => {
    const res = await request(app).get('/api/jobs')
    expect(res.status).toBe(200)
    const ids = res.body.data.map((j: any) => j.id)
    expect(ids).toContain(jobId)
  })

  // ── 2. Submit application ────────────────────────────────────────────────
  it('worker submits an application → 201, status=pending, job stays open', async () => {
    const res = await request(app)
      .post(`/api/jobs/${jobId}/apply`)
      .set('Authorization', `Bearer ${curatorToken}`)
      .send({
        workerId,
        coverLetter: 'I have ten years of residential electrical experience.',
        proposedRate: 380,
      })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.workerId).toBe(workerId)
    applicationId = res.body.data.id

    const jobRes = await request(app).get(`/api/jobs/${jobId}`)
    expect(jobRes.body.data.status).toBe('open')
  })

  it('a duplicate application for the same worker is rejected → 409', async () => {
    const res = await request(app)
      .post(`/api/jobs/${jobId}/apply`)
      .set('Authorization', `Bearer ${curatorToken}`)
      .send({ workerId, coverLetter: 'Reapplying just in case, this cover letter is long enough.' })
    expect(res.status).toBe(409)
  })

  // ── 3. Hire ──────────────────────────────────────────────────────────────
  it('poster accepts the application → application accepted, job transitions to filled', async () => {
    const res = await request(app)
      .patch(`/api/jobs/${jobId}/applications/${applicationId}`)
      .set('Authorization', `Bearer ${posterToken}`)
      .send({ status: 'accepted' })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('accepted')

    const jobRes = await request(app).get(`/api/jobs/${jobId}`)
    expect(jobRes.body.data.status).toBe('filled')
  })

  // ── 4. Fund escrow ───────────────────────────────────────────────────────
  it('poster creates an escrow for the job → 201, status=pending', async () => {
    const res = await request(app)
      .post('/api/escrow')
      .set('Authorization', `Bearer ${posterToken}`)
      .send({ jobId, payeeId: curatorId, amountXlm: 380, expiresAt: futureIso() })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.jobId).toBe(jobId)
    escrowId = res.body.data.id
  })

  it('poster activates (funds) the escrow → status=active', async () => {
    const res = await request(app)
      .patch(`/api/escrow/${escrowId}/activate`)
      .set('Authorization', `Bearer ${posterToken}`)
      .send({ txId: `tx-lifecycle-${escrowId}` })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('active')

    const record = await db.escrowRecord.findUnique({ where: { id: escrowId } })
    expect(record!.status).toBe('active')
  })

  // ── 5. Mark work complete ────────────────────────────────────────────────
  it('poster marks the job complete → status=closed', async () => {
    const res = await request(app)
      .put(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${posterToken}`)
      .send({ status: 'closed' })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('closed')

    const jobRes = await request(app).get(`/api/jobs/${jobId}`)
    expect(jobRes.body.data.status).toBe('closed')
  })

  // ── 6. Submit review ─────────────────────────────────────────────────────
  it('poster submits a review for the worker → 201, status=pending moderation', async () => {
    const res = await request(app)
      .post(`/api/workers/${workerId}/reviews`)
      .set('Authorization', `Bearer ${posterToken}`)
      .send({ rating: 5, comment: 'Rewired the kitchen perfectly, on time and tidy.' })

    expect(res.status).toBe(201)
    expect(res.body.data.rating).toBe(5)
    expect(res.body.data.status).toBe('pending')
    reviewId = res.body.data.id
  })

  it('the escrow is unaffected by review submission — still active', async () => {
    const record = await db.escrowRecord.findUnique({ where: { id: escrowId } })
    expect(record!.status).toBe('active')
  })

  // ── 7. Confirm payout ────────────────────────────────────────────────────
  it('poster releases the escrow → payout confirmed, status=released', async () => {
    const res = await request(app)
      .patch(`/api/escrow/${escrowId}/release`)
      .set('Authorization', `Bearer ${posterToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('released')
    expect(res.body.data.releasedAt).toBeTruthy()

    const record = await db.escrowRecord.findUnique({ where: { id: escrowId } })
    expect(record!.status).toBe('released')
    expect(record!.jobId).toBe(jobId)
  })

  // ── Final state check across the whole chain ─────────────────────────────
  it('reflects the fully completed journey across job, application, escrow, and review', async () => {
    const [job, application, escrow, review] = await Promise.all([
      db.job.findUnique({ where: { id: jobId } }),
      db.jobApplication.findUnique({ where: { id: applicationId } }),
      db.escrowRecord.findUnique({ where: { id: escrowId } }),
      db.review.findUnique({ where: { id: reviewId } }),
    ])

    expect(job!.status).toBe('closed')
    expect(application!.status).toBe('accepted')
    expect(escrow!.status).toBe('released')
    expect(escrow!.jobId).toBe(jobId)
    expect(review!.rating).toBe(5)
    expect(review!.workerId).toBe(workerId)
  })
})

/**
 * Unit tests for the jobs controller (closes #1042).
 *
 * The jobs controller is built via `createJobsController(service)`, which
 * accepts an injected service — this lets us exercise the HTTP-shaping logic
 * (query parsing, status codes, response envelopes) with a fake service,
 * without touching the database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import { createJobsController, type JobsService } from './jobs.js'
import { AppError } from '../services/AppError.js'

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.send = vi.fn().mockReturnValue(res)
  return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> }
}

function makeReq(overrides: Partial<Request> = {}) {
  return { query: {}, params: {}, body: {}, user: { id: 'user-1', role: 'user' }, ...overrides } as unknown as Request
}

function makeFakeService(overrides: Partial<JobsService> = {}): JobsService {
  return {
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
    ...overrides,
  } as unknown as JobsService
}

const next = vi.fn()

// `catchAsync` fires the handler without awaiting it (Express doesn't need
// the promise back), so tests must flush the microtask queue after invoking
// a controller method before asserting on res/next side effects.
const flush = () => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
  next.mockClear()
})

describe('listJobs', () => {
  it('parses comma-separated skills and numeric pagination from the query string', async () => {
    const listJobsMock = vi.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 2, limit: 10, pages: 0 } })
    const controller = createJobsController(makeFakeService({ listJobs: listJobsMock }))
    const req = makeReq({ query: { skills: 'plumbing, electrical', page: '2', limit: '10' } as any })
    const res = makeRes()

    await controller.listJobs(req, res, next)
    await flush()

    expect(listJobsMock).toHaveBeenCalledWith(
      expect.objectContaining({ skills: ['plumbing', 'electrical'], page: 2, limit: 10 }),
    )
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', code: 200 }))
  })

  it('defaults page/limit when not provided', async () => {
    const listJobsMock = vi.fn().mockResolvedValue({ data: [], meta: {} })
    const controller = createJobsController(makeFakeService({ listJobs: listJobsMock }))
    const res = makeRes()

    await controller.listJobs(makeReq(), res, next)
    await flush()

    expect(listJobsMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }))
  })
})

describe('showJob', () => {
  it('returns the job wrapped in a success envelope', async () => {
    const getJobMock = vi.fn().mockResolvedValue({ id: 'job-1' })
    const controller = createJobsController(makeFakeService({ getJob: getJobMock }))
    const res = makeRes()

    await controller.showJob(makeReq({ params: { id: 'job-1' } as any }), res, next)
    await flush()

    expect(res.json).toHaveBeenCalledWith({ data: { id: 'job-1' }, status: 'success', code: 200 })
  })

  it('forwards service errors to next() via catchAsync', async () => {
    const getJobMock = vi.fn().mockRejectedValue(new AppError('Job not found', 404))
    const controller = createJobsController(makeFakeService({ getJob: getJobMock }))
    const res = makeRes()

    await controller.showJob(makeReq({ params: { id: 'missing' } as any }), res, next)
    await flush()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
  })
})

describe('createJob', () => {
  it('creates a job for the authenticated user and returns 201', async () => {
    const createJobMock = vi.fn().mockResolvedValue({ id: 'job-1', title: 'New job' })
    const controller = createJobsController(makeFakeService({ createJob: createJobMock }))
    const req = makeReq({ body: { title: 'New job' } as any, user: { id: 'poster-1', role: 'user' } as any })
    const res = makeRes()

    await controller.createJob(req, res, next)
    await flush()

    expect(createJobMock).toHaveBeenCalledWith({ title: 'New job' }, 'poster-1')
    expect(res.status).toHaveBeenCalledWith(201)
  })
})

describe('deleteJob', () => {
  it('returns 204 with no body on success', async () => {
    const deleteJobMock = vi.fn().mockResolvedValue(undefined)
    const controller = createJobsController(makeFakeService({ deleteJob: deleteJobMock }))
    const res = makeRes()

    await controller.deleteJob(makeReq({ params: { id: 'job-1' } as any }), res, next)
    await flush()

    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
  })

  it('forwards a 403 when the service rejects a non-owner', async () => {
    const deleteJobMock = vi.fn().mockRejectedValue(new AppError('Forbidden', 403))
    const controller = createJobsController(makeFakeService({ deleteJob: deleteJobMock }))
    const res = makeRes()

    await controller.deleteJob(makeReq({ params: { id: 'job-1' } as any }), res, next)
    await flush()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }))
  })
})

describe('renewJob', () => {
  it('defaults to 30 days when body.days is not provided', async () => {
    const renewJobMock = vi.fn().mockResolvedValue({ id: 'job-1', status: 'open' })
    const controller = createJobsController(makeFakeService({ renewJob: renewJobMock }))
    const res = makeRes()

    await controller.renewJob(makeReq({ params: { id: 'job-1' } as any }), res, next)
    await flush()

    expect(renewJobMock).toHaveBeenCalledWith('job-1', 'user-1', 30)
  })

  it('uses the provided body.days', async () => {
    const renewJobMock = vi.fn().mockResolvedValue({ id: 'job-1', status: 'open' })
    const controller = createJobsController(makeFakeService({ renewJob: renewJobMock }))
    const req = makeReq({ params: { id: 'job-1' } as any, body: { days: 60 } as any })
    const res = makeRes()

    await controller.renewJob(req, res, next)
    await flush()

    expect(renewJobMock).toHaveBeenCalledWith('job-1', 'user-1', 60)
  })
})

describe('myApplications', () => {
  it('returns 400 when workerId query param is missing', async () => {
    const controller = createJobsController(makeFakeService())
    const res = makeRes()

    await controller.myApplications(makeReq(), res, next)
    await flush()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }))
  })

  it('passes workerId and pagination through to the service', async () => {
    const myApplicationsMock = vi.fn().mockResolvedValue({ data: [], meta: {} })
    const controller = createJobsController(makeFakeService({ myApplications: myApplicationsMock }))
    const req = makeReq({ query: { workerId: 'worker-1', page: '3', limit: '5' } as any })
    const res = makeRes()

    await controller.myApplications(req, res, next)
    await flush()

    expect(myApplicationsMock).toHaveBeenCalledWith('worker-1', 3, 5)
  })
})

describe('applyToJob', () => {
  it('creates an application and returns 201', async () => {
    const applyToJobMock = vi.fn().mockResolvedValue({ id: 'app-1' })
    const controller = createJobsController(makeFakeService({ applyToJob: applyToJobMock }))
    const req = makeReq({
      params: { id: 'job-1' } as any,
      body: { workerId: 'worker-1', coverLetter: 'Hi', proposedRate: 100 } as any,
    })
    const res = makeRes()

    await controller.applyToJob(req, res, next)
    await flush()

    expect(applyToJobMock).toHaveBeenCalledWith('job-1', 'worker-1', 'Hi', 100)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('forwards a 409 conflict when the service rejects a duplicate application', async () => {
    const applyToJobMock = vi.fn().mockRejectedValue(new AppError('Already applied to this job', 409))
    const controller = createJobsController(makeFakeService({ applyToJob: applyToJobMock }))
    const req = makeReq({ params: { id: 'job-1' } as any, body: { workerId: 'worker-1' } as any })
    const res = makeRes()

    await controller.applyToJob(req, res, next)
    await flush()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }))
  })
})

describe('withdrawApplication', () => {
  it('returns 400 when workerId is missing from the body', async () => {
    const controller = createJobsController(makeFakeService())
    const res = makeRes()

    await controller.withdrawApplication(makeReq({ params: { id: 'job-1' } as any }), res, next)
    await flush()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }))
  })

  it('withdraws the application when workerId is provided', async () => {
    const withdrawApplicationMock = vi.fn().mockResolvedValue({ id: 'app-1', status: 'withdrawn' })
    const controller = createJobsController(makeFakeService({ withdrawApplication: withdrawApplicationMock }))
    const req = makeReq({ params: { id: 'job-1' } as any, body: { workerId: 'worker-1' } as any })
    const res = makeRes()

    await controller.withdrawApplication(req, res, next)
    await flush()

    expect(withdrawApplicationMock).toHaveBeenCalledWith('job-1', 'worker-1')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { id: 'app-1', status: 'withdrawn' } }))
  })
})

describe('sendMessage / listMessages', () => {
  it('sendMessage creates a message and returns 201', async () => {
    const sendMessageMock = vi.fn().mockResolvedValue({ id: 'msg-1' })
    const controller = createJobsController(makeFakeService({ sendMessage: sendMessageMock }))
    const req = makeReq({
      params: { id: 'job-1' } as any,
      user: { id: 'sender-1', role: 'user' } as any,
      body: { recipientId: 'recipient-1', body: 'Hello' } as any,
    })
    const res = makeRes()

    await controller.sendMessage(req, res, next)
    await flush()

    expect(sendMessageMock).toHaveBeenCalledWith('job-1', 'sender-1', 'recipient-1', 'Hello')
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('listMessages returns the thread for the authenticated user', async () => {
    const listMessagesMock = vi.fn().mockResolvedValue([{ id: 'msg-1' }])
    const controller = createJobsController(makeFakeService({ listMessages: listMessagesMock }))
    const req = makeReq({ params: { id: 'job-1' } as any, user: { id: 'user-1', role: 'user' } as any })
    const res = makeRes()

    await controller.listMessages(req, res, next)
    await flush()

    expect(listMessagesMock).toHaveBeenCalledWith('job-1', 'user-1')
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: 'msg-1' }], status: 'success', code: 200 })
  })
})

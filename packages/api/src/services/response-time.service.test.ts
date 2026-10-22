import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as responseTimeService from './response-time.service'
import { db } from '@/db'
import { AppError } from '@/utils/app-error.js'

vi.mock('@/db.js')
vi.mock('@/utils/app-error.js')

type MockedDb = {
  contactRequest: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
  worker: {
    findMany: ReturnType<typeof vi.fn>
  }
}

const createMockContactRequest = (overrides = {}) => ({
  id: 'request-1',
  fromUserId: 'user-123',
  workerId: 'worker-456',
  status: 'pending',
  createdAt: new Date('2024-01-01T10:00:00Z'),
  respondedAt: null,
  message: 'Can you help?',
  ...overrides,
})

const createMockWorker = (overrides = {}) => ({
  id: 'worker-1',
  name: 'John Doe',
  isActive: true,
  createdAt: new Date(),
  ...overrides,
})

describe('ResponseTimeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('recordResponse', () => {
    it('should record accepted response with respondedAt timestamp', async () => {
      const request = createMockContactRequest({ status: 'pending' })
      const updatedRequest = {
        ...request,
        status: 'accepted',
        respondedAt: new Date(),
        fromUser: { id: 'user-123', name: 'Jane Smith' },
        worker: { id: 'worker-456', name: 'John Doe' },
      }

      ;(db as unknown as MockedDb).contactRequest.findUnique.mockResolvedValue(request)
      ;(db as unknown as MockedDb).contactRequest.update.mockResolvedValue(updatedRequest)

      const result = await responseTimeService.recordResponse('request-1', 'accepted')

      expect((db as unknown as MockedDb).contactRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'request-1' },
      })

      expect((db as unknown as MockedDb).contactRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: {
          status: 'accepted',
          respondedAt: expect.any(Date),
        },
        include: { fromUser: true, worker: true },
      })

      expect(result.status).toBe('accepted')
      expect(result.respondedAt).toBeDefined()
    })

    it('should record declined response with respondedAt timestamp', async () => {
      const request = createMockContactRequest({ status: 'pending' })
      const updatedRequest = {
        ...request,
        status: 'declined',
        respondedAt: new Date(),
        fromUser: { id: 'user-123', name: 'Jane Smith' },
        worker: { id: 'worker-456', name: 'John Doe' },
      }

      ;(db as unknown as MockedDb).contactRequest.findUnique.mockResolvedValue(request)
      ;(db as unknown as MockedDb).contactRequest.update.mockResolvedValue(updatedRequest)

      const result = await responseTimeService.recordResponse('request-1', 'declined')

      expect((db as unknown as MockedDb).contactRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: {
          status: 'declined',
          respondedAt: expect.any(Date),
        },
        include: { fromUser: true, worker: true },
      })

      expect(result.status).toBe('declined')
      expect(result.respondedAt).toBeDefined()
    })

    it('should throw 404 error when request not found', async () => {
      ;(db as unknown as MockedDb).contactRequest.findUnique.mockResolvedValue(null)

      expect(responseTimeService.recordResponse('nonexistent', 'accepted')).rejects.toThrow()
    })

    it('should throw 400 error when request already responded to', async () => {
      const request = createMockContactRequest({
        status: 'accepted',
        respondedAt: new Date('2024-01-01T11:00:00Z'),
      })
      ;(db as unknown as MockedDb).contactRequest.findUnique.mockResolvedValue(request)

      expect(responseTimeService.recordResponse('request-1', 'accepted')).rejects.toThrow()
    })

    it('should include related data in response', async () => {
      const request = createMockContactRequest()
      const fromUser = { id: 'user-123', name: 'Jane Smith', email: 'jane@example.com' }
      const worker = { id: 'worker-456', name: 'John Doe', rating: 4.8 }
      const updatedRequest = {
        ...request,
        status: 'accepted',
        respondedAt: new Date(),
        fromUser,
        worker,
      }

      ;(db as unknown as MockedDb).contactRequest.findUnique.mockResolvedValue(request)
      ;(db as unknown as MockedDb).contactRequest.update.mockResolvedValue(updatedRequest)

      const result = await responseTimeService.recordResponse('request-1', 'accepted')

      expect(result.fromUser).toEqual(fromUser)
      expect(result.worker).toEqual(worker)
    })
  })

  describe('getWorkerResponseStats', () => {
    it('should calculate average response time correctly', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z')
      const time2 = new Date('2024-01-01T12:00:00Z') // 2 hours later
      const time3 = new Date('2024-01-02T10:00:00Z') // 24 hours from time1

      const responded = [
        { createdAt: time1, respondedAt: time2 }, // 2 hours = 7,200,000 ms
        { createdAt: time2, respondedAt: time3 }, // 22 hours = 79,200,000 ms
      ]

      ;(db as unknown as MockedDb).contactRequest.findMany.mockResolvedValue(responded)

      const result = await responseTimeService.getWorkerResponseStats('worker-1')

      expect((db as unknown as MockedDb).contactRequest.findMany).toHaveBeenCalledWith({
        where: { workerId: 'worker-1', respondedAt: { not: null } },
        select: { createdAt: true, respondedAt: true },
      })

      // Average: (7,200,000 + 79,200,000) / 2 = 43,200,000 ms = 12 hours
      expect(result.avgResponseTimeMs).toBe(43200000)
      expect(result.avgResponseTimeHours).toBe(12)
      expect(result.totalResponded).toBe(2)
    })

    it('should mark worker as fast responder when avg <= 2 hours', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z')
      const time2 = new Date('2024-01-01T11:00:00Z') // 1 hour
      const time3 = new Date('2024-01-01T12:30:00Z') // 1.5 hours from time2

      const responded = [
        { createdAt: time1, respondedAt: time2 }, // 1 hour
        { createdAt: time2, respondedAt: time3 }, // 1.5 hours
      ]

      ;(db as unknown as MockedDb).contactRequest.findMany.mockResolvedValue(responded)

      const result = await responseTimeService.getWorkerResponseStats('worker-1')

      // Average: (3,600,000 + 5,400,000) / 2 = 4,500,000 ms = 1.25 hours
      expect(result.avgResponseTimeHours).toBe(1.25)
      expect(result.isFastResponder).toBe(true)
    })

    it('should not mark worker as fast responder when avg > 2 hours', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z')
      const time2 = new Date('2024-01-01T13:00:00Z') // 3 hours

      const responded = [{ createdAt: time1, respondedAt: time2 }]

      ;(db as unknown as MockedDb).contactRequest.findMany.mockResolvedValue(responded)

      const result = await responseTimeService.getWorkerResponseStats('worker-1')

      expect(result.avgResponseTimeHours).toBe(3)
      expect(result.isFastResponder).toBe(false)
    })

    it('should return null stats for worker with no responses', async () => {
      ;(db as unknown as MockedDb).contactRequest.findMany.mockResolvedValue([])

      const result = await responseTimeService.getWorkerResponseStats('worker-1')

      expect(result).toEqual({
        avgResponseTimeMs: null,
        avgResponseTimeHours: null,
        totalResponded: 0,
        isFastResponder: false,
      })
    })

    it('should handle single response', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z')
      const time2 = new Date('2024-01-01T14:00:00Z') // 4 hours

      const responded = [{ createdAt: time1, respondedAt: time2 }]

      ;(db as unknown as MockedDb).contactRequest.findMany.mockResolvedValue(responded)

      const result = await responseTimeService.getWorkerResponseStats('worker-1')

      expect(result.avgResponseTimeMs).toBe(14400000)
      expect(result.avgResponseTimeHours).toBe(4)
      expect(result.totalResponded).toBe(1)
      expect(result.isFastResponder).toBe(false)
    })

    it('should round response time to nearest millisecond', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z')
      const time2 = new Date('2024-01-01T10:01:01.555Z') // 61.555 seconds

      const responded = [{ createdAt: time1, respondedAt: time2 }]

      ;(db as unknown as MockedDb).contactRequest.findMany.mockResolvedValue(responded)

      const result = await responseTimeService.getWorkerResponseStats('worker-1')

      // 61555 ms
      expect(result.avgResponseTimeMs).toBe(61555)
    })

    it('should format response time hours to 2 decimal places', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z')
      const time2 = new Date('2024-01-01T10:03:36Z') // 216 seconds = 0.06 hours

      const responded = [{ createdAt: time1, respondedAt: time2 }]

      ;(db as unknown as MockedDb).contactRequest.findMany.mockResolvedValue(responded)

      const result = await responseTimeService.getWorkerResponseStats('worker-1')

      expect(result.avgResponseTimeHours).toBe(0.06)
    })
  })

  describe('getResponseTimeAnalytics', () => {
    it('should return sorted analytics for all workers', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z')
      const time2 = new Date('2024-01-01T11:00:00Z')
      const time3 = new Date('2024-01-01T10:30:00Z')
      const time4 = new Date('2024-01-01T14:30:00Z')

      const workers = [
        {
          id: 'worker-1',
          name: 'Fast Worker',
          contactRequests: [
            { createdAt: time1, respondedAt: time2 }, // 1 hour
          ],
        },
        {
          id: 'worker-2',
          name: 'Slow Worker',
          contactRequests: [
            { createdAt: time3, respondedAt: time4 }, // 4 hours
          ],
        },
      ]

      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      const result = await responseTimeService.getResponseTimeAnalytics()

      expect(result).toHaveLength(2)
      expect(result[0].workerName).toBe('Fast Worker')
      expect(result[0].avgResponseTimeHours).toBe(1)
      expect(result[1].workerName).toBe('Slow Worker')
      expect(result[1].avgResponseTimeHours).toBe(4)
    })

    it('should include workers with no responses at end', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z')
      const time2 = new Date('2024-01-01T12:00:00Z')

      const workers = [
        {
          id: 'worker-1',
          name: 'Active Worker',
          contactRequests: [
            { createdAt: time1, respondedAt: time2 }, // 2 hours
          ],
        },
        {
          id: 'worker-2',
          name: 'Inactive Worker',
          contactRequests: [],
        },
      ]

      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      const result = await responseTimeService.getResponseTimeAnalytics()

      expect(result).toHaveLength(2)
      expect(result[0].workerName).toBe('Active Worker')
      expect(result[0].avgResponseTimeHours).toBe(2)
      expect(result[0].totalResponded).toBe(1)
      expect(result[1].workerName).toBe('Inactive Worker')
      expect(result[1].avgResponseTimeHours).toBeNull()
      expect(result[1].totalResponded).toBe(0)
    })

    it('should handle worker with mixed responded and pending requests', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z')
      const time2 = new Date('2024-01-01T12:00:00Z')

      const workers = [
        {
          id: 'worker-1',
          name: 'Mixed Worker',
          contactRequests: [
            { createdAt: time1, respondedAt: time2 }, // 2 hours - responded
            { createdAt: new Date('2024-01-02T10:00:00Z'), respondedAt: null }, // pending
          ],
        },
      ]

      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      const result = await responseTimeService.getResponseTimeAnalytics()

      expect(result).toHaveLength(1)
      expect(result[0].avgResponseTimeHours).toBe(2)
      expect(result[0].totalResponded).toBe(1)
    })

    it('should return empty array when no workers exist', async () => {
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue([])

      const result = await responseTimeService.getResponseTimeAnalytics()

      expect(result).toEqual([])
    })

    it('should sort by response time ascending', async () => {
      const workers = [
        {
          id: 'worker-1',
          name: 'Worker A',
          contactRequests: [
            {
              createdAt: new Date('2024-01-01T10:00:00Z'),
              respondedAt: new Date('2024-01-01T18:00:00Z'),
            }, // 8 hours
          ],
        },
        {
          id: 'worker-2',
          name: 'Worker B',
          contactRequests: [
            {
              createdAt: new Date('2024-01-01T10:00:00Z'),
              respondedAt: new Date('2024-01-01T11:00:00Z'),
            }, // 1 hour
          ],
        },
        {
          id: 'worker-3',
          name: 'Worker C',
          contactRequests: [
            {
              createdAt: new Date('2024-01-01T10:00:00Z'),
              respondedAt: new Date('2024-01-01T14:00:00Z'),
            }, // 4 hours
          ],
        },
      ]

      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      const result = await responseTimeService.getResponseTimeAnalytics()

      expect(result.map((w) => w.workerName)).toEqual(['Worker B', 'Worker C', 'Worker A'])
      expect(result.map((w) => w.avgResponseTimeHours)).toEqual([1, 4, 8])
    })

    it('should calculate average across multiple responses per worker', async () => {
      const workers = [
        {
          id: 'worker-1',
          name: 'Worker',
          contactRequests: [
            {
              createdAt: new Date('2024-01-01T10:00:00Z'),
              respondedAt: new Date('2024-01-01T12:00:00Z'),
            }, // 2 hours
            {
              createdAt: new Date('2024-01-02T10:00:00Z'),
              respondedAt: new Date('2024-01-02T16:00:00Z'),
            }, // 6 hours
          ],
        },
      ]

      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      const result = await responseTimeService.getResponseTimeAnalytics()

      // Average: (2 + 6) / 2 = 4 hours
      expect(result[0].avgResponseTimeHours).toBe(4)
      expect(result[0].totalResponded).toBe(2)
    })

    it('should use Infinity as sort key for workers with null response time', async () => {
      const workers = [
        {
          id: 'worker-1',
          name: 'No Response Worker',
          contactRequests: [],
        },
        {
          id: 'worker-2',
          name: 'Fast Worker',
          contactRequests: [
            {
              createdAt: new Date('2024-01-01T10:00:00Z'),
              respondedAt: new Date('2024-01-01T11:00:00Z'),
            }, // 1 hour
          ],
        },
      ]

      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      const result = await responseTimeService.getResponseTimeAnalytics()

      // Fast worker should come first
      expect(result[0].workerName).toBe('Fast Worker')
      expect(result[1].workerName).toBe('No Response Worker')
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AppError } from '../utils/app-error.js'
import * as insuranceService from './insurance.service.js'

// Mock dependencies
vi.mock('../db.js', () => ({
  db: {
    worker: {
      findUnique: vi.fn(),
    },
    insuranceDocument: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../mailer/index.js', () => ({
  sendInsuranceRenewalReminder: vi.fn(),
}))

import { db } from '../db.js'
import { sendInsuranceRenewalReminder } from '../mailer/index.js'

const mockDb = db as any
const mockMailer = {
  sendInsuranceRenewalReminder: sendInsuranceRenewalReminder as any,
}

// Helper to create mock worker data
function createMockWorker(overrides = {}) {
  return {
    id: 'worker-1',
    name: 'John Worker',
    email: 'worker@example.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

// Helper to create mock insurance document
function createMockInsuranceDocument(overrides = {}) {
  return {
    id: 'insurance-1',
    workerId: 'worker-1',
    documentUrl: 'https://example.com/insurance.pdf',
    expiresAt: new Date('2024-12-31'),
    provider: 'Acme Insurance',
    policyNumber: 'POL-123456',
    status: 'verified',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Insurance Service', () => {
  describe('uploadInsurance', () => {
    it('should upload insurance document for valid worker', async () => {
      const worker = createMockWorker()
      const mockDoc = createMockInsuranceDocument()

      mockDb.worker.findUnique.mockResolvedValue(worker)
      mockDb.insuranceDocument.create.mockResolvedValue(mockDoc)

      const result = await insuranceService.uploadInsurance(
        'worker-1',
        'https://example.com/insurance.pdf',
        new Date('2024-12-31'),
        'Acme Insurance',
        'POL-123456'
      )

      expect(mockDb.worker.findUnique).toHaveBeenCalledWith({
        where: { id: 'worker-1' },
      })
      expect(mockDb.insuranceDocument.create).toHaveBeenCalledWith({
        data: {
          workerId: 'worker-1',
          documentUrl: 'https://example.com/insurance.pdf',
          expiresAt: expect.any(Date),
          provider: 'Acme Insurance',
          policyNumber: 'POL-123456',
        },
      })
      expect(result).toEqual(mockDoc)
    })

    it('should throw error if worker not found', async () => {
      mockDb.worker.findUnique.mockResolvedValue(null)

      await expect(
        insuranceService.uploadInsurance(
          'invalid-worker-id',
          'https://example.com/insurance.pdf',
          new Date('2024-12-31')
        )
      ).rejects.toThrow('Worker not found')
    })

    it('should handle optional parameters', async () => {
      const worker = createMockWorker()
      const mockDoc = createMockInsuranceDocument({ provider: undefined, policyNumber: undefined })

      mockDb.worker.findUnique.mockResolvedValue(worker)
      mockDb.insuranceDocument.create.mockResolvedValue(mockDoc)

      const result = await insuranceService.uploadInsurance(
        'worker-1',
        'https://example.com/insurance.pdf',
        new Date('2024-12-31')
      )

      expect(mockDb.insuranceDocument.create).toHaveBeenCalledWith({
        data: {
          workerId: 'worker-1',
          documentUrl: 'https://example.com/insurance.pdf',
          expiresAt: expect.any(Date),
          provider: undefined,
          policyNumber: undefined,
        },
      })
      expect(result).toBeDefined()
    })
  })

  describe('getWorkerInsurance', () => {
    it('should return all insurance documents for worker', async () => {
      const mockDocs = [
        createMockInsuranceDocument({ id: 'insurance-1' }),
        createMockInsuranceDocument({ id: 'insurance-2' }),
      ]

      mockDb.insuranceDocument.findMany.mockResolvedValue(mockDocs)

      const result = await insuranceService.getWorkerInsurance('worker-1')

      expect(mockDb.insuranceDocument.findMany).toHaveBeenCalledWith({
        where: { workerId: 'worker-1' },
        orderBy: { createdAt: 'desc' },
      })
      expect(result).toEqual(mockDocs)
    })

    it('should return empty array if no documents found', async () => {
      mockDb.insuranceDocument.findMany.mockResolvedValue([])

      const result = await insuranceService.getWorkerInsurance('worker-1')

      expect(result).toEqual([])
    })
  })

  describe('updateInsuranceStatus', () => {
    it('should update insurance document status to verified', async () => {
      const mockDoc = createMockInsuranceDocument({ status: 'verified' })

      mockDb.insuranceDocument.findUnique.mockResolvedValue(mockDoc)
      mockDb.insuranceDocument.update.mockResolvedValue(mockDoc)

      const result = await insuranceService.updateInsuranceStatus('insurance-1', 'verified')

      expect(mockDb.insuranceDocument.findUnique).toHaveBeenCalledWith({
        where: { id: 'insurance-1' },
      })
      expect(mockDb.insuranceDocument.update).toHaveBeenCalledWith({
        where: { id: 'insurance-1' },
        data: { status: 'verified' },
      })
      expect(result).toEqual(mockDoc)
    })

    it('should update insurance document status to rejected', async () => {
      const mockDoc = createMockInsuranceDocument({ status: 'rejected' })

      mockDb.insuranceDocument.findUnique.mockResolvedValue(mockDoc)
      mockDb.insuranceDocument.update.mockResolvedValue(mockDoc)

      const result = await insuranceService.updateInsuranceStatus('insurance-1', 'rejected')

      expect(mockDb.insuranceDocument.update).toHaveBeenCalledWith({
        where: { id: 'insurance-1' },
        data: { status: 'rejected' },
      })
      expect(result.status).toBe('rejected')
    })

    it('should throw error if document not found', async () => {
      mockDb.insuranceDocument.findUnique.mockResolvedValue(null)

      await expect(
        insuranceService.updateInsuranceStatus('invalid-id', 'verified')
      ).rejects.toThrow('Insurance document not found')
    })
  })

  describe('sendRenewalReminders', () => {
    it('should send reminders for documents expiring within threshold', async () => {
      const expiringDoc = createMockInsuranceDocument({
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        worker: {
          id: 'worker-1',
          name: 'John Worker',
          curator: {
            id: 'curator-1',
            email: 'curator@example.com',
          },
        },
      })

      mockDb.insuranceDocument.findMany.mockResolvedValue([expiringDoc])

      const result = await insuranceService.sendRenewalReminders(30)

      expect(mockDb.insuranceDocument.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lte: expect.any(Date) },
          status: 'verified',
        },
        include: { worker: { include: { curator: true } } },
      })
      expect(result).toBe(1)
    })

    it('should not send reminders for documents expiring beyond threshold', async () => {
      mockDb.insuranceDocument.findMany.mockResolvedValue([])

      const result = await insuranceService.sendRenewalReminders(30)

      expect(result).toBe(0)
      expect(mockMailer.sendInsuranceRenewalReminder).not.toHaveBeenCalled()
    })

    it('should handle default days ahead parameter', async () => {
      mockDb.insuranceDocument.findMany.mockResolvedValue([])

      await insuranceService.sendRenewalReminders()

      expect(mockDb.insuranceDocument.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lte: expect.any(Date) },
          status: 'verified',
        },
        include: { worker: { include: { curator: true } } },
      })
    })

    it('should use Promise.allSettled to handle mail failures gracefully', async () => {
      const expiringDoc = createMockInsuranceDocument({
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        worker: {
          id: 'worker-1',
          name: 'John Worker',
          curator: {
            id: 'curator-1',
            email: 'curator@example.com',
          },
        },
      })

      mockDb.insuranceDocument.findMany.mockResolvedValue([expiringDoc])
      mockMailer.sendInsuranceRenewalReminder.mockRejectedValueOnce(new Error('Mail failed'))

      const result = await insuranceService.sendRenewalReminders(30)

      expect(result).toBe(1)
    })
  })
})

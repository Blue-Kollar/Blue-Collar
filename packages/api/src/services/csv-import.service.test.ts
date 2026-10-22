import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as csvImportService from './csv-import.service.js'
import { CsvWorkerRow, ImportResult } from './csv-import.service.js'

// Mock dependencies
vi.mock('../db.js', () => ({
  db: {
    category: {
      findMany: vi.fn(),
    },
    worker: {
      create: vi.fn(),
    },
    $transaction: vi.fn((operations) => Promise.all(operations)),
  },
}))

import { db } from '../db.js'

const mockDb = db as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CSV Import Service', () => {
  describe('importWorkersFromCsv', () => {
    const validCsv = `name,categoryId,bio,phone,email,walletAddress
John Doe,cat-1,A talented worker,555-0001,john@example.com,GJOHNWALLET
Jane Smith,cat-2,Experienced contractor,555-0002,jane@example.com,GJANEWALLET`

    const minimumCsv = `name,categoryId
Alice Johnson,cat-1
Bob Wilson,cat-2`

    const missingNameCsv = `name,categoryId
,cat-1
Bob Wilson,cat-2`

    const missingCategoryIdCsv = `name,categoryId
Alice Johnson,
Bob Wilson,cat-2`

    const missingHeaderCsv = `name
Alice Johnson
Bob Wilson`

    const invalidCategoryIdCsv = `name,categoryId
Alice Johnson,invalid-cat
Bob Wilson,cat-2`

    it('should import valid workers with all fields', async () => {
      mockDb.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ])

      const mockWorker1 = {
        id: 'worker-1',
        name: 'John Doe',
        categoryId: 'cat-1',
        bio: 'A talented worker',
        phone: '555-0001',
        email: 'john@example.com',
        walletAddress: 'GJOHNWALLET',
      }

      const mockWorker2 = {
        id: 'worker-2',
        name: 'Jane Smith',
        categoryId: 'cat-2',
        bio: 'Experienced contractor',
        phone: '555-0002',
        email: 'jane@example.com',
        walletAddress: 'GJANEWALLET',
      }

      mockDb.worker.create
        .mockResolvedValueOnce(mockWorker1)
        .mockResolvedValueOnce(mockWorker2)

      mockDb.$transaction.mockImplementation((ops) =>
        Promise.all(ops.map((op) => (op.data.name === 'John Doe' ? mockWorker1 : mockWorker2)))
      )

      const result = await csvImportService.importWorkersFromCsv(validCsv, 'curator-1')

      expect(result.imported).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should import workers with minimum required fields', async () => {
      mockDb.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ])

      mockDb.$transaction.mockResolvedValue([
        { id: 'worker-1', name: 'Alice Johnson', categoryId: 'cat-1' },
        { id: 'worker-2', name: 'Bob Wilson', categoryId: 'cat-2' },
      ])

      const result = await csvImportService.importWorkersFromCsv(minimumCsv, 'curator-1')

      expect(result.imported).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should skip rows with missing name', async () => {
      mockDb.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ])

      mockDb.$transaction.mockResolvedValue([
        { id: 'worker-1', name: 'Bob Wilson', categoryId: 'cat-2' },
      ])

      const result = await csvImportService.importWorkersFromCsv(missingNameCsv, 'curator-1')

      expect(result.imported).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          row: 2,
          reason: 'name is required',
        })
      )
    })

    it('should skip rows with missing categoryId', async () => {
      mockDb.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ])

      mockDb.$transaction.mockResolvedValue([
        { id: 'worker-1', name: 'Alice Johnson', categoryId: 'cat-1' },
      ])

      const result = await csvImportService.importWorkersFromCsv(missingCategoryIdCsv, 'curator-1')

      expect(result.imported).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          row: 3,
          reason: 'categoryId is required',
        })
      )
    })

    it('should throw error if required header is missing', async () => {
      await expect(
        csvImportService.importWorkersFromCsv(missingHeaderCsv, 'curator-1')
      ).rejects.toThrow('Missing required CSV column')
    })

    it('should skip rows with invalid categoryId', async () => {
      mockDb.category.findMany.mockResolvedValue([
        { id: 'cat-2' },
      ])

      mockDb.$transaction.mockResolvedValue([
        { id: 'worker-1', name: 'Bob Wilson', categoryId: 'cat-2' },
      ])

      const result = await csvImportService.importWorkersFromCsv(invalidCategoryIdCsv, 'curator-1')

      expect(result.imported).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          row: 2,
          reason: expect.stringContaining('categoryId'),
        })
      )
    })

    it('should return zero imports when all rows are invalid', async () => {
      mockDb.category.findMany.mockResolvedValue([])

      const result = await csvImportService.importWorkersFromCsv(invalidCategoryIdCsv, 'curator-1')

      expect(result.imported).toBe(0)
      expect(result.failed).toBe(2)
      expect(mockDb.$transaction).not.toHaveBeenCalled()
    })

    it('should handle empty CSV', async () => {
      const result = await csvImportService.importWorkersFromCsv('', 'curator-1')

      expect(result.imported).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('should handle CSV with only headers', async () => {
      const result = await csvImportService.importWorkersFromCsv('name,categoryId', 'curator-1')

      expect(result.imported).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('should handle quoted CSV fields', async () => {
      const quotedCsv = `name,categoryId,bio
"Doe, John",cat-1,"Worker with, comma"
"Smith, Jane",cat-2,"Contractor with ""quotes"""`

      mockDb.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ])

      mockDb.$transaction.mockResolvedValue([
        { id: 'worker-1', name: 'Doe, John', categoryId: 'cat-1', bio: 'Worker with, comma' },
        { id: 'worker-2', name: 'Smith, Jane', categoryId: 'cat-2', bio: 'Contractor with "quotes"' },
      ])

      const result = await csvImportService.importWorkersFromCsv(quotedCsv, 'curator-1')

      expect(result.imported).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('should handle case-insensitive column headers', async () => {
      const mixedCaseCsv = `NAME,CategoryID,Bio
Alice Johnson,cat-1,A worker
Bob Wilson,cat-2,A contractor`

      mockDb.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ])

      mockDb.$transaction.mockResolvedValue([
        { id: 'worker-1', name: 'Alice Johnson', categoryId: 'cat-1' },
        { id: 'worker-2', name: 'Bob Wilson', categoryId: 'cat-2' },
      ])

      const result = await csvImportService.importWorkersFromCsv(mixedCaseCsv, 'curator-1')

      expect(result.imported).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('should trim whitespace from fields', async () => {
      const whitespaceCsv = `name,categoryId
  Alice Johnson  ,  cat-1  
  Bob Wilson  ,  cat-2  `

      mockDb.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ])

      mockDb.$transaction.mockResolvedValue([
        { id: 'worker-1', name: 'Alice Johnson', categoryId: 'cat-1' },
        { id: 'worker-2', name: 'Bob Wilson', categoryId: 'cat-2' },
      ])

      const result = await csvImportService.importWorkersFromCsv(whitespaceCsv, 'curator-1')

      expect(result.imported).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('should use transaction for batch insert', async () => {
      mockDb.category.findMany.mockResolvedValue([{ id: 'cat-1' }])

      const createWorkerMock = vi.fn().mockResolvedValue({ id: 'worker-1' })
      mockDb.worker.create = createWorkerMock

      mockDb.$transaction.mockImplementation((ops) =>
        Promise.all(ops.map((op) => createWorkerMock(op)))
      )

      await csvImportService.importWorkersFromCsv(minimumCsv, 'curator-1')

      expect(mockDb.$transaction).toHaveBeenCalled()
    })
  })
})

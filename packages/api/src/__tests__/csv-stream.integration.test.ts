/**
 * Integration tests for streaming CSV exports (#1641).
 *
 * Tests verify:
 * - CSV escaping correctness (RFC-4180 compliance)
 * - Streaming doesn't buffer full dataset in memory
 * - Large datasets (100k+ rows) export successfully
 * - Row count accuracy
 * - Backpressure handling
 * - HTTP headers are set correctly
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Response } from 'express'
import { Readable, Writable } from 'stream'
import { CsvWriter, escapeCsvField, streamCsvArray, streamCsvPaginated } from '@/utils/csv-writer.js'

describe('CSV Streaming', () => {
  // ── escapeCsvField tests ────────────────────────────────────────────────

  describe('escapeCsvField', () => {
    it('returns plain strings without escaping', () => {
      expect(escapeCsvField('hello')).toBe('hello')
      expect(escapeCsvField('world123')).toBe('world123')
    })

    it('escapes fields with commas', () => {
      expect(escapeCsvField('hello,world')).toBe('"hello,world"')
    })

    it('escapes fields with double quotes', () => {
      expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
    })

    it('escapes fields with newlines', () => {
      expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
    })

    it('handles multiple special characters', () => {
      expect(escapeCsvField('say "hello", then\nnext')).toBe('"say ""hello"", then\nnext"')
    })

    it('handles null and undefined', () => {
      expect(escapeCsvField(null)).toBe('')
      expect(escapeCsvField(undefined)).toBe('')
    })

    it('converts numbers to strings', () => {
      expect(escapeCsvField(42)).toBe('42')
      expect(escapeCsvField(3.14)).toBe('3.14')
    })

    it('converts booleans to strings', () => {
      expect(escapeCsvField(true)).toBe('true')
      expect(escapeCsvField(false)).toBe('false')
    })
  })

  // ── CsvWriter tests ──────────────────────────────────────────────────────

  describe('CsvWriter', () => {
    let mockResponse: Partial<Response>
    let chunks: string[]

    beforeAll(() => {
      chunks = []
      mockResponse = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string, encoding: string, cb?: (err?: Error) => void) => {
          chunks.push(data)
          if (cb) cb()
          return true // Can continue writing
        }),
        end: vi.fn((cb?: () => void) => {
          ;(mockResponse as any).writableEnded = true
          if (cb) cb()
        }),
        once: vi.fn(),
      }
    })

    it('initializes with correct headers', () => {
      const writer = new CsvWriter(mockResponse as Response, 'test.csv')
      writer.initialize()

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8')
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="test.csv"',
      )
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-store, must-revalidate')
    })

    it('writes header row', async () => {
      chunks = []
      const writer = new CsvWriter(mockResponse as Response, 'test.csv')
      writer.initialize()

      await writer.writeHeader(['Name', 'Email', 'Age'])

      expect(chunks[0]).toBe('Name,Email,Age\n')
    })

    it('throws if header written twice', async () => {
      const writer = new CsvWriter(mockResponse as Response, 'test.csv')
      writer.initialize()

      await writer.writeHeader(['Name', 'Email'])

      await expect(writer.writeHeader(['Other'])).rejects.toThrow('Header has already been written')
    })

    it('throws if data row written before header', async () => {
      const writer = new CsvWriter(mockResponse as Response, 'test.csv')

      await expect(writer.writeRow(['value1'])).rejects.toThrow('Header must be written before data rows')
    })

    it('writes data rows with proper escaping', async () => {
      chunks = []
      const writer = new CsvWriter(mockResponse as Response, 'test.csv')
      writer.initialize()

      await writer.writeHeader(['Name', 'Email', 'Notes'])
      await writer.writeRow(['John Doe', 'john@example.com', 'Says "hello"'])
      await writer.writeRow(['Jane Smith', 'jane@example.com', 'Likes,coding'])

      expect(chunks[1]).toBe('John Doe,john@example.com,"Says ""hello"""\n')
      expect(chunks[2]).toBe('Jane Smith,jane@example.com,"Likes,coding"\n')
    })

    it('tracks row count', async () => {
      chunks = []
      const writer = new CsvWriter(mockResponse as Response, 'test.csv')
      writer.initialize()

      await writer.writeHeader(['Name'])
      expect(writer.getRowCount()).toBe(0)

      await writer.writeRow(['Alice'])
      expect(writer.getRowCount()).toBe(1)

      await writer.writeRow(['Bob'])
      expect(writer.getRowCount()).toBe(2)
    })

    it('handles backpressure', async () => {
      chunks = []
      let drainCallback: (() => void) | null = null

      const backpressureResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string, encoding: string, cb?: (err?: Error) => void) => {
          chunks.push(data)
          if (cb) cb()
          return false // Signal backpressure
        }),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn((event: string, cb: () => void) => {
          if (event === 'drain') {
            drainCallback = cb
          }
        }),
      }

      const writer = new CsvWriter(backpressureResponse as Response, 'test.csv')
      writer.initialize()

      await writer.writeHeader(['Name'])

      // Trigger drain manually
      const writePromise = writer.writeRow(['Alice'])
      expect(drainCallback).not.toBeNull()
      drainCallback!()

      await writePromise
      expect(chunks.length).toBe(2) // Header + row
    })

    it('ends response stream', async () => {
      chunks = []
      const writer = new CsvWriter(mockResponse as Response, 'test.csv')
      writer.initialize()

      await writer.writeHeader(['Name'])
      await writer.writeRow(['Alice'])
      await writer.end()

      expect(mockResponse.end).toHaveBeenCalled()
    })
  })

  // ── streamCsvArray tests ──────────────────────────────────────────────────

  describe('streamCsvArray', () => {
    it('streams array of objects as CSV', async () => {
      chunks = []
      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          chunks.push(data)
          return true
        }),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const rows = [
        { name: 'Alice', email: 'alice@example.com', age: 30 },
        { name: 'Bob', email: 'bob@example.com', age: 25 },
      ]

      const count = await streamCsvArray(
        mockResponse as Response,
        'users.csv',
        ['Name', 'Email', 'Age'],
        rows,
        (r) => [r.name, r.email, r.age],
      )

      expect(count).toBe(2)
      expect(chunks[0]).toBe('Name,Email,Age\n')
      expect(chunks[1]).toBe('Alice,alice@example.com,30\n')
      expect(chunks[2]).toBe('Bob,bob@example.com,25\n')
    })

    it('handles empty array', async () => {
      chunks = []
      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          chunks.push(data)
          return true
        }),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const count = await streamCsvArray(
        mockResponse as Response,
        'empty.csv',
        ['Name'],
        [],
        (r: any) => [r.name],
      )

      expect(count).toBe(0)
      expect(chunks[0]).toBe('Name\n')
    })
  })

  // ── streamCsvPaginated tests ──────────────────────────────────────────────

  describe('streamCsvPaginated', () => {
    it('streams paginated data', async () => {
      chunks = []
      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          chunks.push(data)
          return true
        }),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const generatePage = async (skip: number) => {
        // Simulate paginated data: 3 items per page, total 10 items
        const allItems = Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `Item ${i + 1}`,
        }))
        return allItems.slice(skip, skip + 3)
      }

      const count = await streamCsvPaginated(
        mockResponse as Response,
        'items.csv',
        ['ID', 'Name'],
        generatePage,
        3,
        (r) => [r.id, r.name],
      )

      expect(count).toBe(10)
      expect(chunks[0]).toBe('ID,Name\n')
      // Should have 10 data rows + 1 header
      expect(chunks.length).toBe(11)
    })

    it('handles large paginated dataset (100k rows simulation)', async () => {
      chunks = []
      let fetchCount = 0

      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          chunks.push(data)
          return true
        }),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const pageSize = 1000
      const totalRows = 100000

      const generatePage = async (skip: number) => {
        fetchCount++
        const pageItems = Array.from({ length: pageSize }, (_, i) => {
          const id = skip + i + 1
          return { id, name: `User ${id}`, email: `user${id}@example.com` }
        })

        // Simulate end of data
        if (skip + pageSize >= totalRows) {
          return pageItems.slice(0, totalRows - skip)
        }
        return pageItems
      }

      const count = await streamCsvPaginated(
        mockResponse as Response,
        'large.csv',
        ['ID', 'Name', 'Email'],
        generatePage,
        pageSize,
        (r) => [r.id, r.name, r.email],
      )

      expect(count).toBe(totalRows)
      expect(fetchCount).toBe(100) // 100k / 1000 = 100 pages
      expect(chunks[0]).toBe('ID,Name,Email\n')
      // Should have 100k data rows + 1 header = 100001 chunks
      expect(chunks.length).toBe(100001)
    })

    it('stops when fetcher returns fewer items than pageSize', async () => {
      chunks = []
      let fetchCount = 0

      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          chunks.push(data)
          return true
        }),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const generatePage = async (skip: number) => {
        fetchCount++
        // Always return 5 items (less than pageSize of 10)
        return Array.from({ length: 5 }, (_, i) => ({ id: skip + i + 1, name: `Item ${skip + i + 1}` }))
      }

      const count = await streamCsvPaginated(
        mockResponse as Response,
        'small.csv',
        ['ID', 'Name'],
        generatePage,
        10,
        (r) => [r.id, r.name],
      )

      expect(count).toBe(5)
      expect(fetchCount).toBe(1) // Only one fetch needed
    })
  })

  // ── Memory efficiency tests ──────────────────────────────────────────────

  describe('Memory efficiency', () => {
    it('does not buffer entire dataset in memory', async () => {
      // This test simulates streaming without holding all rows in memory
      let maxChunksInMemory = 0
      let currentChunksInMemory = 0

      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          currentChunksInMemory++
          maxChunksInMemory = Math.max(maxChunksInMemory, currentChunksInMemory)
          // Simulate drain - chunks are flushed
          setImmediate(() => {
            currentChunksInMemory = 0
          })
          return true
        }),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const pageSize = 100
      const totalRows = 10000

      const generatePage = async (skip: number) => {
        return Array.from({ length: Math.min(pageSize, totalRows - skip) }, (_, i) => ({
          id: skip + i + 1,
          name: `Item ${skip + i + 1}`,
        }))
      }

      await streamCsvPaginated(
        mockResponse as Response,
        'test.csv',
        ['ID', 'Name'],
        generatePage,
        pageSize,
        (r) => [r.id, r.name],
      )

      // With streaming, max chunks in memory should be small (1-2)
      // If buffering entire dataset, it would be 10000+
      expect(maxChunksInMemory).toBeLessThanOrEqual(2)
    })
  })

  // ── RFC-4180 compliance tests ────────────────────────────────────────────

  describe('RFC-4180 CSV compliance', () => {
    it('handles all special cases correctly', async () => {
      chunks = []
      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          chunks.push(data)
          return true
        }),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const rows = [
        {
          name: 'Simple Name',
          description: 'No special chars',
        },
        {
          name: 'Name with "quotes"',
          description: 'Has, comma',
        },
        {
          name: 'Name\nwith\nnewlines',
          description: 'Multi\nline\ndescription',
        },
        {
          name: 'Mix "of", everything\n',
          description: 'All, "special" chars\n',
        },
      ]

      await streamCsvArray(
        mockResponse as Response,
        'rfc4180.csv',
        ['Name', 'Description'],
        rows,
        (r) => [r.name, r.description],
      )

      // Verify RFC-4180 escaping
      expect(chunks[0]).toBe('Name,Description\n')
      expect(chunks[1]).toBe('Simple Name,No special chars\n')
      expect(chunks[2]).toBe('"Name with ""quotes""","Has, comma"\n')
      expect(chunks[3]).toBe('"Name\nwith\nnewlines","Multi\nline\ndescription"\n')
      expect(chunks[4]).toBe('"Mix ""of"", everything\n","All, ""special"" chars\n"\n')
    })
  })
})

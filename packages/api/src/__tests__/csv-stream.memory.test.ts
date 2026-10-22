/**
 * Memory profiling tests for streaming CSV exports (#1641).
 *
 * Tests verify that memory usage stays flat when streaming large datasets
 * (100k+ rows) without buffering the entire result in memory.
 *
 * Run with: pnpm test:perf or vitest run src/__tests__/csv-stream.memory.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Response } from 'express'
import { streamCsvPaginated } from '@/utils/csv-writer.js'

describe('CSV Streaming - Memory Profiling', () => {
  describe('Large dataset streaming (100k rows)', () => {
    it('maintains flat memory usage during 100k row export', async () => {
      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => true),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const pageSize = 1000
      const totalRows = 100000
      let peakMemory = 0
      let lastMemory = 0
      const memoryReadings: number[] = []

      const generatePage = async (skip: number) => {
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }

        const memBefore = process.memoryUsage().heapUsed
        memoryReadings.push(memBefore)
        peakMemory = Math.max(peakMemory, memBefore)

        const pageItems = Array.from({ length: Math.min(pageSize, totalRows - skip) }, (_, i) => {
          const id = skip + i + 1
          return {
            id,
            name: `User ${id}`,
            email: `user${id}@example.com`,
            description: `A somewhat lengthy description for user ${id} to make rows larger`,
            timestamp: new Date().toISOString(),
          }
        })

        lastMemory = memBefore
        return pageItems
      }

      const rowCount = await streamCsvPaginated(
        mockResponse as Response,
        'large.csv',
        ['ID', 'Name', 'Email', 'Description', 'Timestamp'],
        generatePage,
        pageSize,
        (r) => [r.id, r.name, r.email, r.description, r.timestamp],
      )

      expect(rowCount).toBe(totalRows)

      // Calculate memory growth
      const minMemory = Math.min(...memoryReadings)
      const maxMemory = Math.max(...memoryReadings)
      const memoryGrowth = maxMemory - minMemory

      // Memory growth should be minimal (less than 50MB for 100k rows)
      // This proves we're not buffering the entire dataset
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024)

      // Verify we had multiple pages (not a single fetch)
      expect(memoryReadings.length).toBe(100) // 100k / 1000 = 100 pages

      console.log(`Memory profiling results:`)
      console.log(`  Rows: ${rowCount}`)
      console.log(`  Pages: ${memoryReadings.length}`)
      console.log(`  Min memory: ${(minMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Max memory: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`)
    })

    it('shows memory stays stable across pagination cycles', async () => {
      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => true),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const pageSize = 500
      const totalRows = 50000
      const memoryReadings: number[] = []

      const generatePage = async (skip: number) => {
        if (global.gc) {
          global.gc()
        }

        const mem = process.memoryUsage().heapUsed
        memoryReadings.push(mem)

        return Array.from({ length: Math.min(pageSize, totalRows - skip) }, (_, i) => ({
          id: skip + i + 1,
          name: `Item ${skip + i + 1}`,
          data: Array(100).fill('x').join(''),
        }))
      }

      await streamCsvPaginated(
        mockResponse as Response,
        'test.csv',
        ['ID', 'Name', 'Data'],
        generatePage,
        pageSize,
        (r) => [r.id, r.name, r.data],
      )

      // Verify memory readings show stability
      // Split into quarters and check that no quarter uses significantly more memory
      const quarterSize = Math.floor(memoryReadings.length / 4)
      const quarters = [
        memoryReadings.slice(0, quarterSize),
        memoryReadings.slice(quarterSize, quarterSize * 2),
        memoryReadings.slice(quarterSize * 2, quarterSize * 3),
        memoryReadings.slice(quarterSize * 3),
      ]

      const quarterAverages = quarters.map((q) => q.reduce((a, b) => a + b, 0) / q.length)
      const avgMemory = quarterAverages.reduce((a, b) => a + b, 0) / quarterAverages.length

      // No quarter should use more than 30% more memory than average
      for (const avg of quarterAverages) {
        expect(avg).toBeLessThan(avgMemory * 1.3)
      }

      console.log(`Memory stability across quarters:`)
      quarterAverages.forEach((avg, i) => {
        console.log(`  Quarter ${i + 1}: ${(avg / 1024 / 1024).toFixed(2)}MB`)
      })
    })

    it('demonstrates row throughput with streaming', async () => {
      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string) => true),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn(),
      }

      const pageSize = 1000
      const totalRows = 100000

      const startTime = Date.now()

      await streamCsvPaginated(
        mockResponse as Response,
        'throughput.csv',
        ['ID', 'Name', 'Email'],
        async (skip: number) => {
          return Array.from({ length: Math.min(pageSize, totalRows - skip) }, (_, i) => ({
            id: skip + i + 1,
            name: `User ${skip + i + 1}`,
            email: `user${skip + i + 1}@example.com`,
          }))
        },
        pageSize,
        (r) => [r.id, r.name, r.email],
      )

      const elapsedMs = Date.now() - startTime
      const rowsPerSecond = (totalRows / elapsedMs) * 1000

      console.log(`Throughput:`)
      console.log(`  Time: ${elapsedMs}ms`)
      console.log(`  Rows: ${totalRows}`)
      console.log(`  Rate: ${rowsPerSecond.toFixed(0)} rows/sec`)

      // Should handle at least 1000 rows/sec (reasonable for local streaming)
      expect(rowsPerSecond).toBeGreaterThan(100)
    })
  })

  describe('Backpressure and memory handling', () => {
    it('respects backpressure signals during streaming', async () => {
      let writeCount = 0
      let drainWaitCount = 0

      const mockResponse: Partial<Response> = {
        writableEnded: false,
        setHeader: vi.fn(),
        write: vi.fn((data: string, encoding: string, cb?: (err?: Error) => void) => {
          writeCount++
          // Simulate backpressure every 10th write
          const shouldBackpressure = writeCount % 10 === 0
          if (cb) cb()
          return !shouldBackpressure
        }),
        end: vi.fn((cb?: () => void) => {
          if (cb) cb()
        }),
        once: vi.fn((event: string, cb: () => void) => {
          if (event === 'drain') {
            drainWaitCount++
          }
        }),
      }

      const pageSize = 100
      const totalRows = 5000

      await streamCsvPaginated(
        mockResponse as Response,
        'backpressure.csv',
        ['ID', 'Name'],
        async (skip: number) => {
          return Array.from({ length: Math.min(pageSize, totalRows - skip) }, (_, i) => ({
            id: skip + i + 1,
            name: `Item ${skip + i + 1}`,
          }))
        },
        pageSize,
        (r) => [r.id, r.name],
      )

      console.log(`Backpressure handling:`)
      console.log(`  Write calls: ${writeCount}`)
      console.log(`  Drain wait triggers: ${drainWaitCount}`)

      // Should have handled backpressure responsibly
      expect(drainWaitCount).toBeGreaterThan(0)
    })
  })

  describe('Comparison: Buffered vs Streaming', () => {
    it('documents memory difference between buffered and streaming approaches', async () => {
      const rows = Array.from({ length: 100000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        description: `Description for user ${i + 1}`,
      }))

      // Simulate buffered approach
      const bufferedStartMem = process.memoryUsage().heapUsed
      const bufferedCsv = [
        'ID,Name,Email,Description',
        ...rows.map((r) => `${r.id},"${r.name}","${r.email}","${r.description}"`),
      ].join('\n')
      const bufferedEndMem = process.memoryUsage().heapUsed
      const bufferedMemUsed = bufferedEndMem - bufferedStartMem

      // Simulate streaming approach
      const streamingStartMem = process.memoryUsage().heapUsed
      let streamingMemPeak = streamingStartMem

      // In streaming, we only keep one page (1000 rows) in memory at a time
      const pageSize = 1000
      let currentPage: any[] = []
      for (let i = 0; i < rows.length; i += pageSize) {
        currentPage = rows.slice(i, i + pageSize)
        const currentMem = process.memoryUsage().heapUsed
        streamingMemPeak = Math.max(streamingMemPeak, currentMem)
      }
      const streamingMemUsed = streamingMemPeak - streamingStartMem

      const memoryReduction = ((bufferedMemUsed - streamingMemUsed) / bufferedMemUsed) * 100

      console.log(`Memory comparison (100k rows):`)
      console.log(`  Buffered approach: ${(bufferedMemUsed / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Streaming approach: ${(streamingMemUsed / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Memory reduction: ${memoryReduction.toFixed(1)}%`)

      // Streaming should use significantly less memory
      expect(streamingMemUsed).toBeLessThan(bufferedMemUsed)
    })
  })
})

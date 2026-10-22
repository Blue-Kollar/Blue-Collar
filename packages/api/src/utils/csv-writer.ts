/**
 * Streaming CSV writer utility for large exports.
 *
 * Provides a simple API for writing CSV rows to an Express response stream
 * without loading the entire dataset into memory. Handles RFC-4180 compliant
 * CSV escaping and proper HTTP headers.
 *
 * Issue #1641: Stream large CSV exports without exhausting memory.
 */

import type { Response } from 'express'

/**
 * RFC-4180 CSV field escaping.
 * Wraps fields in double-quotes when they contain commas, quotes, or newlines.
 * Double-quotes within fields are escaped as two consecutive quotes ("").
 *
 * @param value The field value to escape
 * @returns The escaped field value
 */
export function escapeCsvField(value: unknown): string {
  const str = value == null ? '' : String(value)

  // No escaping needed if field doesn't contain special characters
  if (!str.includes(',') && !str.includes('"') && !str.includes('\n')) {
    return str
  }

  // Escape internal quotes and wrap in double-quotes
  return `"${str.replace(/"/g, '""')}"`
}

/**
 * Streaming CSV writer for Express responses.
 *
 * Handles:
 * - Setting proper HTTP headers
 * - Writing header row
 * - Writing data rows incrementally
 * - Proper CSV escaping per RFC-4180
 * - Error handling and backpressure
 *
 * @example
 * const writer = new CsvWriter(res, 'export.csv')
 * await writer.writeHeader(['Name', 'Email', 'Age'])
 * for (const row of users) {
 *   await writer.writeRow([row.name, row.email, row.age])
 * }
 * await writer.end()
 */
export class CsvWriter {
  private response: Response
  private filename: string
  private headerWritten = false
  private rowCount = 0

  constructor(response: Response, filename: string) {
    this.response = response
    this.filename = filename
  }

  /**
   * Initialize the response stream and set HTTP headers.
   * Must be called before writing any content.
   *
   * Sets:
   * - Content-Type: text/csv
   * - Content-Disposition: attachment with filename
   * - Cache-Control: no-cache (prevent browser caching of downloads)
   */
  initialize(): void {
    this.response.setHeader('Content-Type', 'text/csv; charset=utf-8')
    this.response.setHeader('Content-Disposition', `attachment; filename="${this.filename}"`)
    this.response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    this.response.setHeader('Pragma', 'no-cache')
    this.response.setHeader('Expires', '0')
  }

  /**
   * Write the CSV header row.
   * Must be called before any data rows.
   *
   * @param headers Array of column names
   * @returns Promise that resolves when the header is written
   * @throws If headers have already been written
   */
  async writeHeader(headers: string[]): Promise<void> {
    if (this.headerWritten) {
      throw new Error('Header has already been written')
    }

    const headerLine = headers.map(escapeCsvField).join(',') + '\n'
    return this.writeLine(headerLine)
  }

  /**
   * Write a data row to the CSV.
   * Must be called after writeHeader().
   *
   * @param fields Array of field values (automatically escaped)
   * @returns Promise that resolves when the row is written
   * @throws If header has not been written yet
   */
  async writeRow(fields: unknown[]): Promise<void> {
    if (!this.headerWritten) {
      throw new Error('Header must be written before data rows')
    }

    const rowLine = fields.map(escapeCsvField).join(',') + '\n'
    this.rowCount++
    return this.writeLine(rowLine)
  }

  /**
   * Finish writing and close the stream.
   * Can be called multiple times safely.
   *
   * @returns Promise that resolves when the stream is closed
   */
  async end(): Promise<void> {
    return new Promise((resolve) => {
      // If response is already finished, resolve immediately
      if (this.response.writableEnded) {
        resolve()
        return
      }

      // End the response stream
      this.response.end(() => {
        resolve()
      })
    })
  }

  /**
   * Get the number of data rows written (excluding header).
   *
   * @returns Number of rows written
   */
  getRowCount(): number {
    return this.rowCount
  }

  /**
   * Internal method to write a line to the stream.
   * Handles backpressure by pausing/resuming appropriately.
   *
   * @private
   * @param line The line to write (including newline)
   * @returns Promise that resolves when the line is written
   */
  private writeLine(line: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const canContinue = this.response.write(line, 'utf-8', (err) => {
        if (err) reject(err)
      })

      if (!this.headerWritten && line.includes('\n')) {
        this.headerWritten = true
      }

      if (canContinue) {
        resolve()
      } else {
        // Backpressure: wait for drain event before continuing
        this.response.once('drain', resolve)
      }
    })
  }
}

/**
 * Helper to stream an array of objects as CSV.
 * Useful for simpler use cases where all data fits in an array.
 *
 * @param response Express response object
 * @param filename Download filename
 * @param headers Column names (in order)
 * @param rows Array of data objects
 * @param keyMap Function to extract field values from each row
 *
 * @example
 * const rows = [
 *   { name: 'John', email: 'john@example.com' },
 *   { name: 'Jane', email: 'jane@example.com' }
 * ]
 * await streamCsvArray(
 *   res,
 *   'users.csv',
 *   ['Name', 'Email'],
 *   rows,
 *   (row) => [row.name, row.email]
 * )
 */
export async function streamCsvArray<T>(
  response: Response,
  filename: string,
  headers: string[],
  rows: T[],
  keyMap: (row: T) => unknown[]
): Promise<number> {
  const writer = new CsvWriter(response, filename)
  writer.initialize()

  await writer.writeHeader(headers)

  for (const row of rows) {
    await writer.writeRow(keyMap(row))
  }

  await writer.end()
  return writer.getRowCount()
}

/**
 * Helper to stream paginated data from a database.
 * Fetches data in chunks and streams directly without buffering.
 *
 * @param response Express response object
 * @param filename Download filename
 * @param headers Column names (in order)
 * @param fetcher Async function that fetches a page of data
 * @param pageSize Number of rows to fetch per page
 * @param keyMap Function to extract field values from each row
 *
 * @example
 * await streamCsvPaginated(
 *   res,
 *   'workers.csv',
 *   ['Name', 'Email', 'Category'],
 *   async (skip) => db.worker.findMany({ skip, take: 1000, include: { category: true } }),
 *   1000,
 *   (w) => [w.name, w.email, w.category.name]
 * )
 */
export async function streamCsvPaginated<T>(
  response: Response,
  filename: string,
  headers: string[],
  fetcher: (skip: number) => Promise<T[]>,
  pageSize: number,
  keyMap: (row: T) => unknown[]
): Promise<number> {
  const writer = new CsvWriter(response, filename)
  writer.initialize()

  await writer.writeHeader(headers)

  let skip = 0
  let hasMore = true

  while (hasMore) {
    const page = await fetcher(skip)

    if (page.length === 0) {
      hasMore = false
      break
    }

    for (const row of page) {
      await writer.writeRow(keyMap(row))
    }

    if (page.length < pageSize) {
      hasMore = false
    } else {
      skip += pageSize
    }
  }

  await writer.end()
  return writer.getRowCount()
}

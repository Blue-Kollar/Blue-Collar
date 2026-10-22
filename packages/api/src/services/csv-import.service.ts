import { db } from '@/db.js'

export interface CsvWorkerRow {
  name: string
  bio?: string
  phone?: string
  email?: string
  categoryId: string
  walletAddress?: string
}

export interface ImportResult {
  imported: number
  failed: number
  errors: Array<{ row: number; reason: string }>
}

const REQUIRED_HEADERS = ['name', 'categoryId'] as const

/**
 * Parse a CSV string into rows. Handles quoted fields.
 */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim()); current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = parseRow(lines[0]).map(h => h.toLowerCase())
  const rows = lines.slice(1).map(parseRow)
  return { headers, rows }
}

/**
 * Validate and import workers from CSV content.
 * Uses a transaction for batch insert; invalid rows are skipped and reported.
 */
export async function importWorkersFromCsv(csvText: string, curatorId: string): Promise<ImportResult> {
  const { headers, rows } = parseCsv(csvText)

  // Validate headers
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(`Missing required CSV column: "${required}"`)
    }
  }

  const idx = (col: string) => headers.indexOf(col)

  const errors: ImportResult['errors'] = []
  const validRows: CsvWorkerRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed, +1 for header

    const name = row[idx('name')]?.trim()
    const categoryId = row[idx('categoryid')]?.trim()

    if (!name) { errors.push({ row: rowNum, reason: 'name is required' }); continue }
    if (!categoryId) { errors.push({ row: rowNum, reason: 'categoryId is required' }); continue }

    validRows.push({
      name,
      categoryId,
      bio: idx('bio') >= 0 ? row[idx('bio')]?.trim() || undefined : undefined,
      phone: idx('phone') >= 0 ? row[idx('phone')]?.trim() || undefined : undefined,
      email: idx('email') >= 0 ? row[idx('email')]?.trim() || undefined : undefined,
      walletAddress: idx('walletaddress') >= 0 ? row[idx('walletaddress')]?.trim() || undefined : undefined,
    })
  }

  if (validRows.length === 0) {
    return { imported: 0, failed: errors.length, errors }
  }

  // Validate categoryIds exist
  const categoryIds = [...new Set(validRows.map(r => r.categoryId))]
  const existingCategories = await db.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  })
  const validCategoryIds = new Set(existingCategories.map(c => c.id))

  const toInsert: CsvWorkerRow[] = []
  for (const row of validRows) {
    if (!validCategoryIds.has(row.categoryId)) {
      const rowNum = validRows.indexOf(row) + 2
      errors.push({ row: rowNum, reason: `categoryId "${row.categoryId}" does not exist` })
    } else {
      toInsert.push(row)
    }
  }

  if (toInsert.length === 0) {
    return { imported: 0, failed: errors.length, errors }
  }

  // Batch insert in a transaction
  await db.$transaction(
    toInsert.map(row =>
      db.worker.create({
        data: {
          name: row.name,
          bio: row.bio,
          phone: row.phone,
          email: row.email,
          walletAddress: row.walletAddress,
          categoryId: row.categoryId,
          curatorId,
        },
      })
    )
  )

  return { imported: toInsert.length, failed: errors.length, errors }
}

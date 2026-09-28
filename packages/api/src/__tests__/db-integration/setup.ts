/**
 * db-integration/setup.ts — Database integration test setup
 *
 * Runs before every test suite in the db-integration directory.
 *
 * 1. Resolves TEST_DATABASE_URL (preferred) or DATABASE_URL.
 * 2. Applies Prisma migrations to ensure schema is current.
 * 3. Cleans all tables before each test (FK-safe order).
 * 4. Disconnects Prisma after all tests complete.
 *
 * IMPORTANT: This setup MUST NOT point at a development or production database.
 * Always set TEST_DATABASE_URL to a dedicated test database.
 */
import { beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'
import dotenv from 'dotenv'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

// ── Validate test database URL ─────────────────────────────────────────────────

const testDbUrl = process.env.TEST_DATABASE_URL
const baseDbUrl = process.env.DATABASE_URL

const isValidPostgresUrl = (value?: string) => {
  if (!value) return false
  try {
    const protocol = new URL(value).protocol
    return protocol === 'postgres:' || protocol === 'postgresql:'
  } catch {
    return false
  }
}

if (!isValidPostgresUrl(testDbUrl) && !isValidPostgresUrl(baseDbUrl)) {
  throw new Error(
    'Database integration tests require a valid PostgreSQL URL.\n' +
      'Set TEST_DATABASE_URL (preferred) or DATABASE_URL in your .env file.\n' +
      'Example: TEST_DATABASE_URL=postgresql://user:password@localhost:5432/bluecollar_test',
  )
}

process.env.DATABASE_URL = isValidPostgresUrl(testDbUrl) ? testDbUrl : baseDbUrl
process.env.NODE_ENV = 'test'

// ── Prisma client ─────────────────────────────────────────────────────────────

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  transactionOptions: {
    maxWait: 15_000,
    timeout: 30_000,
  },
})

// ── Lifecycle hooks ────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Apply pending migrations to ensure schema is current
  try {
    execSync('pnpm exec prisma migrate deploy', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
  } catch {
    // If migrations fail, try to continue — schema might already be applied
    console.warn('Warning: prisma migrate deploy failed. Schema may already be applied.')
  }
})

beforeEach(async () => {
  // Clean all tables in FK-safe order (dependents before parents)
  const tables = [
    'ReviewHelpful',
    'Review',
    'Bookmark',
    'JobApplication',
    'JobMessage',
    'Job',
    'Worker',
    'User',
    'Category',
    'Location',
  ]

  for (const table of tables) {
    try {
      await db.$executeRawUnsafe(`DELETE FROM "${table}"`)
    } catch {
      // Table might not exist yet — ignore
    }
  }
})

afterAll(async () => {
  await db.$disconnect()
})

// ── Export for tests ───────────────────────────────────────────────────────────

export { db }
export const TEST_DB_URL = process.env.DATABASE_URL

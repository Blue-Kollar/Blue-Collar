/**
 * db.ts — #836: Connection pooling & read-replica readiness
 *
 * Exports:
 *   db          — write-capable Prisma client (primary / read-write)
 *   readDb      — read-only Prisma client (read replica when configured,
 *                 falls back to the primary DATABASE_URL transparently)
 *   getDb(mode) — convenience helper that returns db or readDb
 *
 * Connection limits:
 *   Primary     pool max default: 10 (override via DB_POOL_SIZE)
 *   Read replica pool max default: 20 (more connections for read-heavy
 *                traffic; override via DB_READ_POOL_SIZE)
 *
 * PgBouncer compatibility:
 *   When using PgBouncer in transaction mode set:
 *     DATABASE_URL="...?pgbouncer=true&connection_limit=1"
 *     DB_POOL_SIZE=1
 *   (Docs: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management/configure-connection-pool#pgbouncer)
 *
 * Environment variables:
 *   DATABASE_URL       — primary (read-write) connection string  [required]
 *   DATABASE_READ_URL  — read-replica connection string          [optional]
 *   DB_POOL_SIZE       — max connections for primary  (default: 10)
 *   DB_READ_POOL_SIZE  — max connections for replica  (default: 20)
 */

import dotenv from 'dotenv'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Explicitly load env from the api package directory so this file can also be
// run standalone (e.g. `tsx src/db.ts` for quick debugging).
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

// ── Validation ────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

// ── Pool sizes ────────────────────────────────────────────────────────────────

/** Max connections for the primary (write) pool. */
const DB_POOL_SIZE = parseInt(process.env.DB_POOL_SIZE ?? '10', 10)

/** Max connections for the read-replica pool (can be larger for read-heavy workloads). */
const DB_READ_POOL_SIZE = parseInt(process.env.DB_READ_POOL_SIZE ?? '20', 10)

// ── Shared Prisma transaction options ─────────────────────────────────────────

const BASE_TRANSACTION_OPTIONS = {
  maxWait: 15_000, // ms to wait for a connection from the pool before failing
  timeout:  30_000, // ms before a transaction is automatically rolled back
} as const

// ── Primary (read-write) client ───────────────────────────────────────────────

/**
 * Primary Prisma client — all writes MUST go through this client.
 *
 * The underlying pg.Pool is configured with DB_POOL_SIZE connections.
 * In production behind PgBouncer, set DB_POOL_SIZE=1 and let PgBouncer
 * manage the actual server-side connection pool.
 */
export const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: DB_POOL_SIZE,
  }),
  transactionOptions: BASE_TRANSACTION_OPTIONS,
})

// ── Read-replica client ───────────────────────────────────────────────────────

/**
 * Read-only Prisma client.
 *
 * When DATABASE_READ_URL is configured this connects to the read replica.
 * Otherwise it silently falls back to the primary — no code changes needed
 * when a replica is added later (just set the env var).
 *
 * Callers MUST NOT issue writes against this client.  The naming convention
 * enforces intent at the call site: `readDb.worker.findMany(...)`.
 *
 * Replica pool is sized separately (DB_READ_POOL_SIZE, default 20) because
 * read-heavy workloads typically need more connections than the write path.
 */
export const readDb = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_READ_URL ?? process.env.DATABASE_URL,
    max: DB_READ_POOL_SIZE,
  }),
  transactionOptions: BASE_TRANSACTION_OPTIONS,
})

// ── Convenience accessor ──────────────────────────────────────────────────────

export type DbMode = 'read' | 'write'

/**
 * Returns the appropriate Prisma client for the operation mode.
 *
 * @example
 * import { getDb } from '../db.js'
 *
 * // Read path — routed to replica when DATABASE_READ_URL is set
 * const workers = await getDb('read').worker.findMany({ where: { isActive: true } })
 *
 * // Write path — always goes to primary
 * const worker = await getDb('write').worker.create({ data: { ... } })
 */
export function getDb(mode: DbMode = 'write'): PrismaClient {
  return mode === 'read' ? readDb : db
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

/**
 * Disconnect both pool clients cleanly on SIGTERM / SIGINT.
 * Should be called by the process manager (PM2, Kubernetes lifecycle hook, etc.).
 */
export async function disconnectDb(): Promise<void> {
  await Promise.all([db.$disconnect(), readDb.$disconnect()])
}

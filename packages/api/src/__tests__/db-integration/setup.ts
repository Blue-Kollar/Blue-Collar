/**
 * db-integration/setup.ts — Database integration test setup
 *
 * Runs before every test suite in the db-integration directory.
 *
 * 1. Resolves TEST_DATABASE_URL (preferred) or DATABASE_URL.
 * 2. Applies Prisma migrations to ensure schema is current.
 * 3. Serialised baseline reset of known tables (advisory lock).
 * 4. Wraps every test in a transaction that is always rolled back (#1871).
 * 5. Disconnects Prisma after all tests complete.
 *
 * The exported `db` is a routing proxy: model calls made during a test go to
 * the active transaction client, so existing tests need no changes and no test
 * can commit rows. See ../helpers/db-isolation.ts for the full strategy.
 *
 * IMPORTANT: This setup MUST NOT point at a development or production database.
 * Always set TEST_DATABASE_URL to a dedicated test database.
 */
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DbIsolation, type IsolationClient, resolveWorkerId } from '../helpers/db-isolation.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ── Validate test database URL ─────────────────────────────────────────────────

const testDbUrl = process.env.TEST_DATABASE_URL;
const baseDbUrl = process.env.DATABASE_URL;

const isValidPostgresUrl = (value?: string) => {
  if (!value) return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'postgres:' || protocol === 'postgresql:';
  } catch {
    return false;
  }
};

if (!isValidPostgresUrl(testDbUrl) && !isValidPostgresUrl(baseDbUrl)) {
  throw new Error(
    'Database integration tests require a valid PostgreSQL URL.\n' +
      'Set TEST_DATABASE_URL (preferred) or DATABASE_URL in your .env file.\n' +
      'Example: TEST_DATABASE_URL=postgresql://user:password@localhost:5432/bluecollar_test',
  );
}

process.env.DATABASE_URL = isValidPostgresUrl(testDbUrl) ? testDbUrl : baseDbUrl;
process.env.NODE_ENV = 'test';

// ── Prisma client ─────────────────────────────────────────────────────────────

const baseDb = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  transactionOptions: {
    maxWait: 15_000,
    timeout: 30_000,
  },
});

const isolation = new DbIsolation(baseDb as unknown as IsolationClient, {
  workerId: resolveWorkerId(),
});

// Tests import this proxy exactly as before; per-test writes stay uncommitted.
const db = isolation.createRoutingClient(baseDb);

// ── Lifecycle hooks ────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Apply pending migrations to ensure schema is current
  try {
    execSync('pnpm exec prisma migrate deploy', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch {
    // If migrations fail, try to continue — schema might already be applied
    console.warn('Warning: prisma migrate deploy failed. Schema may already be applied.');
  }

  // One advisory-lock-serialised reset per worker, before any test data exists.
  await isolation.reset();
});

// Every test begins inside its own transaction and is rolled back afterwards.
isolation.registerHooks({ beforeEach, afterEach });

afterAll(async () => {
  await baseDb.$disconnect();
});

// ── Export for tests ───────────────────────────────────────────────────────────

export { db, isolation };
export const TEST_DB_URL = process.env.DATABASE_URL;

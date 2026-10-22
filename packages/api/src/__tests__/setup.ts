import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../db.js';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/bluecollar_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1';
process.env.APP_URL = 'http://localhost:3000';

// ─── Stellar / Horizon network guard ─────────────────────────────────────────
//
// Point HORIZON_URL at a non-routable address so any test that accidentally
// skips the MockStellarRpcServer (or forgets vi.stubGlobal) fails fast with a
// connection error instead of silently hitting the live testnet.
//
// Individual tests that need real-looking Horizon responses must install
// MockStellarRpcServer (packages/api/src/clients/mockStellarRpcServer.ts)
// or vi.stubGlobal('fetch', ...) themselves — the guard does not block those.
if (!process.env.HORIZON_URL) {
  process.env.HORIZON_URL = 'http://127.0.0.1:0'; // port 0 is always refused
}

// Prisma is only used for integration/e2e tests that have a real DB.
// Unit tests mock the DB, so we use the centralized client lazily and swallow
// connection errors so the suite doesn't crash in environments without a DB.
let prisma = db;

// ─── Test isolation ──────────────────────────────────────────────────────────
//
// Flakiness in this suite came from shared/mutable state leaking between tests:
//   * rows left behind by a previous test (non-isolated DB fixtures)
//   * mock call history / implementations bleeding across tests
//   * module-level singletons (e.g. cached clients) retaining state
//
// We fix this by (a) truncating every known table before each test so each test
// starts from a clean DB, (b) resetting mock state (not just clearing calls) so
// implementations and return values don't leak, and (c) restoring any globals
// stubbed via vi.stubGlobal so a test that forgets to unstub can't poison the
// next one.
const TABLES = [
  'Booking',
  'Review',
  'Message',
  'Notification',
  'Job',
  'Worker',
  'Location',
  'User',
];

async function truncateAllTables(): Promise<void> {
  if (!prisma) return;
  for (const table of TABLES) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch {
      // Table might not exist (unit-test env without a DB) — ignore.
    }
  }
}

beforeAll(async () => {
  // No need to connect — db is already connected
  try {
    console.log('Test database using centralized connection');
  } catch {
    // No DB available — unit tests that mock the DB will still run fine
  }
});

afterAll(async () => {
  // No need to disconnect — lifecycle managed by db module
});

beforeEach(async () => {
  // Fresh DB state for every test so fixtures from a prior test can't leak.
  await truncateAllTables();
});

afterEach(() => {
  // Reset (not just clear) so mock implementations/return values don't bleed
  // into the next test, and restore any globals stubbed via vi.stubGlobal.
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

export { prisma };

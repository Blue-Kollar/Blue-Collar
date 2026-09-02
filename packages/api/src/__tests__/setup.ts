import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

import { db } from '../db.js';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/bluecollar_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1';
process.env.APP_URL = 'http://localhost:3000';

// Prisma is only used for integration/e2e tests that have a real DB.
// Unit tests mock the DB, so we use the centralized client lazily and swallow
// connection errors so the suite doesn't crash in environments without a DB.
let prisma = db;

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
  if (!prisma) return;
  const tables = ['Booking', 'Review', 'Message', 'Notification', 'Job', 'Worker', 'Location', 'User'];
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch {
      // Table might not exist, ignore
    }
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

export { prisma };

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/bluecollar_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1';
process.env.APP_URL = 'http://localhost:3000';

// Prisma is only used for integration/e2e tests that have a real DB.
// Unit tests mock the DB, so we create the client lazily and swallow
// connection errors so the suite doesn't crash in environments without a DB.
let prisma: PrismaClient;
try {
  prisma = new PrismaClient();
} catch {
  prisma = null as unknown as PrismaClient;
}

beforeAll(async () => {
  if (!prisma) return;
  try {
    await prisma.$connect();
    console.log('Test database connected');
  } catch {
    // No DB available — unit tests that mock the DB will still run fine
  }
});

afterAll(async () => {
  if (!prisma) return;
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
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

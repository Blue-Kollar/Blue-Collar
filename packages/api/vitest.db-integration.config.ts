/**
 * vitest.db-integration.config.ts — packages/api
 *
 * Configuration for real-database integration tests.
 *
 * Usage:
 *   pnpm test:integration:db
 *
 * Requires a running PostgreSQL instance with the test schema applied.
 * Set TEST_DATABASE_URL or DATABASE_URL to point at the test database.
 *
 * These tests exercise actual Prisma operations against a real database
 * engine — no mocking of the database layer.
 *
 * Covers:
 *   - #1813 query performance / index integration tests
 *   - #1814 multi-step write transaction & rollback tests
 *   - #1815 repository layer integration tests
 */
import { defineConfig } from 'vitest/config';

// Ensure the test database env vars are set before any test module loads.
// Prefer TEST_DATABASE_URL; fall back to DATABASE_URL when only that is provided.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'vitest.db-integration.config.ts: TEST_DATABASE_URL or DATABASE_URL must be set ' +
      'to run database integration tests.',
  );
}

// Normalize so downstream code (Prisma client, setup files) reads a consistent value.
process.env.TEST_DATABASE_URL = testDatabaseUrl;
process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/__tests__/db-integration/**/*.test.ts',
      // #1814 — transaction & rollback integration tests
      'src/__tests__/db-integration/transactions/**/*.test.ts',
      // #1815 — repository layer integration tests
      'src/__tests__/db-integration/repositories/**/*.test.ts',
      // #1813 — query performance / index integration tests
      'src/__tests__/db-integration/performance/**/*.test.ts',
    ],
    setupFiles: ['src/__tests__/db-integration/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run DB integration tests serially to avoid cross-test interference
    // on shared tables and to keep transaction/rollback assertions deterministic.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    env: {
      TEST_DATABASE_URL: testDatabaseUrl,
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: process.env.NODE_ENV ?? 'test',
    },
  },
});

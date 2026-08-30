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
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/db-integration/**/*.test.ts'],
    setupFiles: ['src/__tests__/db-integration/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})

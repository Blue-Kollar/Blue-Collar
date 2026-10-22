/**
 * vitest.config.ts — packages/test-utils
 *
 * The shared test utilities previously had no test runner of their own, so the
 * fixture/factory helpers were only exercised transitively.  Adding a runner
 * here gives the package first-class coverage and proves the shared helpers
 * behave deterministically (issue #1276 / #1278).
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
})

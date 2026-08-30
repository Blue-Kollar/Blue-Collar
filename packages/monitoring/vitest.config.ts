/**
 * vitest.config.ts — packages/monitoring
 *
 * Issue #1277 — Add test coverage for packages/monitoring alert rule logic.
 *
 * The alert engine (src/alerts.ts) is pure TypeScript with no framework
 * dependencies, so it runs in the plain Node environment.  Coverage thresholds
 * are enforced at 85%+ across lines, functions, branches and statements to
 * match the repository-wide standard (issue #1055).
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
      include: ['src/alerts.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'src/index.ts', 'src/monitor.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
})

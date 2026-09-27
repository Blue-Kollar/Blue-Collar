/**
 * vitest.config.ts — packages/api
 *
 * Coverage thresholds enforced at 85 %+ (issue #1055).
 * Failing to meet a threshold causes the test run to exit non-zero, preventing
 * silent regressions in CI.
 *
 * Exceptions:
 *  - branches: 80 % (lower bound retained because several middleware branches
 *    are conditional on runtime env flags not exercisable in unit tests without
 *    a live DB; see docs/TESTING_COVERAGE.md for rationale).
 *  - src/database/** and src/commands/** are excluded — these are migration /
 *    seed scripts with no unit-testable logic; coverage is validated via e2e.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    exclude: ['src/**/*.e2e.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**', 'src/utils/**', 'src/controllers/**', 'src/middleware/**'],
      exclude: [
        'src/database/**',
        'src/commands/**',
        'src/index.ts',
        'src/config/**',
        '**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/__tests__/**',
      ],
      // ── Thresholds (issue #1055) ──────────────────────────────────────────
      // Enforce 85 %+ across lines, functions, and statements.
      // Branches are set at 80 % — see file header for rationale.
      // The 'perFile: false' default means the threshold applies to the
      // aggregate; per-file thresholds would be too noisy at this stage.
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
})

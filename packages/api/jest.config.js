/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // ── Coverage thresholds (issue #1867) ────────────────────────────────────
  // Enforce 85% line coverage across all metrics. The threshold applies both
  // globally and per-critical-module to prevent regressions in core layers.
  // Branches are set at 80% to accommodate conditional env flag checks that
  // are not fully exercisable in unit tests without a live database.
  coverageThreshold: {
    global: {
      lines: 85,
      functions: 85,
      statements: 85,
      branches: 80,
    },
    './src/services/': {
      lines: 85,
      functions: 85,
      statements: 85,
      branches: 80,
    },
    './src/controllers/': {
      lines: 85,
      functions: 85,
      statements: 85,
      branches: 80,
    },
    './src/repositories/': {
      lines: 85,
      functions: 85,
      statements: 85,
      branches: 80,
    },
  },
};

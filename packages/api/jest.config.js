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
  // 85% line-coverage target with per-module reporting for the
  // services, controllers, and repositories layers.
  coverageThreshold: {
    global: {
      lines: 85,
    },
    './src/services/': {
      lines: 85,
    },
    './src/controllers/': {
      lines: 85,
    },
    './src/repositories/': {
      lines: 85,
    },
  },
};

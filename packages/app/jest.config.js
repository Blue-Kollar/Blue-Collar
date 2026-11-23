module.exports = {
  displayName: 'app',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/packages/app',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    'src/routes.ts',
    'src/**/routes.ts',
    'src/logger.ts',
    'src/**/logger.ts',
    'src/tx-status-map.ts',
    'src/**/tx-status-map.ts',
    'src/**/TxStatus*.{ts,tsx}',
    'src/**/tx-status/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx,js,jsx}',
    '!src/**/*.test.{ts,tsx,js,jsx}',
    '!src/**/*.spec.{ts,tsx,js,jsx}',
    '!src/**/index.{ts,tsx,js,jsx}',
    '!src/test-setup.ts',
  ],
  // ── Coverage thresholds (issue #1867) ────────────────────────────────────
  // Enforce 85% coverage across lines, functions, and statements. Branches
  // are set at 80% to accommodate conditional rendering in React components
  // (loading/error/empty states) that are tested indirectly through component
  // integration but not as isolated unit-test branches.
  coverageThreshold: {
    global: {
      lines: 85,
      functions: 85,
      statements: 85,
      branches: 80,
    },
  },
};

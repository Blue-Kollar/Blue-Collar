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
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx,js,jsx}',
    '!src/**/*.test.{ts,tsx,js,jsx}',
    '!src/**/*.spec.{ts,tsx,js,jsx}',
    '!src/**/index.{ts,tsx,js,jsx}',
    '!src/test-setup.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 85,
    },
  },
};

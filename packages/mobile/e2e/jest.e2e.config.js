/**
 * Jest configuration for mobile E2E test suite.
 *
 * Mobile E2E tests use the same jest-expo preset as unit tests but
 * with relaxed timeouts and separate output paths.  They are excluded
 * from the regular unit-test run via `testPathIgnorePatterns` in
 * the root jest config and are invoked explicitly via:
 *
 *   pnpm --filter @bluecollar/mobile test:e2e
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.e2e.{ts,tsx}'],
  testTimeout: 30_000,
  setupFilesAfterFramework: ['<rootDir>/../jest.setup.ts'],
  fakeTimers: { enableGlobally: false },
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm|(jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
  },
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '<rootDir>/e2e-results', outputName: 'e2e-junit.xml' }],
  ],
  coverageDirectory: '<rootDir>/e2e-coverage',
}

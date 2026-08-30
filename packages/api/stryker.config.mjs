// @ts-check
/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  plugins: ['@stryker-mutator/vitest-runner'],
  reporters: ['html', 'clear-text', 'progress', 'json'],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.mutation.config.ts',
  },
  coverageAnalysis: 'perTest',
  // Target ONLY the critical fee / financial calculation logic.
  // `payment.service.ts` is the single source of truth for fee, tip, escrow
  // and multi-sig-escrow money math in the API. The full repository (and the
  // analytics date helpers) are intentionally excluded to keep mutation runs
  // fast and focused on money-correctness.
  mutate: ['src/services/payment.service.ts'],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  timeoutMS: 30000,
  concurrency: 2,
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
};

export default config;

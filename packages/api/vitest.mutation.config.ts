/**
 * vitest.mutation.config.ts — packages/api
 *
 * Dedicated vitest config used ONLY by Stryker mutation testing
 * (see stryker.config.mjs). It deliberately narrows the test run to the pure
 * unit tests that exercise the critical fee / financial calculation logic
 * (payment.service.ts and analytics/shared.ts). Those tests are fully isolated
 * from the database / Redis, so the mutation baseline is green without any
 * external services. The full API suite (which needs a live DB) is excluded.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/services/payment.service.test.ts',
      'src/__tests__/payment.edge.test.ts',
      'src/services/payment.service.fee-calc.test.ts',
      'src/services/payment.service.error-messages.test.ts',
    ],
  },
});

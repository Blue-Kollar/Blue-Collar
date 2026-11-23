/**
 * vitest.config.ts — packages/app
 *
 * Coverage thresholds enforced at 85 %+ (issues #1055, #1449).
 *
 * Exceptions:
 *  - branches: 80 % — many conditional branches in React components are
 *    loading/error/empty states that are tested indirectly through component
 *    integration but not as isolated unit-test branches.
 *  - src/app/** excluded — Next.js App Router pages/layouts; these are
 *    covered by Playwright e2e tests, not Vitest unit tests.
 *
 * Flake hardening (issue #1454):
 *  - `testTimeout` / `hookTimeout` are raised from Vitest's 5 s default so
 *    async tests that await real timers (debounce, polling, transitions) are
 *    not cut off mid-flight on loaded CI runners. This is a deterministic
 *    ceiling, not a retry — a genuinely hanging test still fails.
 *  - `sequence.shuffle` is enabled so tests that only pass because of
 *    execution order (shared module state, leaked timers) surface as failures
 *    instead of intermittent flakes.
 *  - `restoreMocks` / `clearMocks` reset spies and mock state between tests so
 *    a mock configured in one test cannot leak into the next.
 *  - `unstubGlobals` restores globals stubbed via `vi.stubGlobal` (e.g. fetch,
 *    matchMedia) so network/timer stubs do not bleed across files.
 *
 * Accessibility (issue #1790):
 *  - `vitest-axe` matchers are registered in the shared setup file so
 *    component tests can assert `toHaveNoViolations()` on rendered output.
 *  - `deps.inline` includes `vitest-axe` (and its `axe-core` dependency) so
 *    the matcher package is transformed by Vite rather than externalized,
 *    which is required for it to work under the jsdom environment.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // setup.ts registers jest-dom + vitest-axe matchers (issue #1790).
    setupFiles: ['./src/__tests__/setup.ts'],
    // Transform vitest-axe/axe-core so a11y matchers work in jsdom.
    deps: {
      inline: ['vitest-axe', 'axe-core'],
    },
    // Only unit tests live under src/. e2e/ and visual/ are Playwright suites
    // run by `pnpm test:e2e`; picking them up here makes vitest fail on
    // Playwright-only globals.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Disable PostCSS/Tailwind processing in tests — CSS not needed for unit tests
    // and avoids native-binding failures in CI environments without the Tailwind v4 binary.
    css: false,
    // ── Flake hardening (issue #1454) ───────────────────────────────────────
    // Deterministic timeouts instead of retries: slow async tests get room to
    // finish, but a truly stuck test still fails the run.
    testTimeout: 15000,
    hookTimeout: 15000,
    // Randomize order to expose order-dependent flakes (leaked state/timers).
    sequence: {
      shuffle: true,
    },
    // Reset mock/spy/global state between tests so one test cannot leak into
    // the next and cause intermittent failures.
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      // `json-summary` emits coverage/coverage-summary.json with per-directory
      // totals, enabling the baseline report and low-coverage directory audit
      // required by issue #1449.
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      // Explicitly include the centralized routing config (routes.ts), the
      // shared logger (logger.ts), the transaction status map (tx-status-map.ts)
      // and the split TxStatus components so they are held to the coverage
      // thresholds below (issues #1797, #1798, #1799, #1800).
      include: [
        'src/components/**',
        'src/hooks/**',
        'src/lib/**',
        'src/utils/**',
        'src/context/**',
        'src/routes.ts',
        'src/lib/logger.ts',
        'src/lib/tx-status-map.ts',
        'src/components/tx-status/**',
      ],
      exclude: [
        'src/app/**',
        '**/*.stories.tsx',
        '**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
      ],
      // ── Thresholds (issues #1055, #1449) ──────────────────────────────────
      // 85 % line-coverage target for packages/app.
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});

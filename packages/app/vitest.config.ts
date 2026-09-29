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
 * Baseline (issue #1449): the current line-coverage baseline for
 * `packages/app` is captured by running `pnpm test:coverage` and is reported
 * in the PR description rather than committed as a generated artifact.
 * Per-directory reporting is enabled below so low-coverage directories
 * (currently below 60 %) can be identified and tracked via follow-up issues.
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // Only unit tests live under src/. e2e/ and visual/ are Playwright suites
    // run by `pnpm test:e2e`; picking them up here makes vitest fail on
    // Playwright-only globals.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Disable PostCSS/Tailwind processing in tests — CSS not needed for unit tests
    // and avoids native-binding failures in CI environments without the Tailwind v4 binary.
    css: false,
    coverage: {
      provider: 'v8',
      // `json-summary` emits coverage/coverage-summary.json with per-directory
      // totals, enabling the baseline report and low-coverage directory audit
      // required by issue #1449.
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/components/**', 'src/hooks/**', 'src/lib/**', 'src/utils/**', 'src/context/**'],
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
})

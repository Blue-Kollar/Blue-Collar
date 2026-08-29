/**
 * vitest.config.ts — packages/app
 *
 * Coverage thresholds enforced at 85 %+ (issue #1055).
 *
 * Exceptions:
 *  - branches: 80 % — many conditional branches in React components are
 *    loading/error/empty states that are tested indirectly through component
 *    integration but not as isolated unit-test branches.
 *  - src/app/** excluded — Next.js App Router pages/layouts; these are
 *    covered by Playwright e2e tests, not Vitest unit tests.
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
      reporter: ['text', 'html'],
      include: ['src/components/**', 'src/hooks/**', 'src/lib/**', 'src/utils/**', 'src/context/**'],
      exclude: [
        'src/app/**',
        '**/*.stories.tsx',
        '**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
      ],
      // ── Thresholds (issue #1055) ──────────────────────────────────────────
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

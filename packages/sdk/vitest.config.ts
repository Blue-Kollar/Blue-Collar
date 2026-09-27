/**
 * vitest.config.ts — packages/sdk
 *
 * Coverage thresholds enforced at 85 %+ (issue #1055).
 *
 * The SDK is a pure TypeScript library with no framework dependencies.
 * All public API surface (HorizonClient, RegistryClient, SdkError, createSdk)
 * must maintain 85 %+ coverage. The node environment is used because the SDK
 * uses the native `fetch` API, which is available in Node 18+.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/types.ts',
        '**/*.d.ts',
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
})

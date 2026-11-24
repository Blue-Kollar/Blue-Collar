/**
 * vitest.config.ts — packages/sdk
 *
 * Coverage thresholds enforced at 90 %+ (issues #1055, #1874).
 *
 * The SDK is a pure TypeScript library with no framework dependencies.
 * All public API surface (HorizonClient, RegistryClient, SdkError, createSdk,
 * constants and utils) must maintain 90 %+ coverage. The node environment is
 * used because the SDK uses the native `fetch` API, available in Node 18+.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    // Blocks real network access so SDK tests run offline (issue #1599).
    setupFiles: ['./src/__tests__/setup/offline.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/types.ts', '**/*.d.ts'],
      // ── Thresholds (issues #1055, #1874) ──────────────────────────────────
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});

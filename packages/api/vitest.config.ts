import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./testSetup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
    include: ['src/__tests__/**/*.test.ts'],
  },
})

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./testSetup.ts'],
    coverage: {
      provider: 'v8',
    },
    include: ['src/__tests__/**/*.test.ts'],
  },
})

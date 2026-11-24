import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    typecheck: {
      enabled: true,
      include: ['src/__tests__/types.compile-time.test.ts'],
      checker: 'tsc',
    },
  },
})

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    typecheck: {
      enabled: true,
      include: ['src/__tests__/types.compile-time.test.ts'],
      checker: 'tsc',
    },
  },
});

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // Disable PostCSS/Tailwind processing in tests — CSS not needed for unit tests
    // and avoids native-binding failures in CI environments without the Tailwind v4 binary.
    css: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})

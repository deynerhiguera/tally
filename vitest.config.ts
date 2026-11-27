import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(import.meta.dirname, 'src/shared'),
      '@renderer': resolve(import.meta.dirname, 'src/renderer/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/shared/**', 'src/renderer/src/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/test-helpers.ts', '**/index.ts', '**/*.d.ts'],
      thresholds: {
        // Domain logic must stay fully tested.
        'src/shared/domain/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
})

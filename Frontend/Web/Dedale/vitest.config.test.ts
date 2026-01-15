import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        'src/vite-env.d.ts',
        'src-tauri/',
        'dist/',
        'coverage/',
        '**/*.config.*',
        '**/index.ts',
        '**/main.tsx'
      ],
      include: [
        'src/**/*.{js,jsx,ts,tsx}'
      ],
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    },
    // Test file patterns
    include: [
      'src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'
    ],
    // Mock patterns
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@services': resolve(__dirname, './src/services'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types')
    },
    // Test timeout
    testTimeout: 10000,
    // Reporters
    reporters: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results.json',
      html: './test-results.html'
    }
  }
})
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@/core': resolve(__dirname, './src/core'),
      '@/scrapers': resolve(__dirname, './src/scrapers'),
      '@/engine': resolve(__dirname, './src/engine'),
      '@/api': resolve(__dirname, './src/api'),
      '@/mcp': resolve(__dirname, './src/mcp'),
      '@/db': resolve(__dirname, './src/db'),
    },
  },
});

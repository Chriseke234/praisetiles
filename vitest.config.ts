import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    fileParallelism: false,
    // Use vmThreads pool to prevent per-file worker spawn timeout issues on
    // Windows with large test suites. poolOptions kept for Vitest 5 compat.
    pool: 'vmThreads',
    // Raise timeout for heavy modules (audio analyser, game engine, etc.)
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

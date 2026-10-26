import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  test: {
    include: ['tests/unit/**/*.test.js'],
    exclude: ['node_modules/**', '.worktrees/**'],
  },
});

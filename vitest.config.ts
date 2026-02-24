import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
    },
  },
  resolve: {
    alias: {
      // Temporary mock for 'open' package until pnpm install works
      open: path.resolve(__dirname, './tests/__mocks__/open.ts'),
      // Mock for @inquirer/prompts (not installable in test env)
      '@inquirer/prompts': path.resolve(__dirname, './tests/__mocks__/@inquirer/prompts.ts'),
    },
  },
});

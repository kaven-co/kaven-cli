import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      // Temporary mock for 'open' package until pnpm install works
      open: path.resolve(__dirname, './tests/__mocks__/open.ts'),
    },
  },
});

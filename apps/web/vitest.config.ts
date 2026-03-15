import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@trello-clone/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
    conditions: ['source', 'browser', 'module', 'import', 'default'],
  },
  test: {
    environment: 'jsdom',
  },
});

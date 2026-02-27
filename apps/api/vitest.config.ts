import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@trello-clone/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://localhost:5432/test_db',
      JWT_SECRET: 'test-jwt-secret-min-10-chars',
      JWT_REFRESH_SECRET: 'test-refresh-secret-min-10-chars',
    },
  },
});

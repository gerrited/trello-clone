import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://localhost:5432/test_db',
      JWT_SECRET: 'test-jwt-secret-min-10-chars',
      JWT_REFRESH_SECRET: 'test-refresh-secret-min-10-chars',
    },
  },
});

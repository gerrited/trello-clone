import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root (../../.. from src/config/)
config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  API_PORT: z.coerce.number().default(3001),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:3001'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  MICROSOFT_CLIENT_ID: z.string().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);

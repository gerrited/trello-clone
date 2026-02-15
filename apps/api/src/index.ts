import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pino } from 'pino';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import passport from 'passport';
import { setupPassport } from './modules/auth/passport.js';
import { authRoutes } from './modules/auth/auth.routes.js';

const logger = pino({ name: 'api' });
const app: Express = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

setupPassport();
app.use(passport.initialize());

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);

app.use(errorHandler);

app.listen(env.API_PORT, () => {
  logger.info(`API server running on port ${env.API_PORT}`);
});

export { app };

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { registerSchema, loginSchema } from '@trello-clone/shared';
import * as ctrl from './auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), ctrl.registerHandler);
router.post('/login', validate(loginSchema), ctrl.loginHandler);
router.post('/refresh', ctrl.refreshHandler);
router.post('/logout', ctrl.logoutHandler);
router.get('/me', requireAuth, ctrl.meHandler);

export { router as authRoutes };

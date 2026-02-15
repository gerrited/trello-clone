import { Router } from 'express';
import passport from 'passport';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { registerSchema, loginSchema } from '@trello-clone/shared';
import { env } from '../../config/env.js';
import * as ctrl from './auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), ctrl.registerHandler);
router.post('/login', validate(loginSchema), ctrl.loginHandler);
router.post('/refresh', ctrl.refreshHandler);
router.post('/logout', ctrl.logoutHandler);
router.get('/me', requireAuth, ctrl.meHandler);

// Google OAuth
router.get('/google', passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.WEB_URL}/login?error=google_auth_failed` }),
  (req, res) => {
    const { accessToken, refreshToken } = req.user as { accessToken: string; refreshToken: string };
    res.cookie(ctrl.REFRESH_TOKEN_COOKIE, refreshToken, ctrl.COOKIE_OPTIONS);
    res.redirect(`${env.WEB_URL}/auth/callback?token=${accessToken}`);
  },
);

export { router as authRoutes };

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { updateProfileSchema, changePasswordSchema } from '@trello-clone/shared';
import * as ctrl from './users.controller.js';

const router: RouterType = Router();

router.patch('/me', requireAuth, validate(updateProfileSchema), ctrl.updateProfileHandler);
router.patch('/me/password', requireAuth, validate(changePasswordSchema), ctrl.changePasswordHandler);

export { router as userRoutes };

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateQuery } from '../../middleware/validate.js';
import { searchSchema } from '@trello-clone/shared';
import * as ctrl from './search.controller.js';

const router: RouterType = Router();

router.use(requireAuth);
router.get('/', validateQuery(searchSchema), ctrl.searchHandler);

export { router as searchRoutes };

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { addAssigneeSchema } from '@trello-clone/shared';
import * as ctrl from './assignees.controller.js';

const router: RouterType = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ctrl.listHandler);
router.post('/', validate(addAssigneeSchema), ctrl.addHandler);
router.delete('/:userId', ctrl.removeHandler);

export { router as assigneeRoutes };

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createSwimlaneSchema, updateSwimlaneSchema, moveSwimlaneSchema } from '@trello-clone/shared';
import * as ctrl from './swimlanes.controller.js';

const router: RouterType = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/', validate(createSwimlaneSchema), ctrl.createHandler);
router.patch('/:swimlaneId', validate(updateSwimlaneSchema), ctrl.updateHandler);
router.patch('/:swimlaneId/move', validate(moveSwimlaneSchema), ctrl.moveHandler);
router.delete('/:swimlaneId', ctrl.deleteHandler);

export { router as swimlaneRoutes };

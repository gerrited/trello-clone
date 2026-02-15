import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createColumnSchema, updateColumnSchema, moveColumnSchema } from '@trello-clone/shared';
import * as ctrl from './columns.controller.js';

const router: RouterType = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/', validate(createColumnSchema), ctrl.createHandler);
router.patch('/:columnId', validate(updateColumnSchema), ctrl.updateHandler);
router.patch('/:columnId/move', validate(moveColumnSchema), ctrl.moveHandler);
router.delete('/:columnId', ctrl.deleteHandler);

export { router as columnRoutes };

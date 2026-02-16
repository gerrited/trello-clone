import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCommentSchema, updateCommentSchema } from '@trello-clone/shared';
import * as ctrl from './comments.controller.js';

const router: RouterType = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ctrl.listHandler);
router.post('/', validate(createCommentSchema), ctrl.createHandler);
router.patch('/:commentId', validate(updateCommentSchema), ctrl.updateHandler);
router.delete('/:commentId', ctrl.deleteHandler);

export { router as commentRoutes };

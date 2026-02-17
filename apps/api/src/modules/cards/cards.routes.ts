import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCardSchema, updateCardSchema, moveCardSchema } from '@trello-clone/shared';
import * as ctrl from './cards.controller.js';
import { assigneeRoutes } from '../assignees/assignees.routes.js';
import { commentRoutes } from '../comments/comments.routes.js';
import { cardLabelRoutes } from '../labels/labels.routes.js';

const router: RouterType = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/', validate(createCardSchema), ctrl.createHandler);
router.get('/:cardId', ctrl.getHandler);
router.patch('/:cardId', validate(updateCardSchema), ctrl.updateHandler);
router.patch('/:cardId/move', validate(moveCardSchema), ctrl.moveHandler);
router.delete('/:cardId', ctrl.deleteHandler);

router.use('/:cardId/assignees', assigneeRoutes);
router.use('/:cardId/comments', commentRoutes);
router.use('/:cardId/labels', cardLabelRoutes);

export { router as cardRoutes };

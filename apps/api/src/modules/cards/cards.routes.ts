import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth, optionalShareAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCardSchema, updateCardSchema, moveCardSchema } from '@trello-clone/shared';
import * as ctrl from './cards.controller.js';
import { assigneeRoutes } from '../assignees/assignees.routes.js';
import { commentRoutes } from '../comments/comments.routes.js';
import { cardLabelRoutes } from '../labels/labels.routes.js';

const router: RouterType = Router({ mergeParams: true });

// GET card detail supports both JWT auth and share-token (read-only access)
router.get('/:cardId', optionalShareAuth, ctrl.getHandler);

// All mutations require full JWT auth
router.use(requireAuth);

router.post('/', validate(createCardSchema), ctrl.createHandler);
router.patch('/:cardId', validate(updateCardSchema), ctrl.updateHandler);
router.patch('/:cardId/move', validate(moveCardSchema), ctrl.moveHandler);
router.delete('/:cardId', ctrl.deleteHandler);

router.use('/:cardId/assignees', assigneeRoutes);
router.use('/:cardId/comments', commentRoutes);
router.use('/:cardId/labels', cardLabelRoutes);

export { router as cardRoutes };

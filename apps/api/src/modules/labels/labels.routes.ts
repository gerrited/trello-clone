import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createLabelSchema, updateLabelSchema, addCardLabelSchema } from '@trello-clone/shared';
import * as ctrl from './labels.controller.js';

// Board-level label CRUD: /boards/:boardId/labels
const router: RouterType = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', ctrl.listHandler);
router.post('/', validate(createLabelSchema), ctrl.createHandler);
router.patch('/:labelId', validate(updateLabelSchema), ctrl.updateHandler);
router.delete('/:labelId', ctrl.deleteHandler);

export { router as labelRoutes };

// Card-level label assignment: mounted under /cards/:cardId/labels
const cardLabelRouter: RouterType = Router({ mergeParams: true });
cardLabelRouter.use(requireAuth);

cardLabelRouter.post('/', validate(addCardLabelSchema), ctrl.addCardLabelHandler);
cardLabelRouter.delete('/:labelId', ctrl.removeCardLabelHandler);

export { cardLabelRouter as cardLabelRoutes };

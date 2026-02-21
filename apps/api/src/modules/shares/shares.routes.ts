import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createUserShareSchema, createLinkShareSchema, updateShareSchema } from '@trello-clone/shared';
import * as ctrl from './shares.controller.js';

// Board-scoped share management (requires auth + edit permission)
const shareRoutes: RouterType = Router({ mergeParams: true });
shareRoutes.use(requireAuth);
shareRoutes.get('/', ctrl.listHandler);
shareRoutes.post('/user', validate(createUserShareSchema), ctrl.createUserShareHandler);
shareRoutes.post('/link', validate(createLinkShareSchema), ctrl.createLinkShareHandler);
shareRoutes.patch('/:shareId', validate(updateShareSchema), ctrl.updateHandler);
shareRoutes.delete('/:shareId', ctrl.deleteHandler);

// Public token-based access (NO requireAuth)
const sharedBoardRoutes: RouterType = Router();
sharedBoardRoutes.get('/:token', ctrl.getByTokenHandler);

export { shareRoutes, sharedBoardRoutes };

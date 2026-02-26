import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth, optionalShareAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCommentSchema, updateCommentSchema } from '@trello-clone/shared';
import * as ctrl from './comments.controller.js';

const router: RouterType = Router({ mergeParams: true });

// GET and POST support both JWT auth and share-token
router.get('/', optionalShareAuth, ctrl.listHandler);
router.post('/', optionalShareAuth, validate(createCommentSchema), ctrl.createHandler);

// Edit/delete require full JWT auth (must own the comment)
router.use(requireAuth);

router.patch('/:commentId', validate(updateCommentSchema), ctrl.updateHandler);
router.delete('/:commentId', ctrl.deleteHandler);

export { router as commentRoutes };

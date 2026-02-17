import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  createBoardFromTemplateSchema,
  saveAsTemplateSchema,
} from '@trello-clone/shared';
import * as ctrl from './templates.controller.js';

// Team-scoped template routes: /teams/:teamId/templates
const teamRouter: RouterType = Router({ mergeParams: true });
teamRouter.use(requireAuth);
teamRouter.get('/', ctrl.listHandler);
teamRouter.post('/', validate(createTemplateSchema), ctrl.createHandler);
// IMPORTANT: /from-template MUST come before /:templateId to avoid matching as param
teamRouter.post('/from-template', validate(createBoardFromTemplateSchema), ctrl.createFromTemplateHandler);
teamRouter.patch('/:templateId', validate(updateTemplateSchema), ctrl.updateHandler);
teamRouter.delete('/:templateId', ctrl.deleteHandler);

export { teamRouter as templateRoutes };

// Board-scoped save-as-template: /boards/:boardId/save-as-template
const boardRouter: RouterType = Router({ mergeParams: true });
boardRouter.use(requireAuth);
boardRouter.post('/', validate(saveAsTemplateSchema), ctrl.saveAsTemplateHandler);

export { boardRouter as saveAsTemplateRoutes };

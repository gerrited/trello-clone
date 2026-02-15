import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createTeamSchema, updateTeamSchema, inviteMemberSchema, updateMemberRoleSchema } from '@trello-clone/shared';
import * as ctrl from './teams.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', validate(createTeamSchema), ctrl.createHandler);
router.get('/', ctrl.listHandler);
router.get('/:teamId', ctrl.getHandler);
router.patch('/:teamId', validate(updateTeamSchema), ctrl.updateHandler);
router.delete('/:teamId', ctrl.deleteHandler);

router.post('/:teamId/members', validate(inviteMemberSchema), ctrl.inviteMemberHandler);
router.delete('/:teamId/members/:userId', ctrl.removeMemberHandler);
router.patch('/:teamId/members/:userId', validate(updateMemberRoleSchema), ctrl.updateMemberRoleHandler);

export { router as teamRoutes };

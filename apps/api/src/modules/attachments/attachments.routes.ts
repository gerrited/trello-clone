import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import * as ctrl from './attachments.controller.js';

const router: RouterType = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ctrl.listHandler);
router.post('/', upload.single('file'), ctrl.uploadHandler);
router.delete('/:attachmentId', ctrl.deleteHandler);

export { router as attachmentRoutes };

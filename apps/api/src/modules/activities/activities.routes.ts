import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './activities.controller.js';

// Board activities: mounted at /boards/:boardId/activities
const boardRouter: RouterType = Router({ mergeParams: true });
boardRouter.use(requireAuth);
boardRouter.get('/', controller.listBoardActivitiesHandler);
export { boardRouter as boardActivityRoutes };

// Card activities: mounted at /cards/:cardId/activities
const cardRouter: RouterType = Router({ mergeParams: true });
cardRouter.use(requireAuth);
cardRouter.get('/', controller.listCardActivitiesHandler);
export { cardRouter as cardActivityRoutes };

// Notifications: mounted at /notifications
const notifRouter: RouterType = Router();
notifRouter.use(requireAuth);
notifRouter.get('/', controller.listNotificationsHandler);
notifRouter.get('/unread-count', controller.getUnreadCountHandler);
notifRouter.patch('/:id/read', controller.markAsReadHandler);
notifRouter.post('/read-all', controller.markAllAsReadHandler);
export { notifRouter as notificationRoutes };

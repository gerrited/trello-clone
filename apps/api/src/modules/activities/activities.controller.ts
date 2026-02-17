import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as service from './activities.service.js';

export async function listBoardActivitiesHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await service.listBoardActivities(boardId, req.userId!, cursor, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listCardActivitiesHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const cardId = req.params.cardId as string;
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await service.listCardActivities(cardId, req.userId!, cursor, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listNotificationsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await service.listNotifications(req.userId!, unreadOnly, cursor, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCountHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const count = await service.getUnreadCount(req.userId!);
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

export async function markAsReadHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const notificationId = req.params.id as string;
    await service.markAsRead(notificationId, req.userId!);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsReadHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.markAllAsRead(req.userId!);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

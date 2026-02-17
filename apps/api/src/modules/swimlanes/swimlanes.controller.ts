import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as swimlanesService from './swimlanes.service.js';
import { broadcastToBoard } from '../../ws/emitters.js';
import { WS_EVENTS } from '@trello-clone/shared';
import { logActivity } from '../activities/activities.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const swimlane = await swimlanesService.createSwimlane(boardId, req.userId!, req.body);
    res.status(201).json({ swimlane });
    broadcastToBoard(boardId, WS_EVENTS.SWIMLANE_CREATED, { swimlane }, req.socketId);
    logActivity({ boardId, userId: req.userId!, action: 'swimlane.created', entityType: 'swimlane', entityId: swimlane.id, metadata: { name: swimlane.name }, excludeSocketId: req.socketId });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const swimlane = await swimlanesService.updateSwimlane(req.params.swimlaneId as string, req.userId!, req.body);
    res.json({ swimlane });
    broadcastToBoard(boardId, WS_EVENTS.SWIMLANE_UPDATED, { swimlane }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function moveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const swimlane = await swimlanesService.moveSwimlane(req.params.swimlaneId as string, req.userId!, req.body.afterId);
    res.json({ swimlane });
    broadcastToBoard(boardId, WS_EVENTS.SWIMLANE_MOVED, { swimlane }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const swimlaneId = req.params.swimlaneId as string;
    await swimlanesService.deleteSwimlane(swimlaneId, req.userId!);
    res.status(204).end();
    broadcastToBoard(boardId, WS_EVENTS.SWIMLANE_DELETED, { swimlaneId }, req.socketId);
    logActivity({ boardId, userId: req.userId!, action: 'swimlane.deleted', entityType: 'swimlane', entityId: swimlaneId, excludeSocketId: req.socketId });
  } catch (err) {
    next(err);
  }
}

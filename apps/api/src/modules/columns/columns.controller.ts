import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as columnsService from './columns.service.js';
import { broadcastToBoard } from '../../ws/emitters.js';
import { WS_EVENTS } from '@trello-clone/shared';
import { logActivity } from '../activities/activities.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const column = await columnsService.createColumn(boardId, req.userId!, req.body);
    res.status(201).json({ column });
    broadcastToBoard(boardId, WS_EVENTS.COLUMN_CREATED, { column }, req.socketId);
    logActivity({ boardId, userId: req.userId!, action: 'column.created', entityType: 'column', entityId: column.id, metadata: { name: column.name }, excludeSocketId: req.socketId });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const column = await columnsService.updateColumn(req.params.columnId as string, req.userId!, req.body);
    res.json({ column });
    broadcastToBoard(boardId, WS_EVENTS.COLUMN_UPDATED, { column }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function moveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const column = await columnsService.moveColumn(req.params.columnId as string, req.userId!, req.body.afterId);
    res.json({ column });
    broadcastToBoard(boardId, WS_EVENTS.COLUMN_MOVED, { column }, req.socketId);
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const columnId = req.params.columnId as string;
    await columnsService.deleteColumn(columnId, req.userId!);
    res.status(204).end();
    broadcastToBoard(boardId, WS_EVENTS.COLUMN_DELETED, { columnId }, req.socketId);
    logActivity({ boardId, userId: req.userId!, action: 'column.deleted', entityType: 'column', entityId: columnId, excludeSocketId: req.socketId });
  } catch (err) {
    next(err);
  }
}
